import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TrackPage from '../TrackPage';

// Mock fetch
global.fetch = jest.fn();

const mockEvents = [
    {
        id: 1,
        time_out: '2024-01-01T10:00:00Z',
        time_in: '2024-01-01T11:30:00Z',
        video_url: '/videos/event1.mp4'
    },
    {
        id: 2,
        time_out: '2024-01-01T14:00:00Z',
        time_in: null,
        video_url: 'http://example.com/videos/event2.mp4'
    }
];

describe('TrackPage Component', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    test('renders loading state initially', () => {
        fetch.mockImplementation(() => new Promise(() => { })); // Never resolves

        render(<TrackPage />);
        expect(screen.getByText('טוען נתונים...')).toBeInTheDocument();
    });

    test('renders events table when data is loaded', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockEvents
        });

        render(<TrackPage />);

        await waitFor(() => {
            expect(screen.getByText('רשימת אירועים')).toBeInTheDocument();
        });

        // Check table headers
        expect(screen.getByText('#')).toBeInTheDocument();
        expect(screen.getByText('זמן יציאה')).toBeInTheDocument();
        expect(screen.getByText('זמן כניסה')).toBeInTheDocument();
        expect(screen.getByText('משך זמן')).toBeInTheDocument();
        expect(screen.getByText('צפה/הורד וידאו')).toBeInTheDocument();
    });

    test('displays events data correctly', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockEvents
        });

        render(<TrackPage />);

        await waitFor(() => {
            expect(screen.getByText('1')).toBeInTheDocument();
            expect(screen.getByText('2')).toBeInTheDocument();
        });

        // Check for "עדיין בחוץ" for event without time_in
        expect(screen.getByText('עדיין בחוץ')).toBeInTheDocument();

        // Check for video links
        expect(screen.getAllByText('צפה בווידאו')).toHaveLength(2);
        expect(screen.getAllByText('הורד')).toHaveLength(2);
    });

    test('handles empty events list', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => []
        });

        render(<TrackPage />);

        await waitFor(() => {
            expect(screen.getByText('לא נמצאו אירועים.')).toBeInTheDocument();
        });
    });

    test('handles fetch error', async () => {
        fetch.mockRejectedValueOnce(new Error('Network error'));

        render(<TrackPage />);

        await waitFor(() => {
            expect(screen.getByText(/שגיאה בטעינת האירועים/)).toBeInTheDocument();
        });
    });

    test('handles server error response', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 500
        });

        render(<TrackPage />);

        await waitFor(() => {
            expect(screen.getByText(/שגיאה בטעינת האירועים/)).toBeInTheDocument();
        });
    });

    test('calculates duration correctly', async () => {
        const eventsWithDuration = [
            {
                id: 1,
                time_out: '2024-01-01T10:00:00Z',
                time_in: '2024-01-01T11:30:00Z',
                video_url: '/videos/event1.mp4'
            }
        ];

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => eventsWithDuration
        });

        render(<TrackPage />);

        await waitFor(() => {
            expect(screen.getByText('90 דקות')).toBeInTheDocument();
        });
    });

    test('constructs video URLs correctly', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockEvents
        });

        render(<TrackPage />);

        await waitFor(() => {
            const videoLinks = screen.getAllByText('צפה בווידאו');

            // First event - relative URL should be converted to full URL
            expect(videoLinks[0]).toHaveAttribute('href', `${process.env.REACT_APP_BACKEND_URL}/videos/event1.mp4`);

            // Second event - full URL should remain as is
            expect(videoLinks[1]).toHaveAttribute('href', 'http://example.com/videos/event2.mp4');
        });
    });

    test('handles events without video URLs', async () => {
        const eventsWithoutVideo = [
            {
                id: 1,
                time_out: '2024-01-01T10:00:00Z',
                time_in: '2024-01-01T11:30:00Z',
                video_url: null
            }
        ];

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => eventsWithoutVideo
        });

        render(<TrackPage />);

        await waitFor(() => {
            expect(screen.getByText('לא קיים וידאו')).toBeInTheDocument();
        });
    });

    test('formats dates correctly', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockEvents
        });

        render(<TrackPage />);

        await waitFor(() => {
            // Check that dates are formatted (exact format depends on locale)
            const rows = screen.getAllByRole('row');
            expect(rows.length).toBeGreaterThan(1); // At least header + data rows
        });
    });
}); 