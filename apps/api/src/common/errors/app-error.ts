import { HttpException } from '@nestjs/common';
import { ERROR_CODES, type ErrorCode } from './error-codes.js';

export interface ErrorDetail { field: string; messages: string[] }

export interface ApiErrorBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
}

export class AppError extends HttpException {
  constructor(public readonly code: ErrorCode, details?: ErrorDetail[]) {
    const { status, message } = ERROR_CODES[code];
    super({ statusCode: status, code, message, ...(details ? { details } : {}) }, status);
  }
}
