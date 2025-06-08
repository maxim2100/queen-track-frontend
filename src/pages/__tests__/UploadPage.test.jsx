import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import UploadPage from '../UploadPage';

// Mock fetch
global.fetch = jest.fn();

// Mock alert
global.alert = jest.fn();

describe('UploadPage Component', () => {
    beforeEach(() => {
        fetch.mockClear();
        alert.mockClear();
    });

    test('renders upload page correctly', () => {
        render(<UploadPage />);

        expect(screen.getByText('העלאת וידאו')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'העלה' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'העלה' })).toBeInTheDocument();
    });

    test('file input accepts video files only', () => {
        render(<UploadPage />);

        const fileInput = screen.getByRole('button', { name: 'העלה' }).previousSibling;
        expect(fileInput).toHaveAttribute('accept', 'video/*');
        expect(fileInput).toHaveAttribute('type', 'file');
    });

    test('shows alert when trying to upload without selecting file', async () => {
        render(<UploadPage />);

        const uploadButton = screen.getByRole('button', { name: 'העלה' });
        fireEvent.click(uploadButton);

        expect(alert).toHaveBeenCalledWith('אנא בחר קובץ להעלאה');
    });

    test('successful file upload shows success message', async () => {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true })
        });

        render(<UploadPage />);

        const fileInput = screen.getByRole('button', { name: 'העלה' }).previousSibling;
        const uploadButton = screen.getByRole('button', { name: 'העלה' });

        // Create a mock file
        const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });

        // Simulate file selection
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Click upload
        fireEvent.click(uploadButton);

        await waitFor(() => {
            expect(screen.getByText('הקובץ הועלה בהצלחה!')).toBeInTheDocument();
        });

        expect(fetch).toHaveBeenCalledWith(
            `${process.env.REACT_APP_BACKEND_URL}/video/upload`,
            expect.objectContaining({
                method: 'POST',
                body: expect.any(FormData)
            })
        );
    });

    test('failed file upload shows error message', async () => {
        fetch.mockRejectedValueOnce(new Error('Upload failed'));

        render(<UploadPage />);

        const fileInput = screen.getByRole('button', { name: 'העלה' }).previousSibling;
        const uploadButton = screen.getByRole('button', { name: 'העלה' });

        // Create a mock file
        const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });

        // Simulate file selection
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Click upload
        fireEvent.click(uploadButton);

        await waitFor(() => {
            expect(screen.getByText('אירעה שגיאה במהלך ההעלאה.')).toBeInTheDocument();
        });
    });

    test('handles server error response', async () => {
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 500
        });

        render(<UploadPage />);

        const fileInput = screen.getByRole('button', { name: 'העלה' }).previousSibling;
        const uploadButton = screen.getByRole('button', { name: 'העלה' });

        // Create a mock file
        const file = new File(['video content'], 'test-video.mp4', { type: 'video/mp4' });

        // Simulate file selection
        fireEvent.change(fileInput, { target: { files: [file] } });

        // Click upload
        fireEvent.click(uploadButton);

        await waitFor(() => {
            expect(screen.getByText('אירעה שגיאה במהלך ההעלאה.')).toBeInTheDocument();
        });
    });

    test('component has proper styling and layout', () => {
        render(<UploadPage />);

        const container = screen.getByText('העלאת וידאו').closest('div').parentElement;
        expect(container).toHaveStyle({
            direction: 'rtl',
            backgroundColor: '#f8f9fa'
        });
    });
}); 