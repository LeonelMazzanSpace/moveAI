import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import type { Response } from 'express';
import { AppError, type ApiErrorBody, type ErrorDetail } from './app-error.js';
import { ERROR_CODES, type ErrorCode } from './error-codes.js';

const CODE_BY_STATUS: Record<number, ErrorCode> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
};

const genericBody = (code: ErrorCode): ApiErrorBody => {
  const { status, message } = ERROR_CODES[code];
  return { statusCode: status, code, message };
};

export function toErrorBody(exception: unknown): ApiErrorBody {
  if (exception instanceof AppError) return exception.getResponse() as ApiErrorBody;
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    // Client errors without a contract code (413, 409, 429…) are still client errors, not 500s.
    const fallback: ErrorCode = status < 500 ? 'VALIDATION_FAILED' : 'INTERNAL_ERROR';
    return genericBody(CODE_BY_STATUS[status] ?? fallback);
  }
  return genericBody('INTERNAL_ERROR');
}

const flattenErrors = (errors: ValidationError[], parent?: string): ErrorDetail[] =>
  errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});
    const own = messages.length > 0 ? [{ field, messages }] : [];
    return [...own, ...flattenErrors(error.children ?? [], field)];
  });

export function validationExceptionFactory(errors: ValidationError[]): AppError {
  return new AppError('VALIDATION_FAILED', flattenErrors(errors));
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : 'Non-error exception thrown');
    }
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
