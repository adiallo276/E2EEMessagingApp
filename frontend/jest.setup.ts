// Jest setup file
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for TextEncoder/TextDecoder
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock crypto for tests
if (typeof global.crypto === 'undefined') {
  const crypto = require('crypto');
  
  global.crypto = {
    getRandomValues: (arr: Uint8Array) => {
      return crypto.randomFillSync(arr);
    },
    subtle: crypto.webcrypto?.subtle,
  } as any;
}
