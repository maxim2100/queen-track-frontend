import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Custom render function that includes Router
export const renderWithRouter = (ui, options = {}) => {
    const { initialEntries = ['/'], ...renderOptions } = options;

    const Wrapper = ({ children }) => (
        <MemoryRouter initialEntries={initialEntries}>
            {children}
        </MemoryRouter>
    );

    return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock fetch helper
export const mockFetch = (response, shouldReject = false) => {
    if (shouldReject) {
        return jest.fn().mockRejectedValue(new Error(response));
    }

    return jest.fn().mockResolvedValue({
        ok: true,
        json: async () => response,
        status: 200
    });
};

// Mock WebSocket helper
export const createMockWebSocket = () => {
    const mockWS = {
        send: jest.fn(),
        close: jest.fn(),
        readyState: WebSocket.OPEN,
        onmessage: null,
        onclose: null,
        onerror: null,
        onopen: null
    };

    global.WebSocket = jest.fn(() => mockWS);
    return mockWS;
};

// Mock MediaDevices helper
export const createMockMediaDevices = (devices = []) => {
    const defaultDevices = [
        { deviceId: 'camera1', kind: 'videoinput', label: 'Camera 1' },
        { deviceId: 'camera2', kind: 'videoinput', label: 'Camera 2' }
    ];

    const mockMediaDevices = {
        enumerateDevices: jest.fn().mockResolvedValue(devices.length > 0 ? devices : defaultDevices),
        getUserMedia: jest.fn().mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }]
        })
    };

    global.navigator.mediaDevices = mockMediaDevices;
    return mockMediaDevices;
};

// Mock DOM elements helper
export const mockDOMElements = () => {
    global.document.createElement = jest.fn((tagName) => {
        if (tagName === 'canvas') {
            return {
                getContext: jest.fn(() => ({
                    drawImage: jest.fn()
                })),
                toBlob: jest.fn((callback) => callback(new Blob())),
                width: 640,
                height: 480
            };
        }
        if (tagName === 'video') {
            return {
                srcObject: null,
                videoWidth: 640,
                videoHeight: 480,
                play: jest.fn().mockResolvedValue(),
                pause: jest.fn(),
                load: jest.fn()
            };
        }
        return {};
    });
};

// Wait for async operations
export const waitForAsync = (timeout = 1000) => {
    return new Promise(resolve => setTimeout(resolve, timeout));
};

// Create mock file
export const createMockFile = (name = 'test.mp4', type = 'video/mp4', content = 'mock content') => {
    return new File([content], name, { type });
};

// Mock console methods
export const mockConsole = () => {
    const originalConsole = { ...console };

    // eslint-disable-next-line no-console
    console.log = jest.fn();
    // eslint-disable-next-line no-console
    console.error = jest.fn();
    // eslint-disable-next-line no-console
    console.warn = jest.fn();

    return {
        restore: () => {
            Object.assign(console, originalConsole);
        }
    };
};

// Test data generators
export const generateMockEvents = (count = 3) => {
    return Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        time_out: new Date(Date.now() - (count - index) * 3600000).toISOString(),
        time_in: index < count - 1 ? new Date(Date.now() - (count - index - 1) * 3600000).toISOString() : null,
        video_url: `/videos/event${index + 1}.mp4`
    }));
};

// Environment variable helpers
export const mockEnvVars = (vars = {}) => {
    const originalEnv = process.env;

    process.env = {
        ...originalEnv,
        REACT_APP_BACKEND_URL: 'http://localhost:8000',
        REACT_APP_WEBSOCKET_URL: 'ws://localhost:8000',
        REACT_APP_ENV: 'test',
        ...vars
    };

    return {
        restore: () => {
            process.env = originalEnv;
        }
    };
};

// Setup function for complex tests
export const setupTestEnvironment = () => {
    const mockWS = createMockWebSocket();
    const mockMedia = createMockMediaDevices();
    const mockFetchFn = mockFetch({ success: true });
    const mockConsoleHelper = mockConsole();

    global.fetch = mockFetchFn;
    global.alert = jest.fn();

    mockDOMElements();

    return {
        mockWS,
        mockMedia,
        mockFetchFn,
        cleanup: () => {
            jest.clearAllMocks();
            mockConsoleHelper.restore();
        }
    };
};

// Custom matchers for better test assertions
export const customMatchers = {
    toBeValidUrl: (received) => {
        try {
            new URL(received);
            return {
                message: () => `expected ${received} to not be a valid URL`,
                pass: true
            };
        } catch {
            return {
                message: () => `expected ${received} to be a valid URL`,
                pass: false
            };
        }
    },

    toHaveBeenCalledWithFormData: (received) => {
        const calls = received.mock.calls;
        const hasFormDataCall = calls.some(call =>
            call.some(arg => arg instanceof FormData)
        );

        return {
            message: () => `expected function to ${hasFormDataCall ? 'not ' : ''}have been called with FormData`,
            pass: hasFormDataCall
        };
    }
}; 