import React, { useState, useEffect, useRef } from 'react';
import CameraService from '../services/CameraService';

const WebSocketTestClient = ({ onLog, testId, cameraType = 'internal' }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStats, setConnectionStats] = useState({
    connectTime: null,
    messagesReceived: 0,
    messagesSent: 0,
    lastActivity: null,
    connectionAttempts: 0
  });
  
  // Camera streaming state
  const [cameraStream, setCameraStream] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [cameraPermissionRequested, setCameraPermissionRequested] = useState(false);
  
  const wsRef = useRef(null);
  const statsRef = useRef(connectionStats);
  const videoRef = useRef(null);

  // Force permissions request on component mount
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        log('Requesting camera permissions on component load...');
        // Request both audio and video for most consistent label access
        const tempStream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: true 
        }).catch(() => {
          // Fallback to just video
          return navigator.mediaDevices.getUserMedia({ video: true });
        });
        
        if (tempStream) {
          tempStream.getTracks().forEach(track => track.stop());
          log('✅ Camera permissions granted');
          setCameraPermissionRequested(true);
          
          // Small delay to ensure permissions take effect
          setTimeout(() => loadAvailableCameras(), 500);
        }
      } catch (error) {
        log(`Unable to get camera permissions: ${error.message}`, 'error');
        setCameraPermissionRequested(true);
        loadAvailableCameras(); // Try anyway
      }
    };
    
    requestPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const log = (message, type = 'info') => {
    if (onLog) {
      onLog(`[WS-${cameraType}] ${message}`, type);
    }
    // eslint-disable-next-line no-console
    console.log(`[WS-${cameraType}] ${message}`);
  };

  // Helper function to filter unique physical cameras (same as TestPage)
  const filterUniquePhysicalCameras = (cameras) => {
    const uniqueCameras = [];
    const seenDevices = new Set();
    const deviceLabels = new Map();
    
    log(`🔍 Analyzing ${cameras.length} camera entries for duplicates...`);
    
    // First pass: Extract labels and identify cameras by model
    const cameraModels = cameras.reduce((acc, camera) => {
      if (camera.label) {
        // Extract camera model from label - typically the first part before any special characters
        const modelMatch = camera.label.match(/^([A-Za-z0-9\s]+)/) || [camera.label];
        const model = modelMatch[0].trim();
        
        if (!acc[model]) {
          acc[model] = [];
        }
        acc[model].push(camera);
      }
      return acc;
    }, {});
    
    // Log camera models found
    Object.entries(cameraModels).forEach(([model, modelCameras]) => {
      if (modelCameras.length > 1) {
        log(`Found ${modelCameras.length} entries for model: ${model}`, 'info');
      }
    });
    
    // Process each camera
    for (const camera of cameras) {
      // Enhanced duplicate detection using multiple criteria
      const labelKey = camera.label || 'unnamed-camera';
      const groupKey = camera.groupId || 'no-group';
      
      // Create multiple identifiers to catch duplicates
      const identifiers = [
        `${labelKey}-${groupKey}`,
        `${labelKey}-${camera.deviceId ? camera.deviceId.slice(-8) : 'no-id'}`,
        labelKey
      ];
      
      // Check if this is a duplicate using any identifier
      let isDuplicate = false;
      for (const id of identifiers) {
        if (seenDevices.has(id)) {
          isDuplicate = true;
          log(`Duplicate detected: ${camera.label || camera.deviceId || 'Unknown camera'}`, 'warn');
          break;
        }
      }
      
      if (isDuplicate) {
        continue;
      }
      
      // Special handling for specific camera types
      if (camera.label) {
        // Handle OBS Virtual Camera
        if (camera.label.includes('OBS Virtual Camera')) {
          log(`Found OBS Virtual Camera - will use as fallback only`);
          uniqueCameras.push({ ...camera, priority: 'fallback' });
          identifiers.forEach(id => seenDevices.add(id));
          continue;
        }
        
        // Check for Microsoft LifeCam VX-800 duplicate issue specifically
        if (camera.label.includes('Microsoft LifeCam VX-800')) {
          log(`📝 Found Microsoft LifeCam VX-800 - known to have duplicate entries`, 'info');
        }
        
        // Detect multiple entries of same physical camera model
        if (deviceLabels.has(labelKey)) {
          const existingCount = deviceLabels.get(labelKey);
          log(`Found additional entry for ${labelKey} (entry #${existingCount + 1})`, 'warn');
          deviceLabels.set(labelKey, existingCount + 1);
          
          // For Microsoft LifeCam, we know these are duplicates
          if (camera.label.includes('Microsoft LifeCam')) {
            log(`Skipping duplicate Microsoft LifeCam entry`, 'info');
            continue;
          }
        } else {
          deviceLabels.set(labelKey, 1);
        }
      }
      
      // Add all identifiers to seen set
      identifiers.forEach(id => seenDevices.add(id));
      
      // Add to unique cameras list with priority
      uniqueCameras.unshift({ ...camera, priority: 'primary' });
      log(`✅ Added unique camera: ${camera.label || camera.deviceId}`);
    }
    
    // Sort cameras: primary physical cameras first, then fallbacks
    uniqueCameras.sort((a, b) => {
      if (a.priority === 'primary' && b.priority === 'fallback') return -1;
      if (a.priority === 'fallback' && b.priority === 'primary') return 1;
      return 0;
    });
    
    log(`📊 Found ${uniqueCameras.length} unique physical cameras from ${cameras.length} entries`);
    return uniqueCameras;
  };

  // Camera management functions
  const loadAvailableCameras = async () => {
    try {
      log('Loading available cameras...');
      
      // Get cameras through CameraService - our enhanced version now requests permissions
      const allCameras = await CameraService.getAvailableCameras();
      
      if (allCameras.length === 0) {
        log('No cameras detected', 'warn');
        return;
      }
      
      // Check if we have camera labels
      const hasLabels = allCameras.some(cam => cam.label && cam.label.length > 0);
      
      if (!hasLabels && !cameraPermissionRequested) {
        log('Camera labels not available - requesting additional permissions', 'warn');
        try {
          // Request permissions directly as a backup
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
            
          if (tempStream) {
            tempStream.getTracks().forEach(track => track.stop());
            setCameraPermissionRequested(true);
            
            // Add slight delay to ensure permissions take effect
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Re-fetch cameras after getting permissions
            const updatedCameras = await CameraService.getAvailableCameras();
            if (updatedCameras.length > 0) {
              log('✅ Successfully obtained camera labels after permission request');
              allCameras.splice(0, allCameras.length, ...updatedCameras);
            }
          }
        } catch (permError) {
          log(`Unable to get camera labels: ${permError.message}`, 'warn');
        }
      }
      
      // Log all detected cameras with their full labels
      log(`Found ${allCameras.length} total camera entries:`);
      allCameras.forEach((camera, index) => {
        log(`Camera ${index}: ${camera.label || 'No label available'}`);
      });
      
      // Filter to get only unique physical cameras
      const uniqueCameras = filterUniquePhysicalCameras(allCameras);
      setAvailableCameras(uniqueCameras);
      
      if (uniqueCameras.length > 0 && !selectedCameraId) {
        // Smart auto-select camera based on type and availability
        let selectedCamera = null;
        
        if (cameraType === 'internal') {
          // Internal camera gets the first available unique camera
          selectedCamera = uniqueCameras.find(cam => cam.priority === 'primary') || uniqueCameras[0];
        } else {
          // External camera gets the second available unique camera, or fallback
          if (uniqueCameras.length > 1) {
            const primaryCameras = uniqueCameras.filter(cam => cam.priority === 'primary');
            selectedCamera = primaryCameras[1] || uniqueCameras[1];
          } else {
            // Only one unique camera available - use fallback if available
            selectedCamera = uniqueCameras.find(cam => cam.priority === 'fallback');
            if (selectedCamera) {
              log(`⚠️ Only one physical camera available - external using fallback camera`, 'warn');
            }
          }
        }
        
        if (selectedCamera) {
          setSelectedCameraId(selectedCamera.deviceId);
          log(`Auto-selected camera for ${cameraType}: ${selectedCamera.label || selectedCamera.deviceId}`);
        } else {
          log(`❌ No suitable camera found for ${cameraType} client`, 'warn');
        }
      }
      
      log(`Found ${uniqueCameras.length} unique physical cameras (${allCameras.length} total entries)`);
      
      // Provide guidance based on available cameras
      if (uniqueCameras.length === 0) {
        log(`❌ No cameras available for ${cameraType}`, 'error');
      } else if (uniqueCameras.length === 1) {
        log(`⚠️ Only 1 unique camera available - dual camera testing not possible`, 'warn');
        if (cameraType === 'external') {
          log(`💡 External camera needs a second physical camera to avoid conflicts`, 'info');
        }
      } else {
        log(`✅ ${uniqueCameras.length} unique cameras available - dual camera testing possible`, 'info');
      }
      
    } catch (error) {
      log(`Failed to load cameras: ${error.message}`, 'error');
      setCameraError(error.message);
    }
  };

  const startCameraStream = async () => {
    if (!selectedCameraId) {
      log('No camera selected', 'warn');
      return;
    }

    try {
      setCameraError(null);
      
      // Get camera details for better logging
      const selectedCameraInfo = availableCameras.find(cam => cam.deviceId === selectedCameraId);
      const cameraLabel = selectedCameraInfo?.label || `Camera (ID: ${selectedCameraId ? selectedCameraId.slice(-8) : 'no-id'})`;
      
      log(`Starting ${cameraType} camera: ${cameraLabel}`);
      
      // Warn about potential conflicts
      if (selectedCameraInfo?.priority === 'fallback') {
        log(`⚠️ Using fallback camera (OBS Virtual Camera) - ensure OBS is running`, 'warn');
      }
      
      const stream = await CameraService.startCamera(selectedCameraId);
      setCameraStream(stream);
      setIsCameraActive(true);
      
      // Get actual stream details for logging
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        log(`✅ Camera stream active: ${cameraLabel}`);
        log(`📊 Resolution: ${settings.width}x${settings.height}, ${settings.frameRate || 'unknown'} FPS`);
        
        // Check if we got actual label from track
        const actualLabel = videoTrack.label;
        if (actualLabel && (!selectedCameraInfo?.label || actualLabel !== selectedCameraInfo.label)) {
          log(`📝 Actual camera: ${actualLabel}`);
        }
      }
      
      // Set video source
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Store active camera info globally to help other clients avoid conflicts
      if (typeof window !== 'undefined') {
        if (!window.activeCameraStreams) {
          window.activeCameraStreams = new Set();
        }
        window.activeCameraStreams.add(`${cameraType}-${selectedCameraId}`);
        log(`📝 Registered active camera: ${cameraType}-${cameraLabel}`);
      }
      
    } catch (error) {
      log(`❌ Failed to start camera: ${error.message}`, 'error');
      
      // Provide specific error guidance
      if (error.name === 'NotReadableError') {
        setCameraError(`Camera in use: ${error.message}`);
        log(`💡 Camera may be in use by another application or WebSocket client`, 'warn');
        log(`💡 Try selecting a different camera or stop other camera streams`, 'info');
      } else if (error.name === 'NotAllowedError') {
        setCameraError(`Permission denied: ${error.message}`);
        log(`💡 Check browser camera permissions`, 'warn');
      } else {
        setCameraError(error.message);
      }
      
      setIsCameraActive(false);
    }
  };

  const stopCameraStream = () => {
    if (cameraStream) {
      log('Stopping camera stream...');
      
      // Stop all tracks
      cameraStream.getTracks().forEach(track => {
        track.stop();
      });
      
      // Clear video source
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setCameraStream(null);
      setIsCameraActive(false);
      log('✅ Camera stream stopped');
    }
  };

  const handleCameraChange = (event) => {
    const newCameraId = event.target.value;
    if (!newCameraId) {
      log('No camera selected', 'warn');
      return;
    }
    
    setSelectedCameraId(newCameraId);
    
    // If camera is currently active, restart with new camera
    if (isCameraActive) {
      stopCameraStream();
      setTimeout(() => {
        setSelectedCameraId(newCameraId);
      }, 100);
    }
    
    log(`Camera selection changed: ${newCameraId}`);
  };

  const connect = () => {
    if (isConnected || (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING)) {
      log('Already connected or connecting', 'warn');
      return;
    }

    try {
      log('Attempting WebSocket connection...');
      const connectStart = Date.now();
      
      setConnectionStats(prev => ({
        ...prev,
        connectionAttempts: prev.connectionAttempts + 1
      }));

      const websocketUrl = process.env.REACT_APP_WEBSOCKET_URL || 'ws://localhost:8000';
      const fullUrl = `${websocketUrl}/video/live-stream`;
      
      log(`Connecting to: ${fullUrl}`);
      
      wsRef.current = new WebSocket(fullUrl);

      wsRef.current.onopen = () => {
        const connectTime = Date.now() - connectStart;
        setIsConnected(true);
        setConnectionStats(prev => ({
          ...prev,
          connectTime,
          lastActivity: new Date()
        }));
        log(`✅ Connected in ${connectTime}ms`);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setConnectionStats(prev => ({
            ...prev,
            messagesReceived: prev.messagesReceived + 1,
            lastActivity: new Date()
          }));
          
          log(`📨 Message: ${JSON.stringify(data)}`);
          
          if (data.type === 'external_camera_control') {
            log(`🎯 EXTERNAL CAMERA TRIGGER: ${data.action}`, 'warn');
          }
          
          if (data.type === 'connection_test') {
            log(`🔍 Connection test message received`, 'info');
          }
        } catch (error) {
          log(`📨 Raw message: ${event.data}`);
          setConnectionStats(prev => ({
            ...prev,
            messagesReceived: prev.messagesReceived + 1,
            lastActivity: new Date()
          }));
        }
      };

      wsRef.current.onerror = (error) => {
        log(`❌ WebSocket error: ${error.message || 'Unknown error'}`, 'error');
        log(`❌ Error type: ${error.type || 'unknown'}`, 'error');
      };

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        log(`🔌 Connection closed: Code ${event.code}, Reason: ${event.reason || 'No reason'}`);
        log(`🔌 Was clean: ${event.wasClean}`);
        
        if (event.code === 1006) {
          log('🔌 Abnormal closure - connection lost unexpectedly', 'warn');
        }
      };

    } catch (error) {
      log(`❌ Connection failed: ${error.message}`, 'error');
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      log('Disconnecting WebSocket...');
      try {
        wsRef.current.close(1000, 'User disconnect');
        wsRef.current = null;
        setIsConnected(false);
      } catch (error) {
        log(`❌ Error during disconnect: ${error.message}`, 'error');
      }
    }
  };

  const sendTestMessage = (message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        const messageToSend = {
          type: 'test_message',
          testId: testId,
          cameraType: cameraType,
          timestamp: new Date().toISOString(),
          ...message
        };
        
        wsRef.current.send(JSON.stringify(messageToSend));
        setConnectionStats(prev => ({
          ...prev,
          messagesSent: prev.messagesSent + 1,
          lastActivity: new Date()
        }));
        log(`📤 Sent: ${JSON.stringify(messageToSend)}`);
      } catch (error) {
        log(`❌ Send failed: ${error.message}`, 'error');
      }
    } else {
      log('❌ Cannot send - WebSocket not connected', 'error');
    }
  };

  const sendPing = () => {
    sendTestMessage({ 
      action: 'ping',
      message: 'Ping from test client'
    });
  };

  const sendFrameData = () => {
    sendTestMessage({
      action: 'test_frame',
      frameData: 'simulated_frame_data',
      resolution: '1280x720'
    });
  };

  const getConnectionStatusColor = () => {
    if (!wsRef.current) return 'gray';
    
    switch (wsRef.current.readyState) {
      case WebSocket.CONNECTING: return 'orange';
      case WebSocket.OPEN: return 'green';
      case WebSocket.CLOSING: return 'orange';
      case WebSocket.CLOSED: return 'red';
      default: return 'gray';
    }
  };

  const getConnectionStatusText = () => {
    if (!wsRef.current) return 'Not Connected';
    
    switch (wsRef.current.readyState) {
      case WebSocket.CONNECTING: return '🔄 Connecting...';
      case WebSocket.OPEN: return '✅ Connected';
      case WebSocket.CLOSING: return '⏳ Closing...';
      case WebSocket.CLOSED: return '❌ Closed';
      default: return '❓ Unknown';
    }
  };

  useEffect(() => {
    // Load available cameras on component mount
    loadAvailableCameras();
    
    return () => {
      disconnect();
      stopCameraStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update stats ref
  useEffect(() => {
    statsRef.current = connectionStats;
  }, [connectionStats]);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  const containerStyle = {
    display: 'flex',
    border: '1px solid #ccc',
    padding: '15px',
    margin: '10px',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
    fontFamily: 'monospace',
    gap: '15px'
  };

  const leftPanelStyle = {
    flex: '1',
    minWidth: '300px'
  };

  const rightPanelStyle = {
    flex: '1',
    minWidth: '300px',
    maxWidth: '400px'
  };

  const videoContainerStyle = {
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#000',
    overflow: 'hidden',
    marginBottom: '10px'
  };

  const videoStyle = {
    width: '100%',
    height: '240px',
    objectFit: 'cover'
  };

  const placeholderStyle = {
    width: '100%',
    height: '240px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
    color: '#666',
    fontSize: '14px',
    flexDirection: 'column'
  };

  const cameraControlsStyle = {
    marginBottom: '15px',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
    border: '1px solid #e9ecef'
  };

  const headerStyle = {
    margin: '0 0 15px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333'
  };

  const statusStyle = {
    marginBottom: '10px',
    fontSize: '14px'
  };

  const statusIndicatorStyle = {
    color: getConnectionStatusColor(),
    fontWeight: 'bold'
  };

  const statsGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
    marginBottom: '15px',
    fontSize: '12px',
    backgroundColor: '#f0f0f0',
    padding: '10px',
    borderRadius: '4px'
  };

  const buttonStyle = {
    margin: '0 5px 5px 0',
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
      {/* Left Panel - WebSocket Controls */}
      <div style={leftPanelStyle}>
        <h4 style={headerStyle}>WebSocket Test Client ({cameraType})</h4>
        
        <div style={statusStyle}>
          <strong>Status:</strong> <span style={statusIndicatorStyle}>
            {getConnectionStatusText()}
          </span>
        </div>

        <div style={statsGridStyle}>
          <div><strong>Connect Time:</strong> {connectionStats.connectTime ? `${connectionStats.connectTime}ms` : 'N/A'}</div>
          <div><strong>Connection Attempts:</strong> {connectionStats.connectionAttempts}</div>
          <div><strong>Messages Received:</strong> {connectionStats.messagesReceived}</div>
          <div><strong>Messages Sent:</strong> {connectionStats.messagesSent}</div>
          <div><strong>Last Activity:</strong> {connectionStats.lastActivity ? connectionStats.lastActivity.toLocaleTimeString() : 'N/A'}</div>
          <div><strong>Test ID:</strong> {testId || 'None'}</div>
        </div>

        <div>
          <button 
            onClick={connect} 
            disabled={isConnected}
            style={isConnected ? disabledButtonStyle : buttonStyle}
          >
            Connect
          </button>
          <button 
            onClick={disconnect} 
            disabled={!isConnected}
            style={!isConnected ? disabledButtonStyle : buttonStyle}
          >
            Disconnect
          </button>
          <button 
            onClick={sendPing}
            disabled={!isConnected}
            style={!isConnected ? disabledButtonStyle : buttonStyle}
          >
            Send Ping
          </button>
          <button 
            onClick={sendFrameData}
            disabled={!isConnected}
            style={!isConnected ? disabledButtonStyle : buttonStyle}
          >
            Send Test Frame
          </button>
          <button 
            onClick={() => sendTestMessage({ action: 'status_request' })}
            disabled={!isConnected}
            style={!isConnected ? disabledButtonStyle : buttonStyle}
          >
            Request Status
          </button>
        </div>
      </div>

      {/* Right Panel - Camera Display */}
      <div style={rightPanelStyle}>
        <h4 style={headerStyle}>Camera View ({cameraType})</h4>
        
        {/* Camera Controls */}
        <div style={cameraControlsStyle}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Camera Selection:</strong>
          </div>
          <select 
            value={selectedCameraId} 
            onChange={handleCameraChange}
            style={{ width: '100%', marginBottom: '8px', padding: '4px' }}
            disabled={isCameraActive}
          >
            <option value="">Select Camera...</option>
            {availableCameras.map((camera, index) => {
              // Ensure we display actual camera label when available
              let displayName = camera.label;
              if (!displayName || displayName.trim() === '') {
                displayName = `Camera ${index + 1}`;
              }
              
              const isDuplicate = availableCameras.some((otherCam, otherIndex) => 
                otherIndex !== index && 
                otherCam.label === camera.label && 
                camera.label // Only consider if label exists
              );
              
              // Add additional info to help identify cameras
              let cameraInfo = displayName;
              if (camera.priority === 'fallback') {
                cameraInfo += ' (Fallback)';
              }
              if (isDuplicate && camera.label) {
                // Add device ID suffix to distinguish duplicate named cameras
                cameraInfo += ` [ID: ${camera.deviceId ? camera.deviceId.slice(-4) : 'no-id'}]`;
              }
              
              return (
                <option key={camera.deviceId} value={camera.deviceId}>
                  {cameraInfo}
                </option>
              );
            })}
          </select>
          
          <div>
            <button 
              onClick={startCameraStream}
              disabled={isCameraActive || !selectedCameraId}
              style={{
                ...(!isCameraActive && selectedCameraId ? buttonStyle : disabledButtonStyle),
                backgroundColor: !isCameraActive && selectedCameraId ? '#4CAF50' : '#e0e0e0',
                color: !isCameraActive && selectedCameraId ? 'white' : '#666',
                fontWeight: 'bold'
              }}
            >
              Start Camera
            </button>
            <button 
              onClick={stopCameraStream}
              disabled={!isCameraActive}
              style={{
                ...(isCameraActive ? buttonStyle : disabledButtonStyle),
                backgroundColor: isCameraActive ? '#f44336' : '#e0e0e0',
                color: isCameraActive ? 'white' : '#666'
              }}
            >
              Stop Camera
            </button>
            <button 
              onClick={loadAvailableCameras}
              style={{
                ...buttonStyle,
                backgroundColor: '#2196F3',
                color: 'white'
              }}
            >
              Refresh Cameras
            </button>
          </div>
          
          {cameraError && (
            <div style={{ 
              marginTop: '8px', 
              padding: '6px', 
              backgroundColor: '#ffe6e6', 
              color: '#d63031', 
              borderRadius: '4px',
              fontSize: '12px'
            }}>
              ❌ {cameraError}
            </div>
          )}
        </div>

        {/* Video Display */}
        <div style={videoContainerStyle}>
          {cameraStream ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={videoStyle}
            />
          ) : (
            <div style={placeholderStyle}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📷</div>
              <div>Camera Not Active</div>
              <div style={{ fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>
                Select a camera and click "Start Camera" to see the stream
              </div>
            </div>
          )}
        </div>

        {/* Camera Status */}
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div><strong>Camera Status:</strong> {isCameraActive ? '🟢 Active' : '🔴 Inactive'}</div>
          <div><strong>Available Cameras:</strong> {availableCameras.length}</div>
          {cameraStream && (
            <div><strong>Stream Tracks:</strong> {cameraStream.getTracks().length}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebSocketTestClient;