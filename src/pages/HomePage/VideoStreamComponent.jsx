/* eslint-disable no-console */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { StreamService } from '../../services';
import { STREAM_MODES } from '../../constants';

const VideoStreamComponent = ({ 
  isActive, 
  videoFileName = 'sample-hive-video.mp4',
  onStreamStart, 
  onStreamStop, 
  onStreamError 
}) => {
  const videoRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [streamingState, setStreamingState] = useState({});

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

    // Add event listeners
    StreamService.addEventListener('streamingStarted', handleStreamingStarted);
    StreamService.addEventListener('streamingStopped', handleStreamingStopped);
    StreamService.addEventListener('streamingError', handleStreamingError);
    StreamService.addEventListener('stateUpdated', handleStateUpdated);

    // Get initial state
    setStreamingState(StreamService.getStreamingState());

    // Cleanup
    return () => {
      StreamService.removeEventListener('streamingStarted', handleStreamingStarted);
      StreamService.removeEventListener('streamingStopped', handleStreamingStopped);
      StreamService.removeEventListener('streamingError', handleStreamingError);
      StreamService.removeEventListener('stateUpdated', handleStateUpdated);
    };
  }, [onStreamStart, onStreamStop, onStreamError]);

  const startVideoStreaming = useCallback(async () => {
    try {
      if (!videoRef.current) {
        throw new Error('Video element not available');
      }

      // Set video source
      videoRef.current.src = `/sample-videos/${videoFileName}`;
      videoRef.current.load();
      
      // Configure video playback
      videoRef.current.loop = true;
      videoRef.current.muted = true; // Mute to allow autoplay
      
      // Wait for video to load
      await new Promise((resolve, reject) => {
        const handleCanPlay = () => {
          videoRef.current.removeEventListener('canplay', handleCanPlay);
          videoRef.current.removeEventListener('error', handleError);
          setIsVideoLoaded(true);
          resolve();
        };
        
        const handleError = (error) => {
          videoRef.current.removeEventListener('canplay', handleCanPlay);
          videoRef.current.removeEventListener('error', handleError);
          reject(new Error(`Video load error: ${error.message || 'Unknown error'}`));
        };
        
        videoRef.current.addEventListener('canplay', handleCanPlay);
        videoRef.current.addEventListener('error', handleError);
      });

      // Start video playback
      await videoRef.current.play();

      // Start streaming service
      await StreamService.startStreaming(STREAM_MODES.VIDEO, videoRef.current);
    } catch (error) {
      console.error('Error starting video stream:', error);
      if (onStreamError) onStreamError(error);
    }
  }, [videoFileName, onStreamError]);

  const stopVideoStreaming = () => {
    // Stop streaming service
    StreamService.stopStreaming();

    // Stop video playback
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = "";
      videoRef.current.load();
    }

    setIsVideoLoaded(false);
  };

  useEffect(() => {
    if (isActive && !isStreaming) {
      startVideoStreaming();
    } else if (!isActive && isStreaming) {
      stopVideoStreaming();
    }
  }, [isActive, isStreaming, startVideoStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isStreaming) {
        stopVideoStreaming();
      }
    };
  }, [isStreaming]);

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

  const videoBadgeStyle = {
    position: 'absolute',
    top: '10px',
    left: '10px',
    backgroundColor: '#ff6b35',
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

  const overlayStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '1.2rem'
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
      
      {/* Video mode indicator */}
      {isStreaming && isVideoLoaded && (
        <div style={videoBadgeStyle}>
          VIDEO
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
        loop
        style={videoStyle}
      />
      
      {/* Loading/Error overlay */}
      {isActive && !isVideoLoaded && (
        <div style={overlayStyle}>
          <div>טוען קובץ וידאו...</div>
          <div style={{ fontSize: '0.9rem', marginTop: '0.5rem', opacity: 0.8 }}>
            {videoFileName}
          </div>
        </div>
      )}
      
      {/* Connection status overlay */}
      {isVideoLoaded && !isStreaming && isActive && (
        <div style={overlayStyle}>
          מתחבר לשרת...
        </div>
      )}
    </div>
  );
};

export default VideoStreamComponent;