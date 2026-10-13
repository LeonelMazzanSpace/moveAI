import { ApiError } from './errors';

/** The API's validation messages are class-validator's English text with property names: never shown to the user. */
export const FIELD_ERROR_MESSAGE = 'Revisá este valor.';

interface ServerFieldError {
  type: 'server';
  message: string;
}

/**
 * Marks the form fields named in the `details` of an API validation error with our own Spanish copy:
 * `messages[field]` when the form has one, `FIELD_ERROR_MESSAGE` otherwise.
 * `rename` maps API field names to form field names when they differ. Returns whether any field got an error.
 */
export function applyFieldErrors<TName extends string>(
  error: unknown,
  fields: readonly TName[],
  setError: (name: TName, error: ServerFieldError) => void,
  rename: Readonly<Record<string, TName>> = {},
  messages?: Readonly<Partial<Record<TName, string>>>,
): boolean {
  if (!(error instanceof ApiError) || !error.details) return false;
  let applied = false;
  for (const { field, messages: apiMessages } of error.details) {
    const root = field.split(/[.[]/)[0];
    const name = Object.hasOwn(rename, root) ? rename[root] : fields.find((candidate) => candidate === root);
    if (name === undefined || apiMessages.length === 0) continue;
    setError(name, { type: 'server', message: messages?.[name] ?? FIELD_ERROR_MESSAGE });
    applied = true;
  }
  return applied;
}
