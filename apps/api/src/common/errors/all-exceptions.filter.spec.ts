import {
  type ArgumentsHost, BadRequestException, ConflictException, Logger, NotFoundException, PayloadTooLargeException,
  UnauthorizedException,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { AppError } from './app-error.js';
import { AllExceptionsFilter, toErrorBody, validationExceptionFactory } from './all-exceptions.filter.js';

const VALIDATION_FAILED = { statusCode: 400, code: 'VALIDATION_FAILED', message: 'Los datos enviados no son válidos.' };
const INTERNAL_ERROR = { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' };

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

  it('maps other client HTTP errors to VALIDATION_FAILED without details', () => {
    expect(toErrorBody(new PayloadTooLargeException('request entity too large'))).toEqual(VALIDATION_FAILED);
    expect(toErrorBody(new ConflictException('duplicate key'))).toEqual(VALIDATION_FAILED);
  });

  it('maps exposed body-parser client errors (http-errors, no HttpException) to VALIDATION_FAILED', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), { status: 413, statusCode: 413, expose: true, type: 'entity.too.large' });
    const badJson = Object.assign(new SyntaxError('Unexpected token } in JSON'), { status: 400, expose: true, type: 'entity.parse.failed' });
    expect(toErrorBody(tooLarge)).toEqual(VALIDATION_FAILED);
    expect(toErrorBody(badJson)).toEqual(VALIDATION_FAILED);
  });

  it('keeps 500 for errors that carry a status but are not exposed 4xx errors', () => {
    expect(toErrorBody(Object.assign(new Error('x'), { status: 413, expose: false }))).toEqual(INTERNAL_ERROR);
    expect(toErrorBody(Object.assign(new Error('x'), { status: 413 }))).toEqual(INTERNAL_ERROR);
    expect(toErrorBody(Object.assign(new Error('x'), { status: 502, expose: true }))).toEqual(INTERNAL_ERROR);
    expect(toErrorBody(Object.assign(new Error('x'), { status: '413', expose: true }))).toEqual(INTERNAL_ERROR);
  });

  it('hides unknown errors', () => {
    const body = toErrorBody(new Error('duplicate key value violates unique constraint "users_email_key"'));
    expect(body).toEqual(INTERNAL_ERROR);
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

describe('AllExceptionsFilter', () => {
  const respond = (exception: unknown) => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) } as unknown as ArgumentsHost;
    new AllExceptionsFilter().catch(exception, host);
    return { status, json };
  };

  afterEach(() => { vi.restoreAllMocks(); });

  it('does not log client errors', () => {
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { status, json } = respond(new PayloadTooLargeException());
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(VALIDATION_FAILED);
    expect(logError).not.toHaveBeenCalled();
  });

  it('does not log exposed body-parser client errors', () => {
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { status, json } = respond(Object.assign(new Error('request entity too large'), { status: 413, expose: true }));
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(VALIDATION_FAILED);
    expect(logError).not.toHaveBeenCalled();
  });

  it('logs unknown errors server-side only', () => {
    const logError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { status, json } = respond(new Error('secret SQL'));
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(INTERNAL_ERROR);
    expect(logError).toHaveBeenCalledOnce();
  });
});
