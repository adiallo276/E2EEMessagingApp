/**
 * Tests for the API client utility.
 * Tests request construction, authentication header injection,
 * error handling, and response parsing.
 */

// Mock `window` so that the api() client-side guard passes in Node env
// @ts-ignore
global.window = global;

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

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Set API URL env var
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8080';

import { api } from '../lib/api';

describe('API Client', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockFetch.mockReset();
  });

  test('should make request to correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ data: 'test' }),
    });

    await api('/test-endpoint');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8080/test-endpoint',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  test('should include Authorization header when token exists', async () => {
    localStorageMock.setItem('token', 'test-jwt-token');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
    });

    await api('/conversations/me');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token',
        }),
      })
    );
  });

  test('should not include Authorization header when no token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
    });

    await api('/auth/login');
    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers.Authorization).toBeUndefined();
  });

  test('should parse JSON response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ username: 'alice', token: 'abc123' }),
    });

    const result = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'alice', password: 'pass' }),
    });

    expect(result).toEqual({ username: 'alice', token: 'abc123' });
  });

  test('should return text for non-JSON responses', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/plain' }),
      text: () => Promise.resolve('plain text response'),
    });

    const result = await api('/some-text-endpoint');
    expect(result).toBe('plain text response');
  });

  test('should return null for 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      headers: new Headers(),
    });

    const result = await api('/some-endpoint', { method: 'DELETE' });
    expect(result).toBeNull();
  });

  test('should throw on error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    });

    await expect(api('/conversations/me')).rejects.toThrow('API error 401: Unauthorized');
  });

  test('should throw on 500 error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    });

    await expect(api('/messages/1')).rejects.toThrow('API error 500');
  });

  test('should pass custom headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({}),
    });

    await api('/test', {
      headers: { 'X-Custom-Header': 'custom-value' },
    });

    const callArgs = mockFetch.mock.calls[0][1];
    expect(callArgs.headers['X-Custom-Header']).toBe('custom-value');
    expect(callArgs.headers['Content-Type']).toBe('application/json');
  });

  test('should forward method and body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ id: 1 }),
    });

    const body = JSON.stringify({ username: 'testuser', password: 'pass123' });
    await api('/auth/register', { method: 'POST', body });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        body,
      })
    );
  });
});
