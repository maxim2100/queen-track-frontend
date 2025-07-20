import React, { useRef, useEffect, useState, useCallback } from 'react';

const CameraStreamDisplay = ({ stream, title, onError, showControls = true }) => {
  const videoRef = useRef(null);
  const [videoStats, setVideoStats] = useState({
    width: 0,
    height: 0,
    fps: 0,
    isPlaying: false
  });

  const handleError = useCallback((error) => {
    // eslint-disable-next-line no-console
    console.error(`Camera stream error (${title}):`, error);
    if (onError) {
      onError(error);
    }
  }, [title, onError]);

  const updateVideoStats = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      setVideoStats({
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 0, // FPS calculation would require frame counting
        isPlaying: !video.paused && !video.ended && video.readyState > 2
      });
    }
  };

  useEffect(() => {
    if (stream && videoRef.current) {
      const video = videoRef.current;
      
      try {
        video.srcObject = stream;
        
        // Add event listeners for video metadata
        const handleLoadedMetadata = () => {
          updateVideoStats();
        };
        
        const handlePlay = () => {
          updateVideoStats();
        };
        
        const handlePause = () => {
          updateVideoStats();
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('error', handleError);

        // Cleanup function
        return () => {
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('play', handlePlay);
          video.removeEventListener('pause', handlePause);
          video.removeEventListener('error', handleError);
        };
      } catch (error) {
        handleError(error);
      }
    }
  }, [stream, title, handleError]);

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(handleError);
      } else {
        videoRef.current.pause();
      }
    }
  };

  const takeScreenshot = () => {
    if (videoRef.current && stream) {
      try {
        const canvas = document.createElement('canvas');
        const video = videoRef.current;
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Create download link
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${title.replace(/\s+/g, '_')}_screenshot_${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 'image/png');
      } catch (error) {
        handleError(error);
      }
    }
  };

  const containerStyle = {
    border: '1px solid #ccc',
    padding: '15px',
    margin: '10px',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
    display: 'inline-block',
    verticalAlign: 'top'
  };

  const titleStyle = {
    margin: '0 0 10px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333'
  };

  const videoStyle = {
    width: '100%',
    maxWidth: '400px',
    height: 'auto',
    backgroundColor: '#000',
    border: '1px solid #ddd',
    borderRadius: '4px'
  };

  const placeholderStyle = {
    width: '400px',
    height: '300px',
    backgroundColor: '#f0f0f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    flexDirection: 'column'
  };

  const statsStyle = {
    marginTop: '10px',
    fontSize: '12px',
    backgroundColor: '#f0f0f0',
    padding: '8px',
    borderRadius: '4px',
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '4px'
  };

  const controlsStyle = {
    marginTop: '10px',
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  };

  const buttonStyle = {
    padding: '6px 12px',
    fontSize: '12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer'
  };

  const disabledButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#e0e0e0',
    cursor: 'not-allowed',
    color: '#666'
  };

  return (
    <div style={containerStyle}>
      <h4 style={titleStyle}>{title}</h4>
      
      {stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            style={videoStyle}
            onError={handleError}
          />
          
          <div style={statsStyle}>
            <div><strong>Resolution:</strong> {videoStats.width}x{videoStats.height}</div>
            <div><strong>Status:</strong> {videoStats.isPlaying ? '▶️ Playing' : '⏸️ Paused'}</div>
            <div><strong>Stream:</strong> {stream.active ? '🟢 Active' : '🔴 Inactive'}</div>
            <div><strong>Tracks:</strong> {stream.getTracks().length}</div>
          </div>
          
          {showControls && (
            <div style={controlsStyle}>
              <button 
                onClick={togglePlayPause}
                style={buttonStyle}
              >
                {videoStats.isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>
              <button 
                onClick={takeScreenshot}
                disabled={!videoStats.isPlaying}
                style={videoStats.isPlaying ? buttonStyle : disabledButtonStyle}
              >
                📸 Screenshot
              </button>
              <button 
                onClick={updateVideoStats}
                style={buttonStyle}
              >
                🔄 Refresh Stats
              </button>
            </div>
          )}
        </>
      ) : (
        <div style={placeholderStyle}>
          <div>📷</div>
          <div>No Stream Available</div>
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#999' }}>
            Camera stream will appear here when available
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraStreamDisplay;