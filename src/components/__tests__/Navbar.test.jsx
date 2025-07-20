import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Navbar from '../Navbar';

// Mock WebSocket for Navbar tests specifically
const mockWebSocket = {
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // WebSocket.OPEN
  onopen: null,
  onclose: null,
  onmessage: null,
  onerror: null,
};

// Override the global WebSocket mock for this test suite
global.WebSocket = jest.fn(() => mockWebSocket);

// Mock console.log to suppress WebSocket debug messages
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
});

// Helper function to render component with router
const renderWithRouter = (component) => {
    return render(
        <BrowserRouter>
            {component}
        </BrowserRouter>
    );
};

describe('Navbar Component', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test.skip('renders navbar with brand name', async () => {
        const { unmount } = renderWithRouter(<Navbar />);
        
        await waitFor(() => {
            expect(screen.getByText('Queen Track')).toBeInTheDocument();
        });
        
        unmount();
    });

    test.skip('renders all navigation links', async () => {
        const { unmount } = renderWithRouter(<Navbar />);

        await waitFor(() => {
            expect(screen.getByText('בית')).toBeInTheDocument();
            expect(screen.getByText('העלאה')).toBeInTheDocument();
            expect(screen.getByText('מעקב')).toBeInTheDocument();
        });
        
        unmount();
    });

    test.skip('navigation links have correct paths', async () => {
        const { unmount } = renderWithRouter(<Navbar />);

        await waitFor(() => {
            const homeLink = screen.getByText('בית').closest('a');
            const uploadLink = screen.getByText('העלאה').closest('a');
            const trackLink = screen.getByText('מעקב').closest('a');

            expect(homeLink).toHaveAttribute('href', '/');
            expect(uploadLink).toHaveAttribute('href', '/upload');
            expect(trackLink).toHaveAttribute('href', '/track');
        });
        
        unmount();
    });

    test.skip('renders notification bell', async () => {
        const { unmount } = renderWithRouter(<Navbar />);

        await waitFor(() => {
            expect(screen.getByText('🔔')).toBeInTheDocument();
        });
        
        unmount();
    });

    test.skip('shows notification count when notifications exist', async () => {
        const { unmount } = renderWithRouter(<Navbar />);

        await waitFor(() => {
            // Initially should show 0
            expect(screen.getByText('0')).toBeInTheDocument();
        });
        
        unmount();
    });

    test.skip('navbar has correct styling', async () => {
        const { unmount } = renderWithRouter(<Navbar />);

        await waitFor(() => {
            const nav = screen.getByRole('navigation');
            expect(nav).toBeInTheDocument();
        });
        
        unmount();
    });

    test.skip('component unmounts cleanly without WebSocket errors', () => {
        const { unmount } = renderWithRouter(<Navbar />);
        
        // Should not throw any errors during unmount
        expect(() => unmount()).not.toThrow();
        
        // Verify WebSocket close was called
        expect(mockWebSocket.close).toHaveBeenCalled();
    });
}); 