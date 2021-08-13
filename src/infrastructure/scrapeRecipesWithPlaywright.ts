import { writeFileSync } from 'fs'
import { cpus } from 'os'
import { resolve } from 'path'

import { drawError, wrap } from '@typed/fp/DecodeError'
import { toDecoder } from '@typed/fp/Schema'
import * as Ei from 'fp-ts/Either'
import * as O from 'fp-ts/Option'
import * as RA from 'fp-ts/ReadonlyArray'
import * as TE from 'fp-ts/TaskEither'
import * as TH from 'fp-ts/These'
import { pipe } from 'fp-ts/function'
import PQueue from 'p-queue'
import pRetry from 'p-retry'
import * as P from 'playwright'

import { RECIPES_JSON_PATH } from './constants'

import { NutritionFacts, Rating, Recipe, RecipeName, RecipeUrl } from '@domain/model'

const RECIPES_ORIGIN = 'https://www.genaw.com/lowcarb'
const RECIPES_LINK = `recipes.html`

// A promise queue is used to limit concurrency of open requests to www.genaw.com.
const promiseQueue = new PQueue({ concurrency: cpus().length })

/**
 * Scrapes our recipes from www.genaw.com/lowcarb utilizing Playwright to manage
 * a headler browser.
 */
export async function scrapeRecipesWithPlaywright(): Promise<readonly Recipe[]> {
  console.log('Launching Browser...')
  const browser = await P.chromium.launch({ headless: true })

  try {
    console.log('Opening Recipes Page...')
    const recipesPage = await openPageTo(RECIPES_LINK, browser)
    console.log('Finding Categories...')
    const categories = await findNamedLinks('blockquote table td', recipesPage, browser)
    console.log('Scraping Recipes...')
    const { left: failures, right: recipes } = pipe(
      await Promise.all(
        pipe(
          categories,
          RA.map(([category, page]) => findRecipePages(category, page, browser)),
        ),
      ),
      RA.flatten,
      RA.separate,
    )

    if (recipes.length === 0) {
      throw new Error([`Failed to find any recipes`, ...failures].join('\n'))
    }

    if (failures.length > 0) {
      console.info('Scraping Failures:')
      console.info(failures.join('\n'), '\n')
    }

    // Save our recipes to disk for later usage
    writeFileSync(resolve(RECIPES_JSON_PATH), JSON.stringify({ recipes }, null, 2) + '\n')

    return recipes
  } finally {
    await browser.close()
  }
}

async function openPageTo(url: string, browser: P.Browser) {
  const page = await browser.newPage()

  await page.goto(`${RECIPES_ORIGIN}/${url}`)

  return page
}

async function findNamedLinks(query: string, page: P.Page, browser: P.Browser) {
  const matches = await queryAll(query, page)

  const pages = pipe(
    await Promise.all(matches.map((m) => openPageWithName(m, browser))),
    RA.compact,
  )

  await page.close()

  return pages
}

async function scrapeNamedLinks(query: string, page: P.Page, browser: P.Browser) {
  const matches = await queryAll(query, page)

  const pages = pipe(
    await Promise.all(
      matches.map((m) =>
        promiseQueue.add(() =>
          pRetry(
            () =>
              openPageWithName(m, browser).then((option) =>
                pipe(
                  option,
                  O.matchW(
                    () => [],
                    ([name, page]) =>
                      scrapeRecipe(name, page).then((either) => page.close().then(() => [either])),
                  ),
                ),
              ),
            { retries: 3 },
          ),
        ),
      ),
    ),
    RA.flatten,
  )

  return pages
}

async function queryAll<A extends HTMLElement>(query: string, page: P.Page) {
  const elements = await page.$$(query)

  return elements as unknown as readonly P.ElementHandle<A>[]
}

async function openPageWithName(el: P.ElementHandle<HTMLElement>, browser: P.Browser) {
  const [name, linkHref] = await Promise.all([
    el.innerText().then((text) => text.trim().replace(/\*$/, '').trim()),
    el.$('a').then((l) => l?.getAttribute('href')),
  ])

  if (!name || !linkHref) {
    return O.none
  }

  const page = await openPageTo(linkHref, browser)

  return O.some([name, page] as const)
}

async function queryElement<A extends HTMLElement>(query: string, page: P.Page) {
  const el = await page.$(query)

  return el as P.ElementHandle<A>
}

async function findRecipePages(category: string, page: P.Page, browser: P.Browser) {
  return category.toUpperCase() === 'MAIN DISHES'
    ? findMainDishRecipes(page, browser)
    : scrapeNamedLinks('blockquote table td li', page, browser)
}

async function findMainDishRecipes(page: P.Page, browser: P.Browser) {
  const subcategories = await queryAllLinks('table a', page, browser)
  const pages = await Promise.all(
    pipe(
      subcategories,
      RA.map((page) => scrapeNamedLinks('blockquote table td li', page, browser)),
    ),
  )

  return RA.flatten(pages)
}

async function queryAllLinks(query: string, page: P.Page, browser: P.Browser) {
  const matches = await queryAll<HTMLAnchorElement>(query, page)
  const hrefs = RA.compact(
    await Promise.all(
      pipe(
        matches,
        RA.map((m) => m.getAttribute('href').then(O.fromNullable)),
      ),
    ),
  )

  return await Promise.all(hrefs.map((h) => openPageTo(h, browser)))
}

async function scrapeRecipe(name: string, page: P.Page) {
  console.log(`Scraping ${name}...`)

  const [rating, nutritionFacts] = await Promise.all([
    scrapeRating(name, page),
    scrapeNutritionFacts('i', name, page).then((e) =>
      pipe(
        e,
        Ei.matchW(() => scrapeNutritionFacts('p', name, page), Ei.right),
      ),
    ),
  ])

  if (Ei.isLeft(nutritionFacts)) {
    return nutritionFacts
  }

  console.log(`Scraped ${name}!`)

  const recipe: Recipe = {
    url: RecipeUrl(page.url()),
    name: RecipeName(name),
    rating,
    nutritionFacts: nutritionFacts.right,
  }

  return Ei.right(recipe)
}

function scrapeRatingImage(name: string, rating: Rating, page: P.Page) {
  return async () => {
    const element = await queryElement<HTMLImageElement>(`img[src='${rating}_star.gif']`, page)

    return element ? Ei.right(rating) : Ei.left(`Unable to find Rating ${rating} for ${name}`)
  }
}

async function scrapeRating(name: string, page: P.Page) {
  return pipe(
    scrapeRatingImage(name, 1, page),
    TE.alt(() => scrapeRatingImage(name, 2, page)),
    TE.alt(() => scrapeRatingImage(name, 3, page)),
    TE.alt(() => scrapeRatingImage(name, 4, page)),
    TE.alt(() => scrapeRatingImage(name, 5, page)),
    TE.getOrElse((): Rating => 0),
  )()
}

async function scrapeNutritionFacts(query: string, name: string, page: P.Page) {
  const elements = pipe(await queryAll<HTMLElement>(query, page), RA.reverse)
  const failure = Ei.left(`Unable to find Nutrition Facts for ${name}: ${page.url()}`)

  for (const el of elements) {
    const innerText = await el.innerText()

    if (!innerText || (!innerText.includes('Serving:') && !innerText.includes('Recipe:'))) {
      continue
    }

    const [firstServingSize] = innerText.split(/\n/)
    const [withoutName, facts = withoutName] = firstServingSize.split(':')
    const parts = facts.split(';').map((s) => s.trim())
    const either = parseNutritionFacts(`${name}:: ${page.url()}`, parts)

    if (Ei.isRight(either)) {
      return either
    }
  }

  return failure
}

const parseNutritionFacts = (name: string, parts: string[]): Ei.Either<string, NutritionFacts> => {
  const facts: Partial<NutritionFacts> = {
    calories: 0,
    gramsOfCarbohydrate: 0,
    gramsOfFat: 0,
    gramsOfFiber: 0,
    gramsOfNetCarbs: 0,
    gramsOfProtein: 0,
  }

  for (const part of parts) {
    const [value, ...nameParts] = part
      .trim()
      .split(/\s/)
      .map((s) => s.trim())

    const key = parseKey(nameParts.join(' '))
    const n = parseValue(value)

    facts[key] = Number.isNaN(n) ? undefined : n
  }

  return pipe(
    toDecoder(NutritionFacts).decode(facts),
    TH.mapLeft((errors) => drawError(wrap(name, errors))),
    TH.matchW(Ei.left, Ei.right, Ei.left),
  )
}

const parseKey = (name: string): keyof NutritionFacts => {
  const lower = name.toLowerCase()

  switch (lower) {
    case 'calories':
      return 'calories'
    case 'dietary fiber':
      return 'gramsOfFiber'
    case 'carbs':
    case 'net carb':
    case 'net carbs':
      return 'gramsOfNetCarbs'
    default:
      return lower.startsWith('fat') ? `gramsOfFat` : (`gramsOf${name}` as keyof NutritionFacts)
  }
}

const parseValue = (value: string) => {
  if (value.trim() === 'trace') {
    return 0
  }

  return parseFloat(value)
}
