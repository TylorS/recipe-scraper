import { fromTask } from '@typed/fp/Env'
import * as EE from '@typed/fp/EnvEither'
import * as R from '@typed/fp/Resume'
import chalk from 'chalk'
import * as Ei from 'fp-ts/Either'
import { tryCatch } from 'fp-ts/TaskEither'
import { pipe } from 'fp-ts/function'

import { findFiveStarRecipeWithBestProteinToNetCarbRatio } from '@application/findFiveStarRecipeWithBestProteinToNetCarbRatio'
import { Recipe } from '@domain/model'
import { readSavedRecipesFromFS } from '@infrastructure/readSavedRecipesFromFS'
import { scrapeRecipesWithPlaywright } from '@infrastructure/scrapeRecipesWithPlaywright'

// Construct our requirements for this application
const requirements = {
  findRecipes: () =>
    pipe(
      readSavedRecipesFromFS,
      EE.alt(() =>
        pipe(
          scrapeRecipesWithPlaywright,
          tryCatch,
          fromTask,
          EE.mapLeft((x) => (x instanceof Error ? x.message : `${x}`)),
        ),
      ),
    ),
}

const grams = (n: number) => (n === 0 ? 'Trace' : `${n}g`)

// Format our recipe with a little bit of color
const formatRecipe = (r: Recipe) => `
${chalk.bold(chalk.blue(r.name))}
URL: ${chalk.white(r.url)}
Nutrition Facts:
  - ${r.nutritionFacts.calories} Calories
  - ${grams(r.nutritionFacts.gramsOfCarbohydrate)} Carbs
  - ${grams(r.nutritionFacts.gramsOfFat)} Fat
  - ${grams(r.nutritionFacts.gramsOfFiber)} Dietary Fiber
  - ${grams(r.nutritionFacts.gramsOfNetCarbs)} Net Carbs
  - ${grams(r.nutritionFacts.gramsOfProtein)} Protein
`

// Run our findFiveStarRecipeWithBestProteinToNetCarbRatio application with its needed requirements
// and log out the recipe it finds
pipe(
  requirements,
  findFiveStarRecipeWithBestProteinToNetCarbRatio,
  R.start(Ei.matchW(console.error, (r: Recipe) => console.log(formatRecipe(r)))),
)
