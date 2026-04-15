import { describe, expect, it } from 'vitest';
import { resolveGatewayAuthorization, resolveGatewayMessage } from '../chat/gateway';

describe('resolveGatewayAuthorization', () => {
  it('attaches bearer anon key in guest mode', () => {
    expect(resolveGatewayAuthorization('guest', null, 'anon-key')).toBe('Bearer anon-key');
  });

  it('returns undefined in guest mode when anon key is missing', () => {
    expect(resolveGatewayAuthorization('guest')).toBeUndefined();
  });

  it('attaches bearer jwt only for authenticated mode with real token', () => {
    expect(resolveGatewayAuthorization('authenticated', 'jwt-token', 'anon-key')).toBe('Bearer jwt-token');
  });

  it('throws for authenticated mode without token', () => {
    expect(() => resolveGatewayAuthorization('authenticated', null, 'anon-key')).toThrow(
      'Authenticated chat request requires a real access token'
    );
  });
});

describe('resolveGatewayMessage', () => {
  it('maps text into message when message is not provided', () => {
    expect(resolveGatewayMessage({ text: 'hello' })).toBe('hello');
  });

  it('prefers explicit message when provided', () => {
    expect(resolveGatewayMessage({ text: 'hello', message: 'crm-message' })).toBe('crm-message');
  });
});
