import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoModeSelector from '../VideoModeSelector';

// Mock constants
jest.mock('../../../constants', () => ({
    STREAM_MODES: {
        LIVE: 'live',
        VIDEO: 'video'
    }
}));

describe('VideoModeSelector Component', () => {
    const mockOnStreamModeChange = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renders correctly with default props', () => {
        render(
            <VideoModeSelector 
                streamMode="video" 
                onStreamModeChange={mockOnStreamModeChange}
            />
        );

        expect(screen.getByText('מצב שידור מצלמת הכניסה')).toBeInTheDocument();
        expect(screen.getByText('שידור קובץ וידאו לדוגמה (ברירת מחדל)')).toBeInTheDocument();
        expect(screen.getByText('שידור חי מהמצלמה')).toBeInTheDocument();
    });

    test('selects video mode by default', () => {
        render(
            <VideoModeSelector 
                streamMode="video" 
                onStreamModeChange={mockOnStreamModeChange}
            />
        );

        const videoRadio = screen.getByRole('radio', { name: /שידור קובץ וידאו לדוגמה/ });
        const liveRadio = screen.getByRole('radio', { name: /שידור חי מהמצלמה/ });

        expect(videoRadio).toBeChecked();
        expect(liveRadio).not.toBeChecked();
    });

    test('selects live mode when specified', () => {
        render(
            <VideoModeSelector 
                streamMode="live" 
                onStreamModeChange={mockOnStreamModeChange}
            />
        );

        const videoRadio = screen.getByRole('radio', { name: /שידור קובץ וידאו לדוגמה/ });
        const liveRadio = screen.getByRole('radio', { name: /שידור חי מהמצלמה/ });

        expect(videoRadio).not.toBeChecked();
        expect(liveRadio).toBeChecked();
    });

    test('calls onStreamModeChange when video mode is selected', () => {
        render(
            <VideoModeSelector 
                streamMode="live" 
                onStreamModeChange={mockOnStreamModeChange}
            />
        );

        const videoRadio = screen.getByRole('radio', { name: /שידור קובץ וידאו לדוגמה/ });
        fireEvent.click(videoRadio);

        expect(mockOnStreamModeChange).toHaveBeenCalledWith('video');
        expect(mockOnStreamModeChange).toHaveBeenCalledTimes(1);
    });

    test('calls onStreamModeChange when live mode is selected', () => {
        render(
            <VideoModeSelector 
                streamMode="video" 
                onStreamModeChange={mockOnStreamModeChange}
            />
        );

        const liveRadio = screen.getByRole('radio', { name: /שידור חי מהמצלמה/ });
        fireEvent.click(liveRadio);

        expect(mockOnStreamModeChange).toHaveBeenCalledWith('live');
        expect(mockOnStreamModeChange).toHaveBeenCalledTimes(1);
    });

    test('does not crash when onStreamModeChange is not provided', () => {
        render(
            <VideoModeSelector 
                streamMode="video" 
                onStreamModeChange={null}
            />
        );

        const liveRadio = screen.getByRole('radio', { name: /שידור חי מהמצלמה/ });
        
        expect(() => {
            fireEvent.click(liveRadio);
        }).not.toThrow();
    });

    test('does not crash when onStreamModeChange is undefined', () => {
        render(
            <VideoModeSelector 
                streamMode="video" 
            />
        );

        const liveRadio = screen.getByRole('radio', { name: /שידור חי מהמצלמה/ });
        
        expect(() => {
            fireEvent.click(liveRadio);
        }).not.toThrow();
    });

    test('displays correct description for video mode', () => {
        render(
            <VideoModeSelector 
                streamMode="video" 
                onStreamModeChange={mockOnStreamModeChange}
            />
        );

        expect(screen.getByText(/קובץ הווידאו ישודר בלולאה/)).toBeInTheDocument();
        expect(screen.getByText(/החלף את הקובץ בתיקיית public\/sample-videos\//)).toBeInTheDocument();
    });

    test('displays correct description for live mode', () => {
        render(
            <VideoModeSelector 
                streamMode="live" 
                onStreamModeChange={mockOnStreamModeChange}
            />
        );

        expect(screen.getByText('המצלמה הנבחרת תשדר בזמן אמת')).toBeInTheDocument();
    });

    test('displays info box with event detection explanation', () => {
        render(
            <VideoModeSelector 
                streamMode="video" 
                onStreamModeChange={mockOnStreamModeChange}
            />
        );

        expect(screen.getByText('🎯 זיהוי אירועים מבוסס קו מרכזי')).toBeInTheDocument();
        expect(screen.getByText(/קו צהוב במרכז המסך/)).toBeInTheDocument();
        expect(screen.getByText('התחלת אירוע:')).toBeInTheDocument();
        expect(screen.getByText(/דבורה עוברת מימין לשמאל.*יוצאת מהכוורת/)).toBeInTheDocument();
        expect(screen.getByText('סיום אירוע:')).toBeInTheDocument();
        expect(screen.getByText(/דבורה עוברת משמאל לימין.*חוזרת לכוורת/)).toBeInTheDocument();
    });

    test('has correct container styling', () => {
        render(
            <VideoModeSelector 
                streamMode="video" 
                onStreamModeChange={mockOnStreamModeChange}
            />
        );

        const container = screen.getByText('מצב שידור מצלמת הכניסה').parentElement;
        expect(container).toHaveStyle({
            marginBottom: '1.5rem',
            padding: '1rem',
            backgroundColor: '#f0f8ff',
            borderRadius: '6px',
            border: '1px solid #ddd'
        });
    });

    test('radio inputs have correct name attribute', () => {
        render(
            <VideoModeSelector 
                streamMode="video" 
                onStreamModeChange={mockOnStreamModeChange}
            />
        );

        const videoRadio = screen.getByRole('radio', { name: /שידור קובץ וידאו לדוגמה/ });
        const liveRadio = screen.getByRole('radio', { name: /שידור חי מהמצלמה/ });

        expect(videoRadio).toHaveAttribute('name', 'streamMode');
        expect(liveRadio).toHaveAttribute('name', 'streamMode');
    });

    test('radio inputs have correct values', () => {
        render(
            <VideoModeSelector 
                streamMode="video" 
                onStreamModeChange={mockOnStreamModeChange}
            />
        );

        const videoRadio = screen.getByRole('radio', { name: /שידור קובץ וידאו לדוגמה/ });
        const liveRadio = screen.getByRole('radio', { name: /שידור חי מהמצלמה/ });

        expect(videoRadio).toHaveAttribute('value', 'video');
        expect(liveRadio).toHaveAttribute('value', 'live');
    });
});