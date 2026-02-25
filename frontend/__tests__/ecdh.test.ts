/**
 * Tests for ECDH (Elliptic Curve Diffie-Hellman) key exchange.
 * ECDH serves as the classical baseline algorithm in the application.
 *
 * Since ecdhKeyGen/ecdhEncapsulate/ecdhDecapsulate are not exported from e2ee.ts,
 * we test them through the E2EE protocol functions (getOrCreateKeyPair, handleHelloAndCreateKeyReply, etc.)
 * and also test the full E2E flow through the exported KEM-style interface.
 */
import {
  getOrCreateKeyPair,
  makeHello,
  tryParseEnvelope,
  handleHelloAndCreateKeyReply,
  handleKeyAndStoreSession,
  loadAesKey,
  clearSession,
  hasSession,
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

describe('ECDH Key Exchange via E2EE Protocol', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  test('should generate ECDH key pair', async () => {
    const kp = await getOrCreateKeyPair('alice', 'ecdh');
    expect(kp).toBeDefined();
    expect(kp.pk).toBeDefined();
    expect(kp.pk.raw).toBeDefined();
    expect(typeof kp.pk.raw).toBe('string'); // base64 string
    expect(kp.sk).toBeDefined();
    expect(kp.sk.jwk).toBeDefined();
  });

  test('should cache ECDH key pair in localStorage', async () => {
    const kp1 = await getOrCreateKeyPair('alice', 'ecdh');
    const kp2 = await getOrCreateKeyPair('alice', 'ecdh');
    expect(kp1.pk.raw).toBe(kp2.pk.raw);
  });

  test('should generate different key pairs for different users', async () => {
    const kpAlice = await getOrCreateKeyPair('alice', 'ecdh');
    const kpBob = await getOrCreateKeyPair('bob', 'ecdh');
    expect(kpAlice.pk.raw).not.toBe(kpBob.pk.raw);
  });

  test('full ECDH E2E handshake should establish shared session', async () => {
    const conversationId = 'conv-ecdh-1';

    // Alice generates key pair and sends HELLO
    const aliceKp = await getOrCreateKeyPair('alice', 'ecdh');
    const helloContent = makeHello('ecdh', aliceKp.pk);
    const hello = tryParseEnvelope(helloContent);
    expect(hello).not.toBeNull();
    expect(hello!.type).toBe('E2EE_HELLO');

    // Bob receives HELLO and creates KEY reply
    const reply = await handleHelloAndCreateKeyReply(conversationId, 'bob', hello as any);
    expect(reply).not.toBeNull();

    // Bob now has a session
    expect(hasSession(conversationId)).toBe(true);

    // Alice receives KEY reply and stores session
    const keyEnvelope = tryParseEnvelope(reply!.replyContent);
    expect(keyEnvelope).not.toBeNull();
    expect(keyEnvelope!.type).toBe('E2EE_KEY');

    await handleKeyAndStoreSession(conversationId, 'alice', keyEnvelope as any);

    // Alice also has a session now
    expect(hasSession(conversationId)).toBe(true);

    // Both should derive the same AES key and be able to encrypt/decrypt
    const aliceKey = await loadAesKey(conversationId);
    expect(aliceKey).not.toBeNull();

    // Test encryption with Alice's key
    const plaintext = 'Hello via ECDH!';
    const { ivB64, ciphertextB64 } = await aesGcmEncrypt(plaintext, aliceKey!);

    // Bob loads his key and decrypts
    const bobKey = await loadAesKey(conversationId);
    expect(bobKey).not.toBeNull();
    const decrypted = await aesGcmDecrypt(ivB64, ciphertextB64, bobKey!);
    expect(decrypted).toBe(plaintext);
  });

  test('clearing session should remove it', async () => {
    const conversationId = 'conv-ecdh-clear';
    const aliceKp = await getOrCreateKeyPair('alice', 'ecdh');
    const helloContent = makeHello('ecdh', aliceKp.pk);
    const hello = tryParseEnvelope(helloContent);
    await handleHelloAndCreateKeyReply(conversationId, 'bob', hello as any);

    expect(hasSession(conversationId)).toBe(true);
    clearSession(conversationId);
    expect(hasSession(conversationId)).toBe(false);
  });
});
