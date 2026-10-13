import { createHmac } from 'node:crypto';
import { verifyMercadoPagoSignature } from './webhook-signature.js';

const secret = 'test-secret';
const sign = (manifest: string) => createHmac('sha256', secret).update(manifest).digest('hex');

describe('verifyMercadoPagoSignature', () => {
  it('accepts the documented manifest', () => {
    const v1 = sign('id:123456;request-id:req-1;ts:1700000000;');
    expect(verifyMercadoPagoSignature({ signatureHeader: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: '123456', secret })).toBe(true);
  });

  it('lowercases alphanumeric ids', () => {
    const v1 = sign('id:abc123;request-id:req-1;ts:1;');
    expect(verifyMercadoPagoSignature({ signatureHeader: `ts=1,v1=${v1}`, requestId: 'req-1', dataId: 'ABC123', secret })).toBe(true);
  });

  it('rejects tampering and missing parts', () => {
    const v1 = sign('id:123456;request-id:req-1;ts:1700000000;');
    expect(verifyMercadoPagoSignature({ signatureHeader: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: '999', secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ signatureHeader: undefined, requestId: 'req-1', dataId: '123456', secret })).toBe(false);
    expect(verifyMercadoPagoSignature({ signatureHeader: 'ts=1', requestId: 'req-1', dataId: '123456', secret })).toBe(false);
  });
});
