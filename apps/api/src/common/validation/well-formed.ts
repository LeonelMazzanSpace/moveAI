import { isEmail, ValidateBy } from 'class-validator';

// Same check as `String.prototype.isWellFormed`, which the tsconfig `lib` does not declare: in `u` mode a valid pair is one
// code point, so only unpaired surrogates match.
export const UNPAIRED_SURROGATE = /\p{Surrogate}/u;

export function isWellFormedString(value: unknown): value is string {
  return typeof value === 'string' && !UNPAIRED_SURROGATE.test(value);
}

// A lone UTF-16 surrogate serializes to a JSON escape that jsonb refuses, so it would reach Postgres as a 500.
export const IsWellFormed = () =>
  ValidateBy({
    name: 'isWellFormed',
    validator: { validate: isWellFormedString, defaultMessage: () => 'must not contain unpaired surrogates' },
  });

// `isEmail` throws a URIError (a 500) on an unpaired surrogate, so the well-formed check runs before it.
export const IsWellFormedEmail = () =>
  ValidateBy({
    name: 'isWellFormedEmail',
    validator: {
      validate: (value: unknown) => isWellFormedString(value) && isEmail(value),
      defaultMessage: () => 'must be an email',
    },
  });
