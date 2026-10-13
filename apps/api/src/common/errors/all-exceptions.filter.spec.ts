import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { AppError } from './app-error.js';
import { toErrorBody, validationExceptionFactory } from './all-exceptions.filter.js';

describe('toErrorBody', () => {
  it('keeps AppError bodies', () => {
    expect(toErrorBody(new AppError('SLOT_FULL'))).toEqual({
      statusCode: 409, code: 'SLOT_FULL', message: 'El turno está completo.',
    });
  });

  it('maps framework HTTP errors to generic codes without leaking messages', () => {
    expect(toErrorBody(new NotFoundException('Cannot GET /api/secret'))).toEqual({
      statusCode: 404, code: 'NOT_FOUND', message: 'No encontrado.',
    });
    expect(toErrorBody(new UnauthorizedException('jwt expired')).code).toBe('UNAUTHENTICATED');
    expect(toErrorBody(new BadRequestException('Unexpected token } in JSON')).code).toBe('VALIDATION_FAILED');
  });

  it('hides unknown errors', () => {
    const body = toErrorBody(new Error('duplicate key value violates unique constraint "users_email_key"'));
    expect(body).toEqual({ statusCode: 500, code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' });
  });

  it('builds VALIDATION_FAILED details from class-validator errors', () => {
    const error = Object.assign(new ValidationError(), {
      property: 'email', constraints: { isEmail: 'email must be an email' }, children: [],
    });
    const body = toErrorBody(validationExceptionFactory([error]));
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.details).toEqual([{ field: 'email', messages: ['email must be an email'] }]);
  });
});
