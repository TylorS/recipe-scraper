import * as E from '@typed/fp/Env'
import * as EE from '@typed/fp/EnvEither'
import * as Ei from 'fp-ts/Either'
import { contramap } from 'fp-ts/Ord'
import * as RA from 'fp-ts/ReadonlyArray'
import { flow, pipe } from 'fp-ts/function'
import * as N from 'fp-ts/number'

import { Recipe } from '@domain/model'

export const NO_RECIPE_FOUND_MESSAGE = 'No Recipe could be found'

/**
 * Construct a contract for finding recipes. Defer implementation to the infrastructure layer
 */
export const findRecipes = E.op<() => E.Of<Ei.Either<string, readonly Recipe[]>>>()('findRecipes')()

/**
 * Check if a Recipe has a 5-star rating
 */
export const isFiveStarRating = (recipe: Recipe): boolean => recipe.rating === 5

/**
 * Get the ratio between protein to net carbs
 */
export const getProteinToNetCarbRatio = (recipe: Recipe): number =>
  recipe.nutritionFacts.gramsOfProtein / recipe.nutritionFacts.gramsOfNetCarbs

/**
 * Ord instance for Recipes based on protein to net carbs ratio
 */
export const proteinToNetCarbOrd = pipe(N.Ord, contramap(getProteinToNetCarbRatio))

/**
 * Find a five-star recipe with the highest protein to net carbs ratio
 */
export const findFiveStarRecipeWithBestProteinToNetCarbRatio = pipe(
  findRecipes,
  EE.map(
    flow(
      RA.filter(isFiveStarRating),
      RA.sort(proteinToNetCarbOrd),
      RA.last,
      Ei.fromOption(() => NO_RECIPE_FOUND_MESSAGE),
    ),
  ),
  E.map(Ei.flatten),
)
