import { ApiError } from './errors';

interface ServerFieldError {
  type: 'server';
  message: string;
}

/**
 * Copies the `details` of an API validation error onto the form fields that exist, using the first message of each.
 * `rename` maps API field names to form field names when they differ. Returns whether any field got an error.
 */
export function applyFieldErrors<TName extends string>(
  error: unknown,
  fields: readonly TName[],
  setError: (name: TName, error: ServerFieldError) => void,
  rename: Readonly<Record<string, TName>> = {},
): boolean {
  if (!(error instanceof ApiError) || !error.details) return false;
  let applied = false;
  for (const { field, messages } of error.details) {
    const root = field.split(/[.[]/)[0];
    const name = Object.hasOwn(rename, root) ? rename[root] : fields.find((candidate) => candidate === root);
    const message = messages[0];
    if (name === undefined || message === undefined) continue;
    setError(name, { type: 'server', message });
    applied = true;
  }
  return applied;
}
