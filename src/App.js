/* eslint-disable no-console */
import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import TrackPage from './pages/TrackPage';
import SettingsPage from './pages/SettingsPage';
import DebugPage from './pages/DebugPage';
import TestPage from './pages/TestPage';
import { ServiceManager } from './services';

function App() {
  const [servicesInitialized, setServicesInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState(null);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('🚀 [App] Initializing services...');
        
        // Add service manager event listeners
        ServiceManager.addEventListener('initialized', () => {
          console.log('✅ [App] All services initialized successfully');
          setServicesInitialized(true);
        });

        ServiceManager.addEventListener('initializationError', (error) => {
          console.error('❌ [App] Service initialization failed:', error);
          setInitializationError(error);
          setServicesInitialized(false);
        });

        ServiceManager.addEventListener('serviceError', (errorInfo) => {
          console.error('⚠️ [App] Service error:', errorInfo);
        });

        // Initialize services
        const success = await ServiceManager.initialize();
        if (!success) {
          setInitializationError(new Error('Failed to initialize services'));
        }
      } catch (error) {
        console.error('💥 [App] Error during service initialization:', error);
        setInitializationError(error);
      }
    };

    initializeServices();

    // Cleanup on unmount
    return () => {
      console.log('🧹 [App] Cleaning up services...');
      ServiceManager.destroy();
    };
  }, []);

  // Show loading screen while services are initializing
  if (!servicesInitialized && !initializationError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        fontFamily: 'Arial, sans-serif'
      }}>
        <div style={{
          fontSize: '2rem',
          marginBottom: '1rem',
          color: '#343a40'
        }}>
          🐝 Queen Track
        </div>
        <div style={{
          fontSize: '1.2rem',
          marginBottom: '2rem',
          color: '#6c757d'
        }}>
          מאתחל שירותים...
        </div>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid #f3f3f3',
          borderTop: '3px solid #007bff',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  // Show error screen if initialization failed
  if (initializationError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8f9fa',
        fontFamily: 'Arial, sans-serif',
        padding: '2rem'
      }}>
        <div style={{
          fontSize: '2rem',
          marginBottom: '1rem',
          color: '#dc3545'
        }}>
          ⚠️ שגיאה באתחול
        </div>
        <div style={{
          fontSize: '1.1rem',
          marginBottom: '2rem',
          color: '#6c757d',
          textAlign: 'center',
          maxWidth: '600px'
        }}>
          אירעה שגיאה באתחול השירותים. אנא רענן את הדף ונסה שוב.
        </div>
        <button 
          onClick={() => window.location.reload()}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          רענן דף
        </button>
        <details style={{ marginTop: '2rem', maxWidth: '600px' }}>
          <summary style={{ cursor: 'pointer', color: '#6c757d' }}>
            פרטי שגיאה טכניים
          </summary>
          <pre style={{
            backgroundColor: '#f8f9fa',
            padding: '1rem',
            borderRadius: '4px',
            fontSize: '0.9rem',
            overflow: 'auto',
            marginTop: '1rem'
          }}>
            {JSON.stringify(initializationError, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  // Render main app when services are ready
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/debug" element={<DebugPage />} />
        <Route path="/test" element={<TestPage />} />
      </Routes>
    </Router>
  );
}

export default App;
