import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import Navbar from '../Navbar';

// Helper function to render component with router
const renderWithRouter = (component) => {
    return render(
        <BrowserRouter>
            {component}
        </BrowserRouter>
    );
};

describe('Navbar Component', () => {
    test('renders navbar with brand name', () => {
        renderWithRouter(<Navbar />);
        expect(screen.getByText('Queen Track')).toBeInTheDocument();
    });

    test('renders all navigation links', () => {
        renderWithRouter(<Navbar />);

        expect(screen.getByText('בית')).toBeInTheDocument();
        expect(screen.getByText('העלאה')).toBeInTheDocument();
        expect(screen.getByText('מעקב')).toBeInTheDocument();
    });

    test('navigation links have correct paths', () => {
        renderWithRouter(<Navbar />);

        const homeLink = screen.getByText('בית').closest('a');
        const uploadLink = screen.getByText('העלאה').closest('a');
        const trackLink = screen.getByText('מעקב').closest('a');

        expect(homeLink).toHaveAttribute('href', '/');
        expect(uploadLink).toHaveAttribute('href', '/upload');
        expect(trackLink).toHaveAttribute('href', '/track');
    });

    test('hover effects work on navigation links', () => {
        renderWithRouter(<Navbar />);

        const homeLink = screen.getByText('בית');

        // Test hover effect
        fireEvent.mouseOver(homeLink);
        expect(homeLink).toHaveStyle('color: #007bff');

        // Test mouse out effect
        fireEvent.mouseOut(homeLink);
        expect(homeLink).toHaveStyle('color: #333');
    });

    test('navbar has correct styling', () => {
        renderWithRouter(<Navbar />);

        const nav = screen.getByRole('navigation');
        expect(nav).toHaveStyle({
            backgroundColor: '#EEE',
            direction: 'rtl'
        });
    });
}); 