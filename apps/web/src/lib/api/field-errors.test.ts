import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './errors';
import { applyFieldErrors, FIELD_ERROR_MESSAGE } from './field-errors';

const FIELDS = ['name', 'price', 'clientId'] as const;

function validationError(details: { field: string; messages: string[] }[] | undefined) {
  return new ApiError(400, 'VALIDATION_FAILED', 'Los datos enviados no son válidos.', details);
}

describe('applyFieldErrors', () => {
  it('marks every known field with the fixed Spanish message, never the server text', () => {
    const setError = vi.fn();
    const error = validationError([
      { field: 'name', messages: ['name must be longer than or equal to 2 characters', 'name must be a string'] },
      { field: 'price', messages: ['price must not be greater than 10000000'] },
    ]);
    expect(applyFieldErrors(error, FIELDS, setError)).toBe(true);
    expect(setError).toHaveBeenCalledTimes(2);
    expect(setError).toHaveBeenCalledWith('name', { type: 'server', message: FIELD_ERROR_MESSAGE });
    expect(setError).toHaveBeenCalledWith('price', { type: 'server', message: FIELD_ERROR_MESSAGE });
    for (const [, { message }] of setError.mock.calls) {
      expect(message).not.toMatch(/must|characters|string|greater/);
    }
  });

  it('uses the form copy for a field when it has one and the fixed message for the rest', () => {
    const setError = vi.fn();
    const error = validationError([
      { field: 'name', messages: ['name must be a string'] },
      { field: 'price', messages: ['price must be a number'] },
    ]);
    expect(applyFieldErrors(error, FIELDS, setError, {}, { name: 'Ingresá un nombre válido.' })).toBe(true);
    expect(setError).toHaveBeenCalledWith('name', { type: 'server', message: 'Ingresá un nombre válido.' });
    expect(setError).toHaveBeenCalledWith('price', { type: 'server', message: FIELD_ERROR_MESSAGE });
  });

  it('uses Spanish with voseo', () => {
    expect(FIELD_ERROR_MESSAGE).toBe('Revisá este valor.');
  });

  it('ignores fields the form does not have', () => {
    const setError = vi.fn();
    const error = validationError([{ field: 'unknown', messages: ['unknown should not exist'] }]);
    expect(applyFieldErrors(error, FIELDS, setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it('renames API fields to form fields', () => {
    const setError = vi.fn();
    const error = validationError([{ field: 'userId', messages: ['userId must be a UUID'] }]);
    expect(applyFieldErrors(error, FIELDS, setError, { userId: 'clientId' })).toBe(true);
    expect(setError).toHaveBeenCalledWith('clientId', { type: 'server', message: FIELD_ERROR_MESSAGE });
  });

  it('maps nested paths to their root field', () => {
    const setError = vi.fn();
    const error = validationError([{ field: 'name.0', messages: ['each value in name must be a string'] }]);
    expect(applyFieldErrors(error, FIELDS, setError)).toBe(true);
    expect(setError).toHaveBeenCalledWith('name', { type: 'server', message: FIELD_ERROR_MESSAGE });
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
