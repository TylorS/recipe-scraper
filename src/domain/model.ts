import { Branded } from '@typed/fp/Branded'
import * as S from '@typed/fp/Schema'
import { pipe } from 'fp-ts/function'

const RATINGS = [0, 1, 2, 3, 4, 5]

/**
 * Our model for a Recipe. It is uniquely identified by its URL
 */
export const Recipe = S.create((t) =>
  t.struct({
    url: t.branded<RecipeUrl>(t.string),
    name: pipe(t.string, t.refine(isRecipeName, 'RecipeName')),
    rating: pipe(t.number, t.refine(isRating, 'Rating')),
    nutritionFacts: NutritionFacts(t),
  }),
)

export type Recipe = S.TypeOf<typeof Recipe>

// Differentiate RecipeUrls from all other strings
export type RecipeUrl = Branded<string, { readonly RecipeUrl: unique symbol }>
export const RecipeUrl = Branded<RecipeUrl>()

// Differentiate RecipeName from all other strings
// Must be non-empty
export type RecipeName = Branded<string, { readonly RecipeName: unique symbol }>
export const RecipeName = Branded<RecipeName>()

export const isRecipeName = (name: string): name is RecipeName => name.length > 0

export type Rating = 0 | 1 | 2 | 3 | 4 | 5

export const isRating = (n: number): n is Rating => RATINGS.includes(n)

export const NutritionFacts = S.create((t) =>
  t.struct({
    calories: t.number,
    gramsOfCarbohydrate: t.number,
    gramsOfFat: t.number,
    gramsOfFiber: t.number,
    gramsOfNetCarbs: t.number,
    gramsOfProtein: t.number,
  }),
)

export type NutritionFacts = S.TypeOf<typeof NutritionFacts>
