import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

import { drawErrors } from '@typed/fp/DecodeError'
import * as D from '@typed/fp/Decoder'
import * as E from '@typed/fp/Env'
import { toDecoder } from '@typed/fp/Schema'
import * as Ei from 'fp-ts/Either'
import * as TH from 'fp-ts/These'
import * as B from 'fp-ts/boolean'
import { flow, pipe } from 'fp-ts/function'

import { RECIPES_JSON_PATH } from './constants'

import { Recipe } from '@domain/model'

const recipesPath = resolve(RECIPES_JSON_PATH)

const recipesJsonDecoder = pipe(
  D.struct({
    recipes: D.array(toDecoder(Recipe)),
  }),
  D.condemmMissingKeys,
  D.map(({ recipes }) => recipes),
)

/**
 * Reads saved recipes from the filesystem
 */
export const readSavedRecipesFromFS: E.Of<Ei.Either<string, readonly Recipe[]>> = E.fromIO(() =>
  pipe(
    existsSync(recipesPath),
    B.matchW(
      () => Ei.left(`${recipesPath} does not exist`),
      () =>
        pipe(
          JSON.parse(readFileSync(recipesPath).toString()),
          recipesJsonDecoder.decode,
          TH.match(flow(drawErrors, Ei.left), Ei.right, (_, x) => Ei.right(x)),
        ),
    ),
  ),
)
