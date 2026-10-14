import type { ApiErrorBody, ErrorCode } from './types';

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly details?: ApiErrorBody['details'];

  constructor(status: number, code: ErrorCode | 'NETWORK_ERROR', message: string, details?: ApiErrorBody['details']) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const NETWORK_MESSAGE = 'No pudimos conectar con MOVE. Probá de nuevo.';

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Los datos enviados no son válidos.',
  UNAUTHENTICATED: 'Tenés que iniciar sesión.',
  FORBIDDEN: 'No tenés permiso para esta acción.',
  NOT_FOUND: 'No encontrado.',
  INTERNAL_ERROR: 'Ocurrió un error inesperado.',
  PLAN_NOT_FOUND: 'El plan no existe.',
  PLAN_INACTIVE: 'El plan no está disponible.',
  PLAN_KIND_INVALID: 'El tipo de plan no es válido para esta operación.',
  SLUG_TAKEN: 'Ya existe un plan con ese identificador.',
  SETTINGS_INVALID: 'La configuración no es válida.',
  PROFESSIONAL_NOT_FOUND: 'El profesional no existe.',
  TEMPLATE_NOT_FOUND: 'El horario no existe.',
  TEMPLATE_INVALID: 'El horario no es válido.',
  SLOT_NOT_FOUND: 'El turno no existe.',
  SLOT_NOT_BOOKABLE: 'Este turno ya no se puede reservar.',
  SLOT_FULL: 'El turno está completo.',
  SLOT_HAS_BOOKINGS: 'El turno tiene reservas activas.',
  CAPACITY_BELOW_BOOKED: 'El cupo no puede ser menor a las reservas activas.',
  ALREADY_BOOKED: 'Ya tenés una reserva en este turno.',
  PLAN_REQUIRED: 'Necesitás un plan vigente para reservar.',
  PACKAGE_REQUIRED: 'No tenés sesiones disponibles en un paquete.',
  REHAB_FOLLOWUP_NOT_ENABLED: 'El seguimiento fisioterapéutico no está habilitado para tu cuenta.',
  SERVICE_MISMATCH: 'El turno no corresponde a ese servicio.',
  BOOKING_NOT_FOUND: 'La reserva no existe.',
  BOOKING_NOT_CANCELLABLE: 'Esta reserva no se puede cancelar online.',
  CANCEL_WINDOW_CLOSED: 'Ya pasó el plazo para cancelar este turno.',
  ATTENDANCE_NOT_ALLOWED: 'Todavía no se puede registrar la asistencia de este turno.',
  LOGIN_REQUIRED: 'Ya tenés una cuenta con ese email: ingresá para continuar.',
  HOLD_LIMIT_REACHED: 'Ya tenés reservas pendientes de pago. Completá el pago o esperá a que venzan.',
  RATE_LIMITED: 'Hiciste demasiados intentos. Esperá un rato y probá de nuevo.',
  GUEST_DATA_REQUIRED: 'Completá tus datos para continuar.',
  EMAIL_ALREADY_REGISTERED: 'Ya existe una cuenta con ese email.',
  USER_NOT_FOUND: 'El usuario no existe.',
  PURCHASE_NOT_FOUND: 'La operación no existe.',
  INVALID_SIGNATURE: 'Firma inválida.',
  PAYMENT_PROVIDER_ERROR: 'No pudimos iniciar el pago. Probá de nuevo en unos minutos.',
  CLIENT_NOT_FOUND: 'El cliente no existe.',
  ALERT_NOT_FOUND: 'La alerta no existe.',
  ALERT_ALREADY_HANDLED: 'La alerta ya fue gestionada.',
  PAUSE_ALREADY_ACTIVE: 'El cliente ya tiene una pausa activa.',
  NO_ACTIVE_PAUSE: 'El cliente no tiene una pausa activa.',
  CHECKIN_NOT_FOUND: 'El check-in no existe.',
  CHECKIN_ALREADY_ANSWERED: 'Este check-in ya fue respondido.',
  JOB_UNKNOWN: 'La automatización no existe.',
  AUTO_DEBIT_NOT_ALLOWED: 'Este plan no tiene débito automático.',
  AUTO_DEBIT_ACTIVE: 'Ya tenés un débito automático activo para este servicio.',
  AUTO_DEBIT_NOT_FOUND: 'No encontramos ese débito automático.',
  CALENDAR_NOT_CONFIGURED: 'La conexión con Google Calendar no está configurada.',
  CALENDAR_NOT_CONNECTED: 'Primero conectá una cuenta de Google Calendar.',
  CALENDAR_INVALID_CALENDAR: 'Elegí un calendario de la lista.',
  CALENDAR_PROVIDER_ERROR: 'Google Calendar no respondió. Probá de nuevo en un rato.',
};

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return ERROR_MESSAGES.INTERNAL_ERROR;
  if (error.code === 'NETWORK_ERROR') return NETWORK_MESSAGE;
  return ERROR_MESSAGES[error.code] ?? ERROR_MESSAGES.INTERNAL_ERROR;
}

const STATUS_FALLBACK_CODES: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
};

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === 'object' && value !== null && 'code' in value && typeof value.code === 'string';
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

export async function readApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await readJson(response);
  if (response.ok) return body as T;
  if (isApiErrorBody(body)) {
    throw new ApiError(response.status, body.code, body.message, body.details);
  }
  const code = STATUS_FALLBACK_CODES[response.status] ?? 'INTERNAL_ERROR';
  throw new ApiError(response.status, code, ERROR_MESSAGES[code]);
}

export function networkError(): ApiError {
  return new ApiError(0, 'NETWORK_ERROR', NETWORK_MESSAGE);
}
