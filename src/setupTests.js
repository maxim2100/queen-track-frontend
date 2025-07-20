// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock HTMLElement methods for React 19 compatibility
Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  value: jest.fn(),
  writable: true
});

// Mock canvas for tests
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Array(4) })),
  putImageData: jest.fn(),
  createImageData: jest.fn(() => ({ data: new Array(4) })),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn(),
}));

// Mock video element
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  value: jest.fn(() => Promise.resolve()),
  writable: true
});

Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
  value: jest.fn(),
  writable: true
});

Object.defineProperty(HTMLVideoElement.prototype, 'load', {
  value: jest.fn(),
  writable: true
});

// Mock navigator.mediaDevices for camera tests
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{ 
        stop: jest.fn(),
        getSettings: () => ({ width: 640, height: 480 }),
        label: 'Mock Camera'
      }],
      getVideoTracks: () => [{ 
        stop: jest.fn(),
        getSettings: () => ({ width: 640, height: 480 }),
        label: 'Mock Camera'
      }]
    })),
    enumerateDevices: jest.fn(() => Promise.resolve([
      { deviceId: 'mock-camera-1', kind: 'videoinput', label: 'Mock Camera 1', groupId: 'group1' },
      { deviceId: 'mock-camera-2', kind: 'videoinput', label: 'Mock Camera 2', groupId: 'group2' }
    ]))
  },
});

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
  onopen: null,
  onclose: null,
  onmessage: null,
  onerror: null,
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => 'mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  })
);

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
global.sessionStorage = localStorageMock;

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Suppress specific console warnings for cleaner test output
/* eslint-disable no-console */
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

console.warn = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('ReactDOM.render') ||
     args[0].includes('Warning: Invalid DOM property') ||
     args[0].includes('Warning: React does not recognize'))
  ) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Mock console methods to reduce noise in tests
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') ||
     args[0].includes('Error: Not implemented') ||
     args[0].includes('An update to'))
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

// Suppress console.log during tests unless needed for debugging
console.log = (...args) => {
  // Allow specific debug messages in development
  if (process.env.NODE_ENV === 'development') {
    originalConsoleLog.apply(console, args);
  }
};
/* eslint-enable no-console */

// ServiceManager mocks are now in individual test files
