// Jest setup file for Node test environment
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder/TextDecoder (Node 18+ has them but just in case)
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as any;
}

// Node 18+ has globalThis.crypto with subtle, but some versions need the polyfill
if (!globalThis.crypto?.subtle) {
  const { webcrypto } = require('crypto');
  // @ts-ignore
  globalThis.crypto = webcrypto;
}

// Ensure btoa/atob are available (Node 16+)
if (typeof globalThis.btoa === 'undefined') {
  globalThis.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
  globalThis.atob = (b64: string) => Buffer.from(b64, 'base64').toString('binary');
}
