import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import App from './App';

// Mock ServiceManager directly in the test file
jest.mock('./services', () => {
  const listeners = new Map();
  
  const mockServiceManager = {
    listeners,
    
    initialize: jest.fn(async () => {
      // Trigger the 'initialized' event immediately 
      setTimeout(() => {
        if (listeners.has('initialized')) {
          listeners.get('initialized').forEach(callback => {
            try {
              callback();
            } catch (error) {
              console.error('Error in initialized callback:', error);
            }
          });
        }
      }, 0);
      return true;
    }),
    
    addEventListener: jest.fn((event, callback) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(callback);
    }),
    
    removeEventListener: jest.fn((event, callback) => {
      if (listeners.has(event)) {
        listeners.get(event).delete(callback);
      }
    }),
    
    isInitialized: jest.fn().mockReturnValue(true),
    destroy: jest.fn(),
    
    emitEvent: jest.fn((eventType, data) => {
      if (listeners.has(eventType)) {
        listeners.get(eventType).forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Error in ServiceManager event listener for ${eventType}:`, error);
          }
        });
      }
    }),
  };
  
  return {
    ServiceManager: mockServiceManager,
  };
});

// Mock all page components to avoid dependencies
jest.mock('./components/Navbar', () => {
    return function MockNavbar() {
        return <nav data-testid="navbar">Mock Navbar</nav>;
    };
});

jest.mock('./pages/HomePage', () => {
    return function MockHomePage() {
        return <div data-testid="home-page">Queen Track Home</div>;
    };
});

jest.mock('./pages/UploadPage', () => {
    return function MockUploadPage() {
        return <div data-testid="upload-page">Mock Upload Page</div>;
    };
});

jest.mock('./pages/TrackPage', () => {
    return function MockTrackPage() {
        return <div data-testid="track-page">Mock Track Page</div>;
    };
});

jest.mock('./pages/SettingsPage', () => {
    return function MockSettingsPage() {
        return <div data-testid="settings-page">Mock Settings Page</div>;
    };
});

jest.mock('./pages/DebugPage', () => {
    return function MockDebugPage() {
        return <div data-testid="debug-page">Mock Debug Page</div>;
    };
});

jest.mock('./pages/TestPage', () => {
    return function MockTestPage() {
        return <div data-testid="test-page">Mock Test Page</div>;
    };
});

test.skip('renders Queen Track app', async () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>
  );

  await waitFor(() => {
    const navElement = screen.getByTestId('navbar');
    expect(navElement).toBeInTheDocument();
  }, { timeout: 3000 });

  const homeElement = screen.getByTestId('home-page');
  expect(homeElement).toBeInTheDocument();
  expect(homeElement).toHaveTextContent('Queen Track Home');
});
