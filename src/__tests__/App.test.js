import React from 'react';
import { render, screen } from '@testing-library/react';
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

const renderWithRouter = (initialEntries = ['/']) => {
    return render(
        <MemoryRouter initialEntries={initialEntries}>
            <App />
        </MemoryRouter>
    );
};

describe('App Component', () => {
    test('renders App without crashing', () => {
        renderWithRouter();
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
    });

    test('renders HomePage on root route', () => {
        renderWithRouter(['/']);
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    test('renders UploadPage on /upload route', () => {
        renderWithRouter(['/upload']);
        expect(screen.getByTestId('upload-page')).toBeInTheDocument();
    });

    test('renders TrackPage on /track route', () => {
        renderWithRouter(['/track']);
        expect(screen.getByTestId('track-page')).toBeInTheDocument();
    });

    test('includes Navbar on all routes', () => {
        const routes = ['/', '/upload', '/track'];

        routes.forEach(route => {
            renderWithRouter([route]);
            expect(screen.getByTestId('navbar')).toBeInTheDocument();
        });
    });

    test('handles unknown routes gracefully', () => {
        renderWithRouter(['/unknown-route']);
        // Should still render navbar and not crash
        expect(screen.getByTestId('navbar')).toBeInTheDocument();
        // Should not render any page component for unknown route
        expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
        expect(screen.queryByTestId('upload-page')).not.toBeInTheDocument();
        expect(screen.queryByTestId('track-page')).not.toBeInTheDocument();
    });
}); 