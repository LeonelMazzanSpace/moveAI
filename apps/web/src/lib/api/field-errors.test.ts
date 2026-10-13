import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { applyFieldErrors } from './field-errors';

const FIELDS = ['name', 'price', 'clientId'] as const;

function validationError(details: { field: string; messages: string[] }[] | undefined) {
  return new ApiError(400, 'VALIDATION_FAILED', 'Los datos enviados no son válidos.', details);
}

describe('applyFieldErrors', () => {
  it('sets the first message of every known field and reports it', () => {
    const setError = vi.fn();
    const error = validationError([
      { field: 'name', messages: ['name must be longer', 'otra'] },
      { field: 'price', messages: ['price must not be greater than 10000000'] },
    ]);
    expect(applyFieldErrors(error, FIELDS, setError)).toBe(true);
    expect(setError).toHaveBeenCalledTimes(2);
    expect(setError).toHaveBeenCalledWith('name', { type: 'server', message: 'name must be longer' });
    expect(setError).toHaveBeenCalledWith('price', { type: 'server', message: 'price must not be greater than 10000000' });
  });

  it('ignores fields the form does not have', () => {
    const setError = vi.fn();
    const error = validationError([{ field: 'unknown', messages: ['x'] }]);
    expect(applyFieldErrors(error, FIELDS, setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it('renames API fields to form fields', () => {
    const setError = vi.fn();
    const error = validationError([{ field: 'userId', messages: ['userId must be a UUID'] }]);
    expect(applyFieldErrors(error, FIELDS, setError, { userId: 'clientId' })).toBe(true);
    expect(setError).toHaveBeenCalledWith('clientId', { type: 'server', message: 'userId must be a UUID' });
  });

  it('maps nested paths to their root field', () => {
    const setError = vi.fn();
    const error = validationError([{ field: 'name.0', messages: ['bad'] }]);
    expect(applyFieldErrors(error, FIELDS, setError)).toBe(true);
    expect(setError).toHaveBeenCalledWith('name', { type: 'server', message: 'bad' });
  });

  it('reports false for errors without details, empty messages or other errors', () => {
    const setError = vi.fn();
    expect(applyFieldErrors(validationError(undefined), FIELDS, setError)).toBe(false);
    expect(applyFieldErrors(validationError([{ field: 'name', messages: [] }]), FIELDS, setError)).toBe(false);
    expect(applyFieldErrors(new ApiError(409, 'SLUG_TAKEN', 'x'), FIELDS, setError)).toBe(false);
    expect(applyFieldErrors(new Error('boom'), FIELDS, setError)).toBe(false);
    expect(applyFieldErrors(undefined, FIELDS, setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it('does not treat inherited object keys as form fields', () => {
    const setError = vi.fn();
    const error = validationError([{ field: 'constructor', messages: ['x'] }, { field: '__proto__', messages: ['y'] }]);
    expect(applyFieldErrors(error, FIELDS, setError, {})).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
