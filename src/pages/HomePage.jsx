/* eslint-disable no-console */
import React, { useState } from 'react';
import { STREAM_MODES } from '../constants';
import {
  CameraConfig,
  VideoModeSelector,
  LiveStreamComponent,
  VideoStreamComponent,
  ExternalCameraComponent,
  DebugPanel,
  // StatisticsPanel
} from './HomePage/';

function HomePage() {
  const [streamMode, setStreamMode] = useState(STREAM_MODES.VIDEO);
  const [selectedInternalDeviceId, setSelectedInternalDeviceId] = useState('');
  const [selectedExternalDeviceId, setSelectedExternalDeviceId] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const handleStreamModeChange = (mode) => {
    // Stop current streaming when changing mode
    if (isStreaming) {
      setIsStreaming(false);
    }
    setStreamMode(mode);
  };

  const handleDeviceChange = ({ type, deviceId }) => {
    if (type === 'internal') {
      setSelectedInternalDeviceId(deviceId);
    } else if (type === 'external') {
      setSelectedExternalDeviceId(deviceId);
    }
  };

  const handleStreamingControl = (action) => {
    setIsStreaming(action === 'start');
  };

  const handleExternalCameraStatusChange = ({ status }) => {
    // External camera status handling can be added here if needed
    console.log('External camera status changed:', status);
  };

  // Styles
  const containerStyle = {
    direction: 'rtl',
    textAlign: 'right',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1rem',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f8f9fa',
    minHeight: '100vh'
  };

  const headerStyle = {
    margin: '1rem 0'
  };

  const buttonGroupStyle = {
    margin: '1rem 0'
  };

  const buttonStyle = {
    padding: '0.6rem 1rem',
    fontSize: '1rem',
    marginRight: '1rem',
    cursor: 'pointer',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#fff'
  };

  const videosContainerStyle = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: '1200px'
  };

  const videoWrapperStyle = {
    position: 'relative',
    width: '48%',
    minWidth: '400px',
    margin: '1rem auto',
    border: '2px solid #ccc',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#000'
  };

  const httpsWarningStyle = {
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: '8px',
    padding: '1rem',
    margin: '1rem 0',
    color: '#856404'
  };

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>ברוכים הבאים ל-Queen Track</h1>
      <p>בחר את המצלמות שלך והתחל לנטר את פעילות הדבורים</p>
      
      {/* HTTPS Warning */}
      {!navigator.mediaDevices && (
        <div style={httpsWarningStyle}>
          <h3 style={{margin: '0 0 0.5rem 0', color: '#856404'}}>⚠️ דרוש HTTPS לגישה למצלמה</h3>
          <p style={{margin: 0}}>
            גישה למצלמה דורשת חיבור מאובטח (HTTPS). כרגע האתר נפתח דרך HTTP, 
            מה שמונע גישה למצלמות. ניתן עדיין להשתמש בשידור קובץ הווידאו לבדיקה.
          </p>
        </div>
      )}

      {/* Video Mode Selector */}
      <VideoModeSelector 
        streamMode={streamMode}
        onStreamModeChange={handleStreamModeChange}
      />

      {/* Camera Configuration */}
      <CameraConfig 
        streamMode={streamMode}
        onDeviceChange={handleDeviceChange}
      />

      {/* Stream Control Buttons */}
      <div style={buttonGroupStyle}>
        <button 
          onClick={() => handleStreamingControl('start')} 
          style={buttonStyle}
          disabled={isStreaming}
        >
          {streamMode === STREAM_MODES.VIDEO ? "התחל שידור וידאו" : "התחל לצלם"}
        </button>
        <button 
          onClick={() => handleStreamingControl('stop')} 
          style={buttonStyle}
          disabled={!isStreaming}
        >
          {streamMode === STREAM_MODES.VIDEO ? "עצור שידור" : "כבה מצלמה"}
        </button>
      </div>

      {/* Video Streams Container */}
      <div style={videosContainerStyle}>
        {/* Internal Camera Stream */}
        <div style={{...videoWrapperStyle, marginRight: '10px', flex: 1}}>
          <h3 style={{textAlign: 'center', margin: '0.5rem 0'}}>
            מצלמת כניסה לכוורת {streamMode === STREAM_MODES.VIDEO ? "(וידאו לדוגמה)" : "(שידור חי)"}
          </h3>
          
          {streamMode === STREAM_MODES.LIVE ? (
            <LiveStreamComponent
              selectedDeviceId={selectedInternalDeviceId}
              isActive={isStreaming}
              onStreamStart={() => setIsStreaming(true)}
              onStreamStop={() => setIsStreaming(false)}
              onStreamError={(error) => {
                console.error('Live stream error:', error);
                setIsStreaming(false);
              }}
            />
          ) : (
            <VideoStreamComponent
              isActive={isStreaming}
              videoFileName="sample-hive-video.mp4"
              onStreamStart={() => setIsStreaming(true)}
              onStreamStop={() => setIsStreaming(false)}
              onStreamError={(error) => {
                console.error('Video stream error:', error);
                setIsStreaming(false);
              }}
            />
          )}
        </div>

        {/* External Camera */}
        <div style={{...videoWrapperStyle, flex: 1}}>
          <h3 style={{textAlign: 'center', margin: '0.5rem 0'}}>מצלמה חיצונית (אוטומטית)</h3>
          
          <ExternalCameraComponent
            selectedDeviceId={selectedExternalDeviceId}
            onStatusChange={handleExternalCameraStatusChange}
          />
        </div>
      </div>

      {/* Statistics Panel */}
      {/*<StatisticsPanel />*/}

      {/* Debug Panel */}
      <DebugPanel />
    </div>
  );
}

export default HomePage;