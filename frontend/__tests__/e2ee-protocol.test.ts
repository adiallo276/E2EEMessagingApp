/**
 * Tests for the E2EE protocol layer.
 * Covers envelope parsing, HELLO/KEY message construction,
 * full handshake flows for all algorithms, session management,
 * and message encryption/decryption through the protocol.
 */
import {
  tryParseEnvelope,
  makeHello,
  makeKeyReply,
  getOrCreateKeyPair,
  handleHelloAndCreateKeyReply,
  handleKeyAndStoreSession,
  encryptChatMessage,
  decryptChatMessage,
  hasSession,
  clearSession,
  loadAesKey,
  saveSessionFromSharedSecret,
  KemAlg,
} from '../lib/crypto/e2ee';
import { aesGcmEncrypt, aesGcmDecrypt } from '../lib/crypto/aes';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Envelope Parsing (tryParseEnvelope)', () => {
  test('should parse valid E2EE_HELLO envelope', () => {
    const content = JSON.stringify({ type: 'E2EE_HELLO', v: 1, alg: 'kyber', pk: { a: [], t: [] } });
    const env = tryParseEnvelope(content);
    expect(env).not.toBeNull();
    expect(env!.type).toBe('E2EE_HELLO');
  });

  test('should parse valid E2EE_KEY envelope', () => {
    const content = JSON.stringify({ type: 'E2EE_KEY', v: 1, alg: 'kyber', ct: {}, saltB64: 'abc', infoB64: 'def' });
    const env = tryParseEnvelope(content);
    expect(env).not.toBeNull();
    expect(env!.type).toBe('E2EE_KEY');
  });

  test('should parse valid E2EE_MSG envelope', () => {
    const content = JSON.stringify({ type: 'E2EE_MSG', v: 1, ivB64: 'abc', ciphertextB64: 'def' });
    const env = tryParseEnvelope(content);
    expect(env).not.toBeNull();
    expect(env!.type).toBe('E2EE_MSG');
  });

  test('should return null for non-JSON content', () => {
    expect(tryParseEnvelope('Hello world')).toBeNull();
    expect(tryParseEnvelope('')).toBeNull();
    expect(tryParseEnvelope('not json')).toBeNull();
  });

  test('should return null for JSON without type field', () => {
    expect(tryParseEnvelope(JSON.stringify({ v: 1 }))).toBeNull();
    expect(tryParseEnvelope(JSON.stringify({ data: 'test' }))).toBeNull();
  });

  test('should return null for unknown envelope types', () => {
    expect(tryParseEnvelope(JSON.stringify({ type: 'UNKNOWN', v: 1 }))).toBeNull();
    expect(tryParseEnvelope(JSON.stringify({ type: 'E2EE_ACK', v: 1 }))).toBeNull();
  });

  test('should return null for null/undefined input', () => {
    expect(tryParseEnvelope(null as any)).toBeNull();
    expect(tryParseEnvelope(undefined as any)).toBeNull();
  });

  test('should return null for malformed JSON starting with {', () => {
    expect(tryParseEnvelope('{broken json')).toBeNull();
  });
});

describe('Message Construction', () => {
  test('makeHello should create valid HELLO envelope', () => {
    const pk = { a: [1, 2, 3], t: [4, 5, 6] };
    const content = makeHello('kyber', pk);
    const env = tryParseEnvelope(content);
    expect(env).not.toBeNull();
    expect(env!.type).toBe('E2EE_HELLO');
    expect((env as any).alg).toBe('kyber');
    expect((env as any).pk).toEqual(pk);
  });

  test('makeHello should work for all algorithms', () => {
    const algs: KemAlg[] = ['kyber', 'frodo', 'ntru', 'ecdh'];
    for (const alg of algs) {
      const content = makeHello(alg, { test: true });
      const env = tryParseEnvelope(content);
      expect(env).not.toBeNull();
      expect((env as any).alg).toBe(alg);
    }
  });

  test('makeKeyReply should create valid KEY envelope', () => {
    const ct = { u: [1], v: [2] };
    const salt = new Uint8Array([1, 2, 3]);
    const info = new Uint8Array([4, 5, 6]);
    const content = makeKeyReply('frodo', ct, salt, info);
    const env = tryParseEnvelope(content);
    expect(env).not.toBeNull();
    expect(env!.type).toBe('E2EE_KEY');
    expect((env as any).alg).toBe('frodo');
    expect((env as any).saltB64).toBeDefined();
    expect((env as any).infoB64).toBeDefined();
  });
});

describe('Key Pair Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  test('should generate and cache Kyber key pair', async () => {
    const kp1 = await getOrCreateKeyPair('alice', 'kyber');
    expect(kp1.pk.t).toBeDefined();
    expect(kp1.sk.s).toBeDefined();

    const kp2 = await getOrCreateKeyPair('alice', 'kyber');
    expect(JSON.stringify(kp1)).toBe(JSON.stringify(kp2));
  });

  test('should generate and cache Frodo key pair', async () => {
    const kp = await getOrCreateKeyPair('alice', 'frodo');
    expect(kp.pk.B).toBeDefined();
    expect(kp.sk.S).toBeDefined();
  });

  test('should generate and cache NTRU key pair', async () => {
    const kp = await getOrCreateKeyPair('alice', 'ntru');
    expect(kp.pk.h).toBeDefined();
    expect(kp.sk.f).toBeDefined();
  });

  test('different algorithms should produce different key pairs', async () => {
    const kyber = await getOrCreateKeyPair('alice', 'kyber');
    const frodo = await getOrCreateKeyPair('alice', 'frodo');
    expect(JSON.stringify(kyber)).not.toBe(JSON.stringify(frodo));
  });

  test('different users should get different key pairs', async () => {
    const alice = await getOrCreateKeyPair('alice', 'kyber');
    const bob = await getOrCreateKeyPair('bob', 'kyber');
    expect(JSON.stringify(alice.pk)).not.toBe(JSON.stringify(bob.pk));
  });
});

describe('Session Management', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  test('hasSession should return false for non-existent session', () => {
    expect(hasSession('conv-nonexistent')).toBe(false);
  });

  test('saveSessionFromSharedSecret should create a session', async () => {
    const convId = 'conv-save-test';
    const shared = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test');

    await saveSessionFromSharedSecret(convId, 'kyber', shared, salt, info);
    expect(hasSession(convId)).toBe(true);
  });

  test('loadAesKey should return null for non-existent session', async () => {
    const key = await loadAesKey('conv-nonexistent');
    expect(key).toBeNull();
  });

  test('loadAesKey should return valid CryptoKey for existing session', async () => {
    const convId = 'conv-load-test';
    const shared = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test');

    await saveSessionFromSharedSecret(convId, 'kyber', shared, salt, info);
    const key = await loadAesKey(convId);
    expect(key).not.toBeNull();

    // Verify the key works for encryption
    const { ivB64, ciphertextB64 } = await aesGcmEncrypt('test', key!);
    const decrypted = await aesGcmDecrypt(ivB64, ciphertextB64, key!);
    expect(decrypted).toBe('test');
  });

  test('clearSession should remove session', async () => {
    const convId = 'conv-clear-test';
    const shared = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test');

    await saveSessionFromSharedSecret(convId, 'kyber', shared, salt, info);
    expect(hasSession(convId)).toBe(true);

    clearSession(convId);
    expect(hasSession(convId)).toBe(false);
  });
});

describe('Full E2EE Handshake Flows', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  async function testHandshake(alg: KemAlg) {
    const conversationId = `conv-${alg}-handshake`;

    // Step 1: Alice generates key pair and creates HELLO
    const aliceKp = await getOrCreateKeyPair('alice', alg);
    const helloContent = makeHello(alg, aliceKp.pk);

    // Step 2: Bob receives HELLO and creates KEY reply
    const hello = tryParseEnvelope(helloContent)!;
    expect(hello.type).toBe('E2EE_HELLO');

    const reply = await handleHelloAndCreateKeyReply(conversationId, 'bob', hello as any);
    expect(reply).not.toBeNull();
    expect(hasSession(conversationId)).toBe(true);

    // Step 3: Alice receives KEY and stores session
    const keyEnv = tryParseEnvelope(reply!.replyContent)!;
    expect(keyEnv.type).toBe('E2EE_KEY');

    await handleKeyAndStoreSession(conversationId, 'alice', keyEnv as any);
    expect(hasSession(conversationId)).toBe(true);

    // Step 4: Both parties can encrypt/decrypt messages
    const aliceKey = await loadAesKey(conversationId);
    const bobKey = await loadAesKey(conversationId);
    expect(aliceKey).not.toBeNull();
    expect(bobKey).not.toBeNull();

    // Alice encrypts, Bob decrypts
    const msg = 'Secret message via ' + alg;
    const { ivB64, ciphertextB64 } = await aesGcmEncrypt(msg, aliceKey!);
    const decrypted = await aesGcmDecrypt(ivB64, ciphertextB64, bobKey!);
    expect(decrypted).toBe(msg);
  }

  test('Kyber handshake should complete successfully', async () => {
    await testHandshake('kyber');
  });

  test('Frodo handshake should complete successfully', async () => {
    await testHandshake('frodo');
  });

  test('NTRU handshake should complete successfully', async () => {
    await testHandshake('ntru');
  });

  test('ECDH handshake should complete successfully', async () => {
    await testHandshake('ecdh');
  });
});

describe('Chat Message Encryption/Decryption', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  test('encryptChatMessage should throw without session', async () => {
    await expect(encryptChatMessage('conv-none', 'hello')).rejects.toThrow();
  });

  test('encryptChatMessage should produce E2EE_MSG envelope', async () => {
    // Set up session
    const convId = 'conv-encrypt-test';
    const shared = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test');
    await saveSessionFromSharedSecret(convId, 'kyber', shared, salt, info);

    const encrypted = await encryptChatMessage(convId, 'Hello!');
    const env = tryParseEnvelope(encrypted);
    expect(env).not.toBeNull();
    expect(env!.type).toBe('E2EE_MSG');
    expect((env as any).ivB64).toBeDefined();
    expect((env as any).ciphertextB64).toBeDefined();
  });

  test('decryptChatMessage should decrypt valid E2EE_MSG', async () => {
    const convId = 'conv-decrypt-test';
    const shared = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test');
    await saveSessionFromSharedSecret(convId, 'kyber', shared, salt, info);

    const plaintext = 'This is a secret message!';
    const encrypted = await encryptChatMessage(convId, plaintext);
    const env = tryParseEnvelope(encrypted)!;

    const decrypted = await decryptChatMessage(convId, env as any);
    expect(decrypted).toBe(plaintext);
  });

  test('decryptChatMessage without session should return placeholder', async () => {
    const msg = { type: 'E2EE_MSG' as const, v: 1 as const, ivB64: 'abc', ciphertextB64: 'def' };
    const result = await decryptChatMessage('conv-no-session', msg);
    expect(result).toContain('Encrypted message');
  });

  test('should encrypt and decrypt multiple messages in sequence', async () => {
    const convId = 'conv-multi-msg';
    const shared = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test');
    await saveSessionFromSharedSecret(convId, 'kyber', shared, salt, info);

    const messages = ['First message', 'Second message', 'Third message!'];
    for (const msg of messages) {
      const encrypted = await encryptChatMessage(convId, msg);
      const env = tryParseEnvelope(encrypted)!;
      const decrypted = await decryptChatMessage(convId, env as any);
      expect(decrypted).toBe(msg);
    }
  });

  test('should encrypt and decrypt image messages', async () => {
    const convId = 'conv-img-msg';
    const shared = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const info = new TextEncoder().encode('test');
    await saveSessionFromSharedSecret(convId, 'kyber', shared, salt, info);

    const imageMsg = 'IMG:image/png:iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const encrypted = await encryptChatMessage(convId, imageMsg);
    const env = tryParseEnvelope(encrypted)!;
    const decrypted = await decryptChatMessage(convId, env as any);
    expect(decrypted).toBe(imageMsg);
    expect(decrypted.startsWith('IMG:')).toBe(true);
  });
});
