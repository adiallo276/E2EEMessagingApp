/**
 * Tests for WebSocket connection utility.
 * Tests connection setup, token handling, and error cases.
 */

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

// Mock STOMP Client
const mockActivate = jest.fn();
const mockClient = {
  brokerURL: '',
  reconnectDelay: 0,
  onConnect: null as any,
  activate: mockActivate,
  deactivate: jest.fn(),
  subscribe: jest.fn(),
  publish: jest.fn(),
};

jest.mock('@stomp/stompjs', () => ({
  Client: jest.fn().mockImplementation((config: any) => {
    mockClient.brokerURL = config.brokerURL;
    mockClient.reconnectDelay = config.reconnectDelay;
    return mockClient;
  }),
}));

import { connectWs } from '../lib/ws';

describe('WebSocket Connection', () => {
  beforeEach(() => {
    localStorageMock.clear();
    mockActivate.mockReset();
  });

  test('should throw if no token in localStorage', () => {
    expect(() => connectWs(() => {})).toThrow('No token');
  });

  test('should create STOMP client with correct broker URL', () => {
    localStorageMock.setItem('token', 'my-jwt-token');
    connectWs(() => {});

    expect(mockClient.brokerURL).toBe(
      'ws://localhost:8080/ws?token=my-jwt-token'
    );
  });

  test('should URL-encode the token', () => {
    localStorageMock.setItem('token', 'token with spaces&special=chars');
    connectWs(() => {});

    expect(mockClient.brokerURL).toContain(
      encodeURIComponent('token with spaces&special=chars')
    );
  });

  test('should set reconnect delay to 2000ms', () => {
    localStorageMock.setItem('token', 'test-token');
    connectWs(() => {});

    expect(mockClient.reconnectDelay).toBe(2000);
  });

  test('should call activate on the client', () => {
    localStorageMock.setItem('token', 'test-token');
    connectWs(() => {});

    expect(mockActivate).toHaveBeenCalled();
  });

  test('should return the client instance', () => {
    localStorageMock.setItem('token', 'test-token');
    const client = connectWs(() => {});

    expect(client).toBe(mockClient);
  });

  test('onConnect callback should be set', () => {
    localStorageMock.setItem('token', 'test-token');
    const onConnect = jest.fn();
    connectWs(onConnect);

    expect(mockClient.onConnect).toBeDefined();
    // Simulate connection
    mockClient.onConnect();
    expect(onConnect).toHaveBeenCalledWith(mockClient);
  });
});
