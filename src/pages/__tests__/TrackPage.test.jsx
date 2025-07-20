import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TrackPage from '../TrackPage';

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.confirm and alert
global.confirm = jest.fn();
global.alert = jest.fn();

// Mock the video element and its methods
const mockVideoElement = {
  play: jest.fn(() => Promise.resolve()),
  pause: jest.fn(),
  currentTime: 0,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
};

// Mock createElement to return video elements with required methods
const originalCreateElement = document.createElement;
document.createElement = jest.fn((tagName) => {
  if (tagName === 'video') {
    return mockVideoElement;
  }
  return originalCreateElement.call(document, tagName);
});

describe('TrackPage Component', () => {
  const mockEvents = [
    {
      id: '1',
      time_out: '2024-01-01T10:00:00Z',
      time_in: '2024-01-01T10:30:00Z',
      internal_video_url: 'internal_video_1.mp4',
      external_video_url: 'external_video_1.mp4',
      conversion_status: 'completed',
      internal_video_url_converted: 'internal_video_1_converted.mp4',
      external_video_url_converted: 'external_video_1_converted.mp4'
    },
    {
      id: '2',
      time_out: '2024-01-01T11:00:00Z',
      time_in: null,
      internal_video_url: 'internal_video_2.mp4',
      external_video_url: null,
      conversion_status: 'processing'
    },
    {
      _id: '3',
      time_out: '2024-01-01T12:00:00Z',
      time_in: '2024-01-01T12:15:00Z',
      internal_video_url: null,
      external_video_url: 'external_video_3.mp4',
      conversion_status: 'failed'
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    global.confirm.mockReturnValue(false);
    global.alert.mockClear();
    process.env.REACT_APP_BACKEND_URL = 'http://localhost:8000';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.skip('renders loading state initially', () => {
    fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<TrackPage />);
    
    expect(screen.getByText('טוען נתונים...')).toBeInTheDocument();
  });

  test.skip('renders events successfully after loading', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText('רשימת אירועים')).toBeInTheDocument();
      expect(screen.getByText('אירוע #1')).toBeInTheDocument();
      expect(screen.getByText('אירוע #2')).toBeInTheDocument();
      expect(screen.getByText('אירוע #3')).toBeInTheDocument();
    });
  });

  test.skip('displays correct event information', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents
    });

    render(<TrackPage />);

    await waitFor(() => {
      // Check first event with complete data
      expect(screen.getByText(/זמן יציאה:.*1\/1\/2024.*10:00:00/)).toBeInTheDocument();
      expect(screen.getByText(/זמן כניסה:.*1\/1\/2024.*10:30:00/)).toBeInTheDocument();
      expect(screen.getByText(/משך זמן: 30 דקות/)).toBeInTheDocument();
      
      // Check second event (still outside)
      expect(screen.getByText(/זמן כניסה: עדיין בחוץ/)).toBeInTheDocument();
    });
  });

  test.skip('displays conversion status correctly', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText(/סטטוס המרה: הושלמה/)).toBeInTheDocument();
      expect(screen.getByText(/סטטוס המרה: מתבצעת\.\.\./)).toBeInTheDocument();
      expect(screen.getByText(/סטטוס המרה: נכשלה/)).toBeInTheDocument();
    });
  });

  test.skip('handles fetch error correctly', async () => {
    fetch.mockRejectedValueOnce(new Error('Network error'));

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText(/שגיאה בטעינת האירועים: Network error/)).toBeInTheDocument();
    });
  });

  test.skip('handles fetch response error correctly', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({})
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText(/שגיאה בטעינת האירועים: Failed to fetch events/)).toBeInTheDocument();
    });
  });

  test.skip('shows "no events" message when events array is empty', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText('לא נמצאו אירועים.')).toBeInTheDocument();
    });
  });

  test.skip('shows and hides video sections when toggle button is clicked', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents
    });

    render(<TrackPage />);

    await waitFor(() => {
      const toggleButton = screen.getAllByText('הצג וידאו')[0];
      expect(toggleButton).toBeInTheDocument();
      
      fireEvent.click(toggleButton);
      
      expect(screen.getByText('הסתר וידאו')).toBeInTheDocument();
      expect(screen.getByText('▶ השמע שניהם')).toBeInTheDocument();
      expect(screen.getByText('⏸ עצור שניהם')).toBeInTheDocument();
    });
  });

  test.skip('displays "no video" message for events without videos', async () => {
    const eventsWithoutVideo = [{
      id: '4',
      time_out: '2024-01-01T13:00:00Z',
      time_in: '2024-01-01T13:15:00Z',
      internal_video_url: null,
      external_video_url: null
    }];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => eventsWithoutVideo
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText('לא קיים וידאו')).toBeInTheDocument();
    });
  });

  test.skip('constructs video URLs correctly', async () => {
    const eventsWithDifferentUrls = [
      {
        id: '1',
        time_out: '2024-01-01T10:00:00Z',
        internal_video_url: 'http://example.com/full-url.mp4',
        external_video_url: '/videos/relative-url.mp4'
      },
      {
        id: '2', 
        time_out: '2024-01-01T11:00:00Z',
        internal_video_url: 'just-filename.mp4',
        external_video_url: null
      }
    ];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => eventsWithDifferentUrls
    });

    render(<TrackPage />);

    await waitFor(() => {
      const toggleButton = screen.getAllByText('הצג וידאו')[0];
      fireEvent.click(toggleButton);
    });

    await waitFor(() => {
      const videos = screen.getAllByText('הדפדפן שלך אינו תומך בתגית וידאו.');
      expect(videos.length).toBeGreaterThan(0);
    });
  });

  test.skip('handles video playback controls', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents
    });

    render(<TrackPage />);

    await waitFor(() => {
      const toggleButton = screen.getAllByText('הצג וידאו')[0];
      fireEvent.click(toggleButton);
    });

    await waitFor(() => {
      const playButton = screen.getByText('▶ השמע שניהם');
      const pauseButton = screen.getByText('⏸ עצור שניהם');
      
      fireEvent.click(playButton);
      expect(mockVideoElement.play).toHaveBeenCalled();
      
      fireEvent.click(pauseButton);
      expect(mockVideoElement.pause).toHaveBeenCalled();
    });
  });

  test.skip('handles delete event with confirmation', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents
    });

    render(<TrackPage />);

    await waitFor(() => {
      const deleteButtons = screen.getAllByTitle('מחק אירוע');
      expect(deleteButtons.length).toBe(3);
    });

    // Test cancellation
    global.confirm.mockReturnValueOnce(false);
    const deleteButton = screen.getAllByTitle('מחק אירוע')[0];
    fireEvent.click(deleteButton);
    
    expect(global.confirm).toHaveBeenCalledWith(
      'האם אתה בטוח שברצונך למחוק את האירוע הזה? פעולה זו תמחק את האירוע ואת כל הווידאו הקשור אליו.'
    );
    expect(fetch).toHaveBeenCalledTimes(1); // Only initial fetch
  });

  test.skip('handles successful event deletion', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText('אירוע #1')).toBeInTheDocument();
    });

    // Mock successful deletion
    global.confirm.mockReturnValueOnce(true);
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    });

    const deleteButton = screen.getAllByTitle('מחק אירוע')[0];
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8000/video/events/1',
        { method: 'DELETE' }
      );
      expect(global.alert).toHaveBeenCalledWith('האירוע נמחק בהצלחה');
    });
  });

  test.skip('handles failed event deletion', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText('אירוע #1')).toBeInTheDocument();
    });

    // Mock failed deletion
    global.confirm.mockReturnValueOnce(true);
    fetch.mockResolvedValueOnce({
      ok: false
    });

    const deleteButton = screen.getAllByTitle('מחק אירוע')[0];
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('שגיאה במחיקת האירוע: Failed to delete event');
    });
  });

  test.skip('handles delete network error', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText('אירוע #1')).toBeInTheDocument();
    });

    // Mock network error
    global.confirm.mockReturnValueOnce(true);
    fetch.mockRejectedValueOnce(new Error('Network failure'));

    const deleteButton = screen.getAllByTitle('מחק אירוע')[0];
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('שגיאה במחיקת האירוע: Network failure');
    });
  });

  test.skip('calculates duration correctly for different time spans', async () => {
    const eventsWithDuration = [{
      id: '1',
      time_out: '2024-01-01T10:00:00Z',
      time_in: '2024-01-01T10:05:00Z' // 5 minutes
    }];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => eventsWithDuration
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText(/משך זמן: 5 דקות/)).toBeInTheDocument();
    });
  });

  test.skip('handles events with _id instead of id', async () => {
    const eventWithUnderscore = [{
      _id: 'mongo-id-123',
      time_out: '2024-01-01T10:00:00Z',
      time_in: '2024-01-01T10:30:00Z',
      internal_video_url: 'test.mp4'
    }];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => eventWithUnderscore
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText('אירוע #1')).toBeInTheDocument();
      const deleteButton = screen.getByTitle('מחק אירוע');
      expect(deleteButton).toBeInTheDocument();
    });
  });

  test.skip('shows loading indicator during deletion', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockEvents
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText('אירוע #1')).toBeInTheDocument();
    });

    global.confirm.mockReturnValueOnce(true);
    // Create a promise that we can control
    let resolveDelete;
    const deletePromise = new Promise(resolve => {
      resolveDelete = resolve;
    });
    fetch.mockReturnValueOnce(deletePromise);

    const deleteButton = screen.getAllByTitle('מחק אירוע')[0];
    fireEvent.click(deleteButton);

    // Check loading state
    await waitFor(() => {
      expect(screen.getByText('🔄')).toBeInTheDocument();
    });

    // Complete the deletion
    resolveDelete({
      ok: true,
      json: async () => ({ success: true })
    });

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('האירוע נמחק בהצלחה');
    });
  });

  test.skip('handles conversion status variants', async () => {
    const eventsWithStatuses = [
      { id: '1', time_out: '2024-01-01T10:00:00Z', conversion_status: 'pending' },
      { id: '2', time_out: '2024-01-01T11:00:00Z', conversion_status: 'unknown_status' },
      { id: '3', time_out: '2024-01-01T12:00:00Z' } // no status
    ];

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => eventsWithStatuses
    });

    render(<TrackPage />);

    await waitFor(() => {
      expect(screen.getByText(/סטטוס המרה: ממתינה/)).toBeInTheDocument();
      expect(screen.getByText(/סטטוס המרה: unknown_status/)).toBeInTheDocument();
    });
  });

  test.skip('component unmounts cleanly', () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    });

    const { unmount } = render(<TrackPage />);
    expect(() => unmount()).not.toThrow();
  });
}); 