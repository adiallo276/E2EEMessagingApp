/**
 * Tests for AES utility functions: base64 encoding/decoding,
 * ArrayBuffer conversion, and HKDF key derivation edge cases.
 */
import { b64, unb64, toArrayBuffer, deriveAesKey, aesGcmEncrypt, aesGcmDecrypt } from '../lib/crypto/aes';

describe('Base64 Encoding/Decoding (b64/unb64)', () => {
  test('should roundtrip empty array', () => {
    const input = new Uint8Array(0);
    const encoded = b64(input);
    const decoded = unb64(encoded);
    expect(decoded.length).toBe(0);
  });

  test('should roundtrip single byte', () => {
    for (const val of [0, 1, 127, 128, 255]) {
      const input = new Uint8Array([val]);
      const decoded = unb64(b64(input));
      expect(decoded[0]).toBe(val);
    }
  });

  test('should roundtrip arbitrary bytes', () => {
    const input = new Uint8Array([0, 1, 2, 100, 200, 255, 128, 64]);
    const encoded = b64(input);
    const decoded = unb64(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(input));
  });

  test('should roundtrip 32-byte key material', () => {
    const input = crypto.getRandomValues(new Uint8Array(32));
    const encoded = b64(input);
    const decoded = unb64(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(input));
  });

  test('should roundtrip large data (1KB)', () => {
    const input = crypto.getRandomValues(new Uint8Array(1024));
    const encoded = b64(input);
    const decoded = unb64(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(input));
  });

  test('b64 output should be a valid base64 string', () => {
    const input = crypto.getRandomValues(new Uint8Array(16));
    const encoded = b64(input);
    // Base64 chars: A-Z, a-z, 0-9, +, /, =
    expect(encoded).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  test('unb64 should decode standard base64', () => {
    // "Hello" in base64 is "SGVsbG8="
    const decoded = unb64('SGVsbG8=');
    const text = new TextDecoder().decode(decoded);
    expect(text).toBe('Hello');
  });
});

describe('toArrayBuffer', () => {
  test('should convert Uint8Array to ArrayBuffer', () => {
    const input = new Uint8Array([1, 2, 3, 4]);
    const ab = toArrayBuffer(input);
    expect(ab).toBeInstanceOf(ArrayBuffer);
    expect(ab.byteLength).toBe(4);
    expect(Array.from(new Uint8Array(ab))).toEqual([1, 2, 3, 4]);
  });

  test('should handle empty Uint8Array', () => {
    const input = new Uint8Array(0);
    const ab = toArrayBuffer(input);
    expect(ab.byteLength).toBe(0);
  });

  test('should create independent copy', () => {
    const input = new Uint8Array([1, 2, 3]);
    const ab = toArrayBuffer(input);
    // Modify original
    input[0] = 99;
    // ArrayBuffer copy should be unaffected
    expect(new Uint8Array(ab)[0]).toBe(1);
  });
});

describe('HKDF Key Derivation Edge Cases', () => {
  test('should derive 256-bit AES key', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test');

    const key = await deriveAesKey(sharedSecret, salt, info);
    expect(key).toBeDefined();
    expect(key.type).toBe('secret');
    expect(key.algorithm).toEqual(expect.objectContaining({ name: 'AES-GCM', length: 256 }));
  });

  test('should produce deterministic keys from same inputs', async () => {
    const sharedSecret = new Uint8Array(32).fill(42);
    const salt = new Uint8Array(16).fill(7);
    const info = new TextEncoder().encode('deterministic-test');

    const key1 = await deriveAesKey(sharedSecret, salt, info);
    const key2 = await deriveAesKey(sharedSecret, salt, info);

    // Encrypt with key1, decrypt with key2
    const { ivB64, ciphertextB64 } = await aesGcmEncrypt('test', key1);
    const decrypted = await aesGcmDecrypt(ivB64, ciphertextB64, key2);
    expect(decrypted).toBe('test');
  });

  test('different info strings should produce different keys', async () => {
    const sharedSecret = new Uint8Array(32).fill(42);
    const salt = new Uint8Array(16).fill(7);

    const key1 = await deriveAesKey(sharedSecret, salt, new TextEncoder().encode('info-a'));
    const key2 = await deriveAesKey(sharedSecret, salt, new TextEncoder().encode('info-b'));

    // Encrypt with key1, try decrypt with key2 - should fail
    const { ivB64, ciphertextB64 } = await aesGcmEncrypt('test', key1);
    await expect(aesGcmDecrypt(ivB64, ciphertextB64, key2)).rejects.toThrow();
  });

  test('different shared secrets should produce different keys', async () => {
    const salt = new Uint8Array(16).fill(7);
    const info = new TextEncoder().encode('test');

    const key1 = await deriveAesKey(new Uint8Array(32).fill(1), salt, info);
    const key2 = await deriveAesKey(new Uint8Array(32).fill(2), salt, info);

    const { ivB64, ciphertextB64 } = await aesGcmEncrypt('test', key1);
    await expect(aesGcmDecrypt(ivB64, ciphertextB64, key2)).rejects.toThrow();
  });

  test('should work with minimum-size inputs', async () => {
    const sharedSecret = new Uint8Array(1).fill(1);
    const salt = new Uint8Array(1).fill(1);
    const info = new Uint8Array(0);

    const key = await deriveAesKey(sharedSecret, salt, info);
    expect(key).toBeDefined();

    const { ivB64, ciphertextB64 } = await aesGcmEncrypt('small input test', key);
    const decrypted = await aesGcmDecrypt(ivB64, ciphertextB64, key);
    expect(decrypted).toBe('small input test');
  });
});
