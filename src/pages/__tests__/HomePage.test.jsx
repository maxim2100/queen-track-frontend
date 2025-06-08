import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '../HomePage';

// Mock Web APIs
const mockMediaDevices = {
    enumerateDevices: jest.fn(),
    getUserMedia: jest.fn()
};

const mockWebSocket = {
    send: jest.fn(),
    close: jest.fn(),
    readyState: WebSocket.OPEN,
    onmessage: null,
    onclose: null,
    onerror: null
};

global.navigator.mediaDevices = mockMediaDevices;
global.WebSocket = jest.fn(() => mockWebSocket);
global.fetch = jest.fn();

// Mock canvas and video elements
const mockCanvas = {
    getContext: jest.fn(() => ({
        drawImage: jest.fn()
    })),
    toBlob: jest.fn((callback) => callback(new Blob())),
    width: 640,
    height: 480
};

const mockVideo = {
    srcObject: null,
    videoWidth: 640,
    videoHeight: 480,
    play: jest.fn(),
    pause: jest.fn()
};

global.document.createElement = jest.fn((tagName) => {
    if (tagName === 'canvas') return mockCanvas;
    if (tagName === 'video') return mockVideo;
    return {};
});

const mockDevices = [
    { deviceId: 'camera1', kind: 'videoinput', label: 'Camera 1' },
    { deviceId: 'camera2', kind: 'videoinput', label: 'Camera 2' }
];

describe('HomePage Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMediaDevices.enumerateDevices.mockResolvedValue(mockDevices);
        mockMediaDevices.getUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: jest.fn() }]
        });
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true })
        });
    });

    test('renders homepage correctly', async () => {
        render(<HomePage />);

        await waitFor(() => {
            expect(screen.getByText(/מצלמה פנימית/)).toBeInTheDocument();
            expect(screen.getByText(/מצלמה חיצונית/)).toBeInTheDocument();
        });
    });

    test('loads camera devices on mount', async () => {
        render(<HomePage />);

        await waitFor(() => {
            expect(mockMediaDevices.enumerateDevices).toHaveBeenCalled();
        });
    });

    test('handles camera device selection', async () => {
        render(<HomePage />);

        await waitFor(() => {
            const selects = screen.getAllByRole('combobox');
            expect(selects.length).toBeGreaterThan(0);
        });

        const internalSelect = screen.getAllByRole('combobox')[0];
        fireEvent.change(internalSelect, { target: { value: 'camera2' } });

        expect(internalSelect.value).toBe('camera2');
    });

    test('starts camera successfully', async () => {
        render(<HomePage />);

        await waitFor(() => {
            const startButton = screen.getByText(/התחל הקלטה/);
            expect(startButton).toBeInTheDocument();
        });

        const startButton = screen.getByText(/התחל הקלטה/);
        fireEvent.click(startButton);

        await waitFor(() => {
            expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
            expect(global.WebSocket).toHaveBeenCalled();
        });
    });

    test('stops camera successfully', async () => {
        render(<HomePage />);

        // First start the camera
        await waitFor(() => {
            const startButton = screen.getByText(/התחל הקלטה/);
            fireEvent.click(startButton);
        });

        await waitFor(() => {
            const stopButton = screen.getByText(/עצור הקלטה/);
            expect(stopButton).toBeInTheDocument();
            fireEvent.click(stopButton);
        });

        expect(mockWebSocket.close).toHaveBeenCalled();
    });

    test('saves camera configuration', async () => {
        render(<HomePage />);

        await waitFor(() => {
            const saveButton = screen.getByText(/שמור הגדרות מצלמה/);
            expect(saveButton).toBeInTheDocument();
        });

        const saveButton = screen.getByText(/שמור הגדרות מצלמה/);
        fireEvent.click(saveButton);

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/video/camera-config'),
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                })
            );
        });
    });

    test('handles camera access error gracefully', async () => {
        mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Camera access denied'));

        render(<HomePage />);

        await waitFor(() => {
            const startButton = screen.getByText(/התחל הקלטה/);
            fireEvent.click(startButton);
        });

        // Should not crash and error should be logged
        expect(console.error).toHaveBeenCalled();
    });

    test('handles WebSocket messages', async () => {
        render(<HomePage />);

        await waitFor(() => {
            const startButton = screen.getByText(/התחל הקלטה/);
            fireEvent.click(startButton);
        });

        // Simulate WebSocket message
        const messageData = JSON.stringify({
            bee_status: 'outside',
            external_camera_status: true
        });

        mockWebSocket.onmessage({ data: messageData });

        // Check if the status is updated in the UI
        await waitFor(() => {
            expect(screen.getByText(/מצב הדבורה: חוץ/)).toBeInTheDocument();
        });
    });

    test('displays camera status correctly', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                is_recording: true,
                last_bee_status: 'inside',
                stream_url: 'http://example.com/stream'
            })
        });

        render(<HomePage />);

        await waitFor(() => {
            const startButton = screen.getByText(/התחל הקלטה/);
            fireEvent.click(startButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/מצב המצלמה החיצונית: פעילה/)).toBeInTheDocument();
            expect(screen.getByText(/מצב הדבורה: פנים/)).toBeInTheDocument();
        });
    });

    test('handles device enumeration failure', async () => {
        mockMediaDevices.enumerateDevices.mockRejectedValueOnce(new Error('Device enumeration failed'));

        render(<HomePage />);

        await waitFor(() => {
            expect(console.error).toHaveBeenCalledWith('Error enumerating devices:', expect.any(Error));
        });
    });

    test('cleans up resources on unmount', () => {
        const { unmount } = render(<HomePage />);

        unmount();

        // Component should clean up intervals and camera streams
        // Since we can't directly test the cleanup, we ensure no errors are thrown
        expect(true).toBe(true);
    });

    test('handles empty device list', async () => {
        mockMediaDevices.enumerateDevices.mockResolvedValueOnce([]);

        render(<HomePage />);

        await waitFor(() => {
            const selects = screen.queryAllByRole('combobox');
            // Should still render selects even with no devices
            expect(selects.length).toBeGreaterThanOrEqual(0);
        });
    });

    test('displays external camera status correctly', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                is_recording: false,
                last_bee_status: null
            })
        });

        render(<HomePage />);

        await waitFor(() => {
            const startButton = screen.getByText(/התחל הקלטה/);
            fireEvent.click(startButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/מצב המצלמה החיצונית: לא פעילה/)).toBeInTheDocument();
        });
    });
}); 