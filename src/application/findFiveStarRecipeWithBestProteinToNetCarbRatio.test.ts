import { deepStrictEqual } from 'assert'

import * as EE from '@typed/fp/EnvEither'
import { start } from '@typed/fp/Resume'
import { left, right } from 'fp-ts/Either'
import { pipe } from 'fp-ts/function'
import { describe } from 'mocha'

import {
  NO_RECIPE_FOUND_MESSAGE,
  findFiveStarRecipeWithBestProteinToNetCarbRatio,
} from './findFiveStarRecipeWithBestProteinToNetCarbRatio'

import { NutritionFacts, Recipe, RecipeName, RecipeUrl } from '@domain/model'

describe(__filename, () => {
  describe(findFiveStarRecipeWithBestProteinToNetCarbRatio.name, () => {
    describe('given finding recipes failes', () => {
      it('returns a Left<string>', () => {
        const expected = 'Uh-oh'

        pipe(
          findFiveStarRecipeWithBestProteinToNetCarbRatio({
            findRecipes: () => EE.left(expected),
          }),
          start((either) => {
            deepStrictEqual(either, left(expected))
          }),
        )
      })
    })

    describe('given no recipes can be found', () => {
      it('returns a Left<string>', () => {
        pipe(
          findFiveStarRecipeWithBestProteinToNetCarbRatio({
            findRecipes: () => EE.of([]),
          }),
          start((either) => {
            deepStrictEqual(either, left(NO_RECIPE_FOUND_MESSAGE))
          }),
        )
      })
    })

    describe('given no five-star recipes can be found', () => {
      it('returns a Left<string>', () => {
        pipe(
          findFiveStarRecipeWithBestProteinToNetCarbRatio({
            findRecipes: () => EE.of([createTestRecipe()]),
          }),
          start((either) => {
            deepStrictEqual(either, left(NO_RECIPE_FOUND_MESSAGE))
          }),
        )
      })
    })

    describe('given some five-star recipes', () => {
      it('returns a Right w/ recipe with highest protein to net carb ratio', () => {
        const low = createTestRecipe({
          rating: 5,
          nutritionFacts: createTestNutritionFacts({ gramsOfProtein: 1, gramsOfNetCarbs: 1 }),
        })
        const high = createTestRecipe({
          rating: 5,
          nutritionFacts: createTestNutritionFacts({ gramsOfProtein: 20, gramsOfNetCarbs: 2 }),
        })

        pipe(
          findFiveStarRecipeWithBestProteinToNetCarbRatio({
            findRecipes: () => EE.of([createTestRecipe(), low, high]),
          }),
          start((either) => {
            deepStrictEqual(either, right(high))
          }),
        )
      })
    })
  })
})

function createTestRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    url: RecipeUrl('https://example.com/'),
    name: RecipeName('Test'),
    rating: 3,
    nutritionFacts: createTestNutritionFacts(),
    ...overrides,
  }
}

function createTestNutritionFacts(overrides: Partial<NutritionFacts> = {}): NutritionFacts {
  return {
    calories: 100,
    gramsOfCarbohydrate: 2,
    gramsOfFat: 1,
    gramsOfFiber: 3,
    gramsOfNetCarbs: 1,
    gramsOfProtein: 7,
    ...overrides,
  }
}
