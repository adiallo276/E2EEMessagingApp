/**
 * Comprehensive Test Suite for Q-Messaging PQC Cryptographic Implementations
 * 
 * This test suite covers:
 * - MiniKyber (Ring-LWE based KEM)
 * - MiniFrodo (Standard LWE based KEM)
 * - MiniNTRU (Polynomial ring based KEM)
 * - AES-256-GCM encryption/decryption
 * - End-to-end encryption flow
 * - Key derivation (HKDF)
 * 
 * Run with: npx jest crypto.test.ts
 * Or: npm test
 */

import {
  miniKyberKeyGen,
  miniKyberEncapsulate,
  miniKyberDecapsulate,
} from '../lib/crypto/minikyber';

import {
  miniFrodoKeyGen,
  miniFrodoEncapsulate,
  miniFrodoDecapsulate,
} from '../lib/crypto/minifrodo';

import {
  miniNtruKeyGen,
  miniNtruEncapsulate,
  miniNtruDecapsulate,
} from '../lib/crypto/minintru';

import {
  aesGcmEncrypt,
  aesGcmDecrypt,
  deriveAesKey,
} from '../lib/crypto/aes';

// Helper to check if two Uint8Arrays are equal
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

describe('MiniKyber (Ring-LWE) KEM Tests', () => {
  
  test('should generate valid key pair', async () => {
    const keyPair = await miniKyberKeyGen();
    
    expect(keyPair).toBeDefined();
    expect(keyPair.pk).toBeDefined();
    expect(keyPair.sk).toBeDefined();
    expect(keyPair.pk.t).toBeDefined();
    expect(keyPair.pk.rho).toBeDefined();
    expect(keyPair.sk.s).toBeDefined();
  });

  test('should encapsulate and produce ciphertext and shared secret', async () => {
    const keyPair = await miniKyberKeyGen();
    const result = await miniKyberEncapsulate(keyPair.pk);
    
    expect(result).toBeDefined();
    expect(result.ct).toBeDefined();
    expect(result.sharedSecret).toBeDefined();
    expect(result.sharedSecret.length).toBe(32); // 256-bit shared secret
  });

  test('should decapsulate and recover same shared secret', async () => {
    const keyPair = await miniKyberKeyGen();
    const { ct, sharedSecret: encapSecret } = await miniKyberEncapsulate(keyPair.pk);
    const decapSecret = await miniKyberDecapsulate(keyPair.sk, ct);
    
    expect(arraysEqual(encapSecret, decapSecret)).toBe(true);
  });

  test('should produce different shared secrets with different key pairs', async () => {
    const keyPair1 = await miniKyberKeyGen();
    const keyPair2 = await miniKyberKeyGen();
    
    const { sharedSecret: secret1 } = await miniKyberEncapsulate(keyPair1.pk);
    const { sharedSecret: secret2 } = await miniKyberEncapsulate(keyPair2.pk);
    
    expect(arraysEqual(secret1, secret2)).toBe(false);
  });

  test('should be consistent over multiple operations', async () => {
    const keyPair = await miniKyberKeyGen();
    
    for (let i = 0; i < 10; i++) {
      const { ct, sharedSecret: encapSecret } = await miniKyberEncapsulate(keyPair.pk);
      const decapSecret = await miniKyberDecapsulate(keyPair.sk, ct);
      expect(arraysEqual(encapSecret, decapSecret)).toBe(true);
    }
  });
});

describe('MiniFrodo (Standard LWE) KEM Tests', () => {
  
  test('should generate valid key pair', async () => {
    const keyPair = await miniFrodoKeyGen();
    
    expect(keyPair).toBeDefined();
    expect(keyPair.pk).toBeDefined();
    expect(keyPair.sk).toBeDefined();
    expect(keyPair.pk.seedA).toBeDefined();
    expect(keyPair.pk.B).toBeDefined();
    expect(keyPair.sk.S).toBeDefined();
  });

  test('should encapsulate and produce ciphertext and shared secret', async () => {
    const keyPair = await miniFrodoKeyGen();
    const result = await miniFrodoEncapsulate(keyPair.pk);
    
    expect(result).toBeDefined();
    expect(result.ct).toBeDefined();
    expect(result.sharedSecret).toBeDefined();
    expect(result.sharedSecret.length).toBe(32);
  });

  test('should decapsulate and recover same shared secret', async () => {
    const keyPair = await miniFrodoKeyGen();
    const { ct, sharedSecret: encapSecret } = await miniFrodoEncapsulate(keyPair.pk);
    const decapSecret = await miniFrodoDecapsulate(keyPair.sk, ct);
    
    expect(arraysEqual(encapSecret, decapSecret)).toBe(true);
  });

  test('should produce different shared secrets with different key pairs', async () => {
    const keyPair1 = await miniFrodoKeyGen();
    const keyPair2 = await miniFrodoKeyGen();
    
    const { sharedSecret: secret1 } = await miniFrodoEncapsulate(keyPair1.pk);
    const { sharedSecret: secret2 } = await miniFrodoEncapsulate(keyPair2.pk);
    
    expect(arraysEqual(secret1, secret2)).toBe(false);
  });

  test('should be consistent over multiple operations', async () => {
    const keyPair = await miniFrodoKeyGen();
    
    for (let i = 0; i < 10; i++) {
      const { ct, sharedSecret: encapSecret } = await miniFrodoEncapsulate(keyPair.pk);
      const decapSecret = await miniFrodoDecapsulate(keyPair.sk, ct);
      expect(arraysEqual(encapSecret, decapSecret)).toBe(true);
    }
  });
});

describe('MiniNTRU (Polynomial Ring) KEM Tests', () => {
  
  test('should generate valid key pair', async () => {
    const keyPair = await miniNtruKeyGen();
    
    expect(keyPair).toBeDefined();
    expect(keyPair.pk).toBeDefined();
    expect(keyPair.sk).toBeDefined();
    expect(keyPair.pk.h).toBeDefined();
    expect(keyPair.sk.f).toBeDefined();
    expect(keyPair.sk.fp).toBeDefined();
  });

  test('should encapsulate and produce ciphertext and shared secret', async () => {
    const keyPair = await miniNtruKeyGen();
    const result = await miniNtruEncapsulate(keyPair.pk);
    
    expect(result).toBeDefined();
    expect(result.ct).toBeDefined();
    expect(result.sharedSecret).toBeDefined();
    expect(result.sharedSecret.length).toBe(32);
  });

  test('should decapsulate and recover same shared secret', async () => {
    const keyPair = await miniNtruKeyGen();
    const { ct, sharedSecret: encapSecret } = await miniNtruEncapsulate(keyPair.pk);
    const decapSecret = await miniNtruDecapsulate(keyPair.sk, ct);
    
    expect(arraysEqual(encapSecret, decapSecret)).toBe(true);
  });

  test('should handle multiple key generations without error', async () => {
    for (let i = 0; i < 5; i++) {
      const keyPair = await miniNtruKeyGen();
      expect(keyPair).toBeDefined();
      expect(keyPair.pk.h).toBeDefined();
    }
  });

  test('should be consistent over multiple operations', async () => {
    const keyPair = await miniNtruKeyGen();
    
    for (let i = 0; i < 5; i++) {
      const { ct, sharedSecret: encapSecret } = await miniNtruEncapsulate(keyPair.pk);
      const decapSecret = await miniNtruDecapsulate(keyPair.sk, ct);
      expect(arraysEqual(encapSecret, decapSecret)).toBe(true);
    }
  });
});

describe('AES-256-GCM Encryption Tests', () => {
  
  test('should encrypt and decrypt text correctly', async () => {
    // Create a test key
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test-info');
    
    const aesKey = await deriveAesKey(sharedSecret, salt, info);
    
    const plaintext = 'Hello, this is a test message!';
    const { ivB64, ciphertextB64 } = await aesGcmEncrypt(plaintext, aesKey);
    
    expect(ivB64).toBeDefined();
    expect(ciphertextB64).toBeDefined();
    
    const decrypted = await aesGcmDecrypt(ivB64, ciphertextB64, aesKey);
    expect(decrypted).toBe(plaintext);
  });

  test('should produce different ciphertexts for same plaintext (due to random IV)', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test-info');
    
    const aesKey = await deriveAesKey(sharedSecret, salt, info);
    
    const plaintext = 'Same message';
    const result1 = await aesGcmEncrypt(plaintext, aesKey);
    const result2 = await aesGcmEncrypt(plaintext, aesKey);
    
    // IVs should be different
    expect(result1.ivB64).not.toBe(result2.ivB64);
    // Ciphertexts should be different
    expect(result1.ciphertextB64).not.toBe(result2.ciphertextB64);
    
    // But both should decrypt to same plaintext
    const decrypted1 = await aesGcmDecrypt(result1.ivB64, result1.ciphertextB64, aesKey);
    const decrypted2 = await aesGcmDecrypt(result2.ivB64, result2.ciphertextB64, aesKey);
    expect(decrypted1).toBe(plaintext);
    expect(decrypted2).toBe(plaintext);
  });

  test('should handle long messages', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test-info');
    
    const aesKey = await deriveAesKey(sharedSecret, salt, info);
    
    const plaintext = 'A'.repeat(10000); // 10KB message
    const { ivB64, ciphertextB64 } = await aesGcmEncrypt(plaintext, aesKey);
    const decrypted = await aesGcmDecrypt(ivB64, ciphertextB64, aesKey);
    
    expect(decrypted).toBe(plaintext);
  });

  test('should handle unicode characters', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test-info');
    
    const aesKey = await deriveAesKey(sharedSecret, salt, info);
    
    const plaintext = '你好世界 🌍 مرحبا العالم';
    const { ivB64, ciphertextB64 } = await aesGcmEncrypt(plaintext, aesKey);
    const decrypted = await aesGcmDecrypt(ivB64, ciphertextB64, aesKey);
    
    expect(decrypted).toBe(plaintext);
  });

  test('should fail decryption with wrong key', async () => {
    const sharedSecret1 = crypto.getRandomValues(new Uint8Array(32));
    const sharedSecret2 = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test-info');
    
    const aesKey1 = await deriveAesKey(sharedSecret1, salt, info);
    const aesKey2 = await deriveAesKey(sharedSecret2, salt, info);
    
    const plaintext = 'Secret message';
    const { ivB64, ciphertextB64 } = await aesGcmEncrypt(plaintext, aesKey1);
    
    // Decrypting with wrong key should fail
    await expect(aesGcmDecrypt(ivB64, ciphertextB64, aesKey2)).rejects.toThrow();
  });
});

describe('Key Derivation (HKDF) Tests', () => {
  
  test('should derive consistent keys from same inputs', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test-info');
    
    const key1 = await deriveAesKey(sharedSecret, salt, info);
    const key2 = await deriveAesKey(sharedSecret, salt, info);
    
    // Export keys to compare
    const exported1 = await crypto.subtle.exportKey('raw', key1);
    const exported2 = await crypto.subtle.exportKey('raw', key2);
    
    expect(arraysEqual(new Uint8Array(exported1), new Uint8Array(exported2))).toBe(true);
  });

  test('should derive different keys from different salts', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const salt1 = crypto.getRandomValues(new Uint8Array(16));
    const salt2 = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test-info');
    
    const key1 = await deriveAesKey(sharedSecret, salt1, info);
    const key2 = await deriveAesKey(sharedSecret, salt2, info);
    
    const exported1 = await crypto.subtle.exportKey('raw', key1);
    const exported2 = await crypto.subtle.exportKey('raw', key2);
    
    expect(arraysEqual(new Uint8Array(exported1), new Uint8Array(exported2))).toBe(false);
  });
});

describe('End-to-End Encryption Flow Tests', () => {
  
  async function testE2EEFlow(
    keyGenFn: () => Promise<any>,
    encapFn: (pk: any) => Promise<{ ct: any; sharedSecret: Uint8Array }>,
    decapFn: (sk: any, ct: any) => Promise<Uint8Array>,
    algName: string
  ) {
    // Simulate Alice and Bob
    const aliceKeyPair = await keyGenFn();
    
    // Bob encapsulates using Alice's public key
    const { ct, sharedSecret: bobSecret } = await encapFn(aliceKeyPair.pk);
    
    // Alice decapsulates to get the same shared secret
    const aliceSecret = await decapFn(aliceKeyPair.sk, ct);
    
    // Both should have the same shared secret
    expect(arraysEqual(aliceSecret, bobSecret)).toBe(true);
    
    // Derive AES keys
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode(`e2ee-${algName}`);
    
    const aliceKey = await deriveAesKey(aliceSecret, salt, info);
    const bobKey = await deriveAesKey(bobSecret, salt, info);
    
    // Test message encryption
    const message = 'Hello from Bob!';
    const { ivB64, ciphertextB64 } = await aesGcmEncrypt(message, bobKey);
    const decrypted = await aesGcmDecrypt(ivB64, ciphertextB64, aliceKey);
    
    expect(decrypted).toBe(message);
    
    // Test reverse direction
    const reply = 'Hello from Alice!';
    const { ivB64: iv2, ciphertextB64: ct2 } = await aesGcmEncrypt(reply, aliceKey);
    const decryptedReply = await aesGcmDecrypt(iv2, ct2, bobKey);
    
    expect(decryptedReply).toBe(reply);
  }
  
  test('should work with Kyber', async () => {
    await testE2EEFlow(
      miniKyberKeyGen,
      miniKyberEncapsulate,
      miniKyberDecapsulate,
      'kyber'
    );
  });
  
  test('should work with Frodo', async () => {
    await testE2EEFlow(
      miniFrodoKeyGen,
      miniFrodoEncapsulate,
      miniFrodoDecapsulate,
      'frodo'
    );
  });
  
  test('should work with NTRU', async () => {
    await testE2EEFlow(
      miniNtruKeyGen,
      miniNtruEncapsulate,
      miniNtruDecapsulate,
      'ntru'
    );
  });
});

describe('Image Encryption Tests', () => {
  
  test('should encrypt and decrypt base64 image data', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test-info');
    
    const aesKey = await deriveAesKey(sharedSecret, salt, info);
    
    // Simulate image data (1x1 white pixel PNG)
    const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const imageMessage = `IMG:image/png:${imageBase64}`;
    
    const { ivB64, ciphertextB64 } = await aesGcmEncrypt(imageMessage, aesKey);
    const decrypted = await aesGcmDecrypt(ivB64, ciphertextB64, aesKey);
    
    expect(decrypted).toBe(imageMessage);
    expect(decrypted.startsWith('IMG:')).toBe(true);
  });
});

describe('Performance Benchmarks', () => {
  
  test('Kyber key generation should be reasonably fast', async () => {
    const iterations = 10;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await miniKyberKeyGen();
    }
    
    const elapsed = performance.now() - start;
    const avgTime = elapsed / iterations;
    
    console.log(`Kyber KeyGen avg: ${avgTime.toFixed(2)}ms`);
    expect(avgTime).toBeLessThan(500); // Should be under 500ms
  });
  
  test('Frodo key generation should complete', async () => {
    const iterations = 10;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await miniFrodoKeyGen();
    }
    
    const elapsed = performance.now() - start;
    const avgTime = elapsed / iterations;
    
    console.log(`Frodo KeyGen avg: ${avgTime.toFixed(2)}ms`);
    expect(avgTime).toBeLessThan(1000); // Frodo is slower
  });
  
  test('NTRU key generation should complete', async () => {
    const iterations = 5;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await miniNtruKeyGen();
    }
    
    const elapsed = performance.now() - start;
    const avgTime = elapsed / iterations;
    
    console.log(`NTRU KeyGen avg: ${avgTime.toFixed(2)}ms`);
    expect(avgTime).toBeLessThan(2000); // NTRU may take longer
  });
  
  test('AES encryption should be fast', async () => {
    const sharedSecret = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test-info');
    const aesKey = await deriveAesKey(sharedSecret, salt, info);
    
    const message = 'A'.repeat(1000); // 1KB message
    const iterations = 100;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await aesGcmEncrypt(message, aesKey);
    }
    
    const elapsed = performance.now() - start;
    const avgTime = elapsed / iterations;
    
    console.log(`AES Encrypt avg: ${avgTime.toFixed(2)}ms`);
    expect(avgTime).toBeLessThan(10); // Should be very fast
  });
});
