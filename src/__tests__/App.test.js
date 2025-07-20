import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import App from '../App';

// Mock the components to avoid complex dependencies in integration tests
jest.mock('../components/Navbar', () => {
    return function MockNavbar() {
        return <nav data-testid="navbar">Mock Navbar</nav>;
    };
});

jest.mock('../pages/HomePage', () => {
    return function MockHomePage() {
        return <div data-testid="home-page">Mock Home Page</div>;
    };
});

jest.mock('../pages/UploadPage', () => {
    return function MockUploadPage() {
        return <div data-testid="upload-page">Mock Upload Page</div>;
    };
});

jest.mock('../pages/TrackPage', () => {
    return function MockTrackPage() {
        return <div data-testid="track-page">Mock Track Page</div>;
    };
});

jest.mock('../pages/SettingsPage', () => {
    return function MockSettingsPage() {
        return <div data-testid="settings-page">Mock Settings Page</div>;
    };
});

jest.mock('../pages/DebugPage', () => {
    return function MockDebugPage() {
        return <div data-testid="debug-page">Mock Debug Page</div>;
    };
});

jest.mock('../pages/TestPage', () => {
    return function MockTestPage() {
        return <div data-testid="test-page">Mock Test Page</div>;
    };
});

const renderWithRouter = async (initialEntries = ['/']) => {
    const view = render(
        <MemoryRouter initialEntries={initialEntries}>
            <App />
        </MemoryRouter>
    );
    
    // Wait for services to initialize
    await waitFor(() => {
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
    }, { timeout: 3000 });
    
    return view;
};

describe('App Component', () => {
    test.skip('renders App without crashing', async () => {
        await renderWithRouter();
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
    });

    test.skip('renders HomePage on root route', async () => {
        await renderWithRouter(['/']);
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    test.skip('renders UploadPage on /upload route', async () => {
        await renderWithRouter(['/upload']);
        expect(screen.getByTestId('upload-page')).toBeInTheDocument();
    });

    test.skip('renders TrackPage on /track route', async () => {
        await renderWithRouter(['/track']);
        expect(screen.getByTestId('track-page')).toBeInTheDocument();
    });

    test.skip('includes Navbar on all routes', async () => {
        const routes = ['/', '/upload', '/track'];

        for (const route of routes) {
            await renderWithRouter([route]);
            expect(screen.getByTestId('navbar')).toBeInTheDocument();
        }
    });

    test.skip('handles unknown routes gracefully', async () => {
        await renderWithRouter(['/unknown-route']);
        // Should still render navbar and not crash
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        // Should not render any page component for unknown route
        expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
        expect(screen.queryByTestId('upload-page')).not.toBeInTheDocument();
        expect(screen.queryByTestId('track-page')).not.toBeInTheDocument();
    });
}); 