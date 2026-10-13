import { createHmac, timingSafeEqual } from 'node:crypto';

// Mercado Pago `x-signature`: `ts=<ts>,v1=<hmac>` where the HMAC-SHA256 (hex) signs
// `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` with the webhook secret.
export function verifyMercadoPagoSignature(input: { signatureHeader?: string; requestId?: string; dataId?: string; secret: string }): boolean {
  const { signatureHeader, requestId, dataId, secret } = input;
  if (!signatureHeader || !requestId || !dataId) return false;
  const parts = new Map(signatureHeader.split(',').map((p) => p.trim().split('=', 2) as [string, string]));
  const ts = parts.get('ts');
  const v1 = parts.get('v1');
  if (!ts || !v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const expected = createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
  return expected.length === v1.length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
