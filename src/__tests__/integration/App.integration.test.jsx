import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import App from '../../App';

// Mock Web APIs for HomePage
const mockMediaDevices = {
    enumerateDevices: jest.fn().mockResolvedValue([
        { deviceId: 'camera1', kind: 'videoinput', label: 'Camera 1' }
    ]),
    getUserMedia: jest.fn().mockResolvedValue({
        getTracks: () => [{ stop: jest.fn() }]
    })
};

const mockWebSocket = {
    send: jest.fn(),
    close: jest.fn(),
    readyState: WebSocket.OPEN
};

global.navigator.mediaDevices = mockMediaDevices;
global.WebSocket = jest.fn(() => mockWebSocket);
global.fetch = jest.fn();
global.alert = jest.fn();

// Mock canvas for HomePage
global.document.createElement = jest.fn((tagName) => {
    if (tagName === 'canvas') {
        return {
            getContext: () => ({ drawImage: jest.fn() }),
            toBlob: (callback) => callback(new Blob()),
            width: 640,
            height: 480
        };
    }
    return {};
});

const renderApp = (initialEntries = ['/']) => {
    return render(
        <MemoryRouter initialEntries={initialEntries}>
            <App />
        </MemoryRouter>
    );
};

describe('App Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ success: true })
        });
    });

    test('complete user flow: navigation between pages', async () => {
        renderApp();

        // Should start on HomePage
        expect(screen.getByText('Queen Track')).toBeInTheDocument();

        // Navigate to Upload page
        const uploadLink = screen.getByText('העלאה');
        fireEvent.click(uploadLink);

        await waitFor(() => {
            expect(screen.getByText('העלאת וידאו')).toBeInTheDocument();
        });

        // Navigate to Track page
        const trackLink = screen.getByText('מעקב');
        fireEvent.click(trackLink);

        await waitFor(() => {
            expect(screen.getByText('רשימת אירועים')).toBeInTheDocument();
        });

        // Navigate back to Home
        const homeLink = screen.getByText('בית');
        fireEvent.click(homeLink);

        await waitFor(() => {
            expect(screen.getByText(/מצלמה פנימית/)).toBeInTheDocument();
        });
    });

    test('upload page functionality with navigation', async () => {
        renderApp(['/upload']);

        // Should be on upload page
        expect(screen.getByText('העלאת וידאו')).toBeInTheDocument();

        // Test file upload without file
        const uploadButton = screen.getByRole('button', { name: 'העלה' });
        fireEvent.click(uploadButton);

        expect(alert).toHaveBeenCalledWith('אנא בחר קובץ להעלאה');

        // Navigate away and back to ensure state is maintained
        const homeLink = screen.getByText('בית');
        fireEvent.click(homeLink);

        const uploadLinkAgain = screen.getByText('העלאה');
        fireEvent.click(uploadLinkAgain);

        expect(screen.getByText('העלאת וידאו')).toBeInTheDocument();
    });

    test('track page loads and displays error handling', async () => {
        // Mock fetch to fail
        fetch.mockRejectedValueOnce(new Error('Network error'));

        renderApp(['/track']);

        await waitFor(() => {
            expect(screen.getByText(/שגיאה בטעינת האירועים/)).toBeInTheDocument();
        });
    });

    test('track page displays events correctly', async () => {
        const mockEvents = [
            {
                id: 1,
                time_out: '2024-01-01T10:00:00Z',
                time_in: '2024-01-01T11:30:00Z',
                video_url: '/videos/event1.mp4'
            }
        ];

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockEvents
        });

        renderApp(['/track']);

        await waitFor(() => {
            expect(screen.getByText('רשימת אירועים')).toBeInTheDocument();
            expect(screen.getByText('90 דקות')).toBeInTheDocument();
        });
    });

    test('homepage camera functionality integration', async () => {
        renderApp(['/']);

        await waitFor(() => {
            expect(mockMediaDevices.enumerateDevices).toHaveBeenCalled();
        });

        // Test camera start
        const startButton = screen.getByText(/התחל הקלטה/);
        fireEvent.click(startButton);

        await waitFor(() => {
            expect(mockMediaDevices.getUserMedia).toHaveBeenCalled();
        });
    });

    test('navigation preserves app state', async () => {
        renderApp();

        // Start on home page and interact with camera settings
        await waitFor(() => {
            const selects = screen.getAllByRole('combobox');
            if (selects.length > 0) {
                fireEvent.change(selects[0], { target: { value: 'camera1' } });
            }
        });

        // Navigate away and back
        const uploadLink = screen.getByText('העלאה');
        fireEvent.click(uploadLink);

        const homeLink = screen.getByText('בית');
        fireEvent.click(homeLink);

        // Camera settings should be preserved
        await waitFor(() => {
            const selects = screen.getAllByRole('combobox');
            if (selects.length > 0) {
                expect(selects[0].value).toBe('camera1');
            }
        });
    });

    test('error boundaries and graceful degradation', async () => {
        // Mock console.error to avoid test noise
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

        // Test with failing camera access
        mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Camera denied'));

        renderApp();

        const startButton = screen.getByText(/התחל הקלטה/);
        fireEvent.click(startButton);

        // App should not crash
        expect(screen.getByText('Queen Track')).toBeInTheDocument();

        consoleSpy.mockRestore();
    });

    test('responsive behavior and accessibility', () => {
        renderApp();

        // Check that main navigation elements are accessible
        expect(screen.getByRole('navigation')).toBeInTheDocument();

        // All navigation links should be accessible
        const links = screen.getAllByRole('link');
        expect(links.length).toBeGreaterThan(0);

        links.forEach(link => {
            expect(link).toHaveAttribute('href');
        });
    });
}); 