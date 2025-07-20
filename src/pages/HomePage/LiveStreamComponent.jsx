/* eslint-disable no-console */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { CameraService, StreamService } from '../../services';
import { STREAM_MODES } from '../../constants';

const LiveStreamComponent = ({ 
  selectedDeviceId, 
  isActive, 
  onStreamStart, 
  onStreamStop, 
  onStreamError 
}) => {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingState, setStreamingState] = useState({});
  const [isSharedWithExternal, setIsSharedWithExternal] = useState(false);

  useEffect(() => {
    // Listen for stream service events
    const handleStreamingStarted = () => {
      setIsStreaming(true);
      if (onStreamStart) onStreamStart();
    };

    const handleStreamingStopped = () => {
      setIsStreaming(false);
      if (onStreamStop) onStreamStop();
    };

    const handleStreamingError = (error) => {
      setIsStreaming(false);
      if (onStreamError) onStreamError(error);
    };

    const handleStateUpdated = (state) => {
      setStreamingState(state);
    };

    const handleStreamShared = ({ sharedStream, internalDeviceId, externalDeviceId }) => {
      if (internalDeviceId === selectedDeviceId) {
        setIsSharedWithExternal(sharedStream);
        console.log('🔄 [Internal Camera] Stream is being shared with external camera');
      }
    };

    // Add event listeners
    StreamService.addEventListener('streamingStarted', handleStreamingStarted);
    StreamService.addEventListener('streamingStopped', handleStreamingStopped);
    StreamService.addEventListener('streamingError', handleStreamingError);
    StreamService.addEventListener('stateUpdated', handleStateUpdated);
    
    // Listen for stream sharing events from CameraService
    CameraService.addEventListener('streamShared', handleStreamShared);

    // Get initial state
    setStreamingState(StreamService.getStreamingState());

    // Cleanup
    return () => {
      StreamService.removeEventListener('streamingStarted', handleStreamingStarted);
      StreamService.removeEventListener('streamingStopped', handleStreamingStopped);
      StreamService.removeEventListener('streamingError', handleStreamingError);
      StreamService.removeEventListener('stateUpdated', handleStateUpdated);
      CameraService.removeEventListener('streamShared', handleStreamShared);
    };
  }, [onStreamStart, onStreamStop, onStreamError, selectedDeviceId]);

  const startStreaming = useCallback(async () => {
    try {
      if (!selectedDeviceId) {
        throw new Error('No camera device selected');
      }

      // Get camera stream
      const cameraStream = await CameraService.getInternalCameraStream(selectedDeviceId);
      setStream(cameraStream);

      // Set video element source
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
      }

      // Start streaming service
      await StreamService.startStreaming(STREAM_MODES.LIVE, videoRef.current, cameraStream);
    } catch (error) {
      console.error('Error starting live stream:', error);
      if (onStreamError) onStreamError(error);
    }
  }, [selectedDeviceId, onStreamError]);

  const stopStreaming = useCallback(() => {
    // Stop streaming service
    StreamService.stopStreaming();

    // Stop camera stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    CameraService.stopInternalCamera();
  }, [stream]);

  useEffect(() => {
    if (isActive && selectedDeviceId && !isStreaming) {
      startStreaming();
    } else if (!isActive && isStreaming) {
      stopStreaming();
    }
  }, [isActive, selectedDeviceId, isStreaming, startStreaming, stopStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isStreaming) {
        stopStreaming();
      }
    };
  }, [isStreaming, stopStreaming]);

  const videoWrapperStyle = {
    position: 'relative',
    width: '100%',
    border: '2px solid #ccc',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#000'
  };

  const videoStyle = {
    width: '100%',
    height: 'auto'
  };

  const liveBadgeStyle = {
    position: 'absolute',
    top: '10px',
    left: '10px',
    backgroundColor: 'red',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    zIndex: 2
  };

  const statusBadgeStyle = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: streamingState.lastBeeStatus === "outside" ? 'orange' : 'green',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    zIndex: 2
  };

  const transitionBadgeStyle = {
    position: 'absolute',
    top: '50px',
    right: '10px',
    backgroundColor: 'red',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '0.8rem',
    zIndex: 2,
    animation: 'blink 1s infinite'
  };

  return (
    <div style={videoWrapperStyle}>
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
          }
        `}
      </style>
      
      {/* Live indicator */}
      {isStreaming && (
        <div style={liveBadgeStyle}>
          {isSharedWithExternal ? "LIVE (SHARED)" : "LIVE"}
        </div>
      )}
      
      {/* Bee status indicator */}
      {streamingState.lastBeeStatus && (
        <div style={statusBadgeStyle}>
          דבורה {streamingState.lastBeeStatus === "inside" ? "בפנים" : "בחוץ"}
          {streamingState.positionHistoryCount > 0 && ` (${streamingState.positionHistoryCount} נקודות)`}
        </div>
      )}
      
      {/* Transition indicator */}
      {streamingState.transitionDetected && (
        <div style={transitionBadgeStyle}>
          {streamingState.eventAction === "start_event" ? "EVENT STARTED!" : 
           streamingState.eventAction === "end_event" ? "EVENT ENDED!" : "EVENT!"}
        </div>
      )}
      
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={videoStyle}
      />
      
      {/* Connection status overlay */}
      {!isStreaming && isActive && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '1.2rem'
        }}>
          מתחבר למצלמה...
        </div>
      )}
    </div>
  );
};

export default LiveStreamComponent;