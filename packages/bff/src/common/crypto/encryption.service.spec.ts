import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { EncryptionService } from './encryption.service';

function makeService(key?: string): EncryptionService {
  const configService = {
    get: jest.fn().mockReturnValue(key ?? ''),
  } as unknown as ConfigService;
  return new EncryptionService(configService);
}

describe('EncryptionService', () => {
  const validKey = randomBytes(32).toString('hex');

  it('should encrypt and decrypt roundtrip', () => {
    const svc = makeService(validKey);
    const plaintext = 'hello world';
    const encrypted = svc.encrypt(plaintext);
    expect(svc.decrypt(encrypted)).toBe(plaintext);
  });

  it('should produce different ciphertext for same input (random IV)', () => {
    const svc = makeService(validKey);
    const a = svc.encrypt('same');
    const b = svc.encrypt('same');
    expect(a).not.toBe(b);
  });

  it('should throw on tampered ciphertext', () => {
    const svc = makeService(validKey);
    const encrypted = svc.encrypt('secret');
    const buf = Buffer.from(encrypted, 'base64');
    buf[15] ^= 0xff; // flip a byte in ciphertext area
    expect(() => svc.decrypt(buf.toString('base64'))).toThrow();
  });

  it('should handle empty string', () => {
    const svc = makeService(validKey);
    const encrypted = svc.encrypt('');
    expect(svc.decrypt(encrypted)).toBe('');
  });

  it('should handle unicode', () => {
    const svc = makeService(validKey);
    const text = '你好世界 🚀 émojis';
    const encrypted = svc.encrypt(text);
    expect(svc.decrypt(encrypted)).toBe(text);
  });

  it('should throw when key is missing', () => {
    const svc = makeService();
    expect(() => svc.encrypt('test')).toThrow('ENCRYPTION_KEY');
  });
});
