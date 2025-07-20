import React, { useState, useEffect, useRef, useCallback } from 'react';
import CameraService from '../services/CameraService';
import NotificationService from '../services/NotificationService';
import TestService from '../services/TestService';
import WebSocketTestClient from '../components/WebSocketTestClient';
import CameraStreamDisplay from '../components/CameraStreamDisplay';

const TestPage = () => {
  const [testConfig, setTestConfig] = useState({
    test_name: 'dual_camera_stream_test',
    test_duration: 60,
    enable_external_trigger: true,
    log_level: 'DEBUG',
    capture_docker_logs: true,
    capture_performance_metrics: true
  });

  const [testStatus, setTestStatus] = useState({
    isRunning: false,
    currentTestId: null,
    logs: [],
    status: 'idle'
  });

  const [systemStatus, setSystemStatus] = useState({
    backendConnected: false,
    internalCameraConnected: false,
    externalCameraConnected: false,
    notificationServiceConnected: false
  });

  const [realTimeLogs, setRealTimeLogs] = useState([]);
  const [cameraStreams, setCameraStreams] = useState({
    internal: null,
    external: null
  });

  const logsContainerRef = useRef(null);
  const testLogCaptureRef = useRef([]);

  // Custom logging function that captures all console logs
  const testLog = (message, type = 'info') => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type,
      message,
      source: 'frontend'
    };

    testLogCaptureRef.current.push(logEntry);
    setRealTimeLogs(prev => [...prev, logEntry]);

    // Also log to console
    // eslint-disable-next-line no-console
    console[type] ? console[type](`[TEST LOG] ${message}`) : console.log(`[TEST LOG] ${message}`);
  };

  // Helper functions for system health check
  const checkCameraAvailability = useCallback(async () => {
    try {
      // Enhanced permissions request to ensure we get proper device labels
      let hasPermissions = false;
      
      try {
        // First attempt - request both audio and video permissions for more reliable label access
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        tempStream.getTracks().forEach(track => track.stop());
        hasPermissions = true;
        testLog('Camera and audio permissions granted for device enumeration');
      } catch (audioVideoError) {
        try {
          // Second attempt - just video permissions if audio failed
          const videoOnlyStream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoOnlyStream.getTracks().forEach(track => track.stop());
          hasPermissions = true;
          testLog('Camera permissions granted for device enumeration');
        } catch (videoError) {
          testLog(`Camera permissions denied, will show limited device info: ${videoError.message}`, 'warn');
        }
      }
      
      // Delay slightly to ensure permissions take effect
      await new Promise(resolve => setTimeout(resolve, 300));

      // Check for available cameras using WebRTC
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      testLog(`Found ${videoDevices.length} video devices:`);
      videoDevices.forEach((device, index) => {
        // Use full label if available, or show meaningful deviceId portion
        const deviceName = device.label || 
          (hasPermissions ? `Unknown Camera ${index}` : `Camera ${index} (No Permission)`);
        
        // Safe access to device properties with null checks
        const deviceIdPreview = device.deviceId ? 
          `${device.deviceId.slice(0, 8)}...${device.deviceId.slice(-5)}` : 
          'unknown';
        const groupIdPreview = device.groupId ? 
          `${device.groupId.slice(0, 8)}...` : 
          'unknown';
        
        testLog(`Camera ${index}: ${deviceName}`);
        testLog(`    Device ID: ${deviceIdPreview}`);
        testLog(`    Group ID: ${groupIdPreview}`);
      });

      setSystemStatus(prev => ({
        ...prev,
        internalCameraConnected: videoDevices.length > 0,
        externalCameraConnected: videoDevices.length > 1
      }));

      // Test camera capabilities
      if (videoDevices.length > 0 && hasPermissions) {
        testLog('Testing camera capabilities...');
        for (let i = 0; i < Math.min(videoDevices.length, 3); i++) {
          try {
            const device = videoDevices[i];
            const deviceName = device.label || `Unknown Device ${device.deviceId.slice(0, 8)}...`;
            const caps = await CameraService.getCameraCapabilities(device.deviceId);
            if (caps) {
              testLog(`${deviceName} capabilities: ${JSON.stringify({
                width: caps.width,
                height: caps.height,
                facingMode: caps.facingMode
              })}`);
            }
          } catch (capError) {
            const deviceName = videoDevices[i].label || `Unknown Device ${videoDevices[i].deviceId.slice(0, 8)}...`;
            testLog(`${deviceName} capability check failed: ${capError.message}`, 'warn');
          }
        }
      }

    } catch (error) {
      testLog(`Camera availability check failed: ${error.message}`, 'error');
    }
  }, []);

  const checkNotificationService = useCallback(async () => {
    try {
      // Test notification service connection
      const isConnected = NotificationService.isConnected();
      
      setSystemStatus(prev => ({
        ...prev,
        notificationServiceConnected: isConnected
      }));

      testLog(`Notification service: ${isConnected ? 'CONNECTED' : 'DISCONNECTED'}`, isConnected ? 'info' : 'warn');

      // Set up notification listeners for external camera triggers
      NotificationService.onExternalCameraTrigger = (data) => {
        testLog(`🎯 EXTERNAL CAMERA TRIGGER RECEIVED: ${JSON.stringify(data)}`, 'warn');
      };

    } catch (error) {
      testLog(`Notification service check failed: ${error.message}`, 'error');
    }
  }, []);

  const testWebSocketConnectivity = useCallback(async () => {
    try {
      testLog('Testing WebSocket connectivity...');
      const result = await TestService.testWebSocketConnectivity();
      
      if (result.success) {
        testLog(`✅ WebSocket test passed (${result.duration}ms)`, 'info');
      } else {
        testLog(`❌ WebSocket test failed: ${result.error}`, 'error');
      }
      
      return result.success;
    } catch (error) {
      testLog(`WebSocket connectivity test failed: ${error.message}`, 'error');
      return false;
    }
  }, []);

  // System health check
  const checkSystemHealth = useCallback(async () => {
    testLog('Starting system health check...');

    try {
      // Request camera permissions first thing
      try {
        testLog('Requesting camera permissions for device access...');
        const tempStream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: true
        }).catch(() => {
          return navigator.mediaDevices.getUserMedia({ video: true });
        });
        
        if (tempStream) {
          tempStream.getTracks().forEach(track => track.stop());
          testLog('Camera permissions granted successfully');
          
          // Short delay to ensure permissions apply
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (permError) {
        testLog(`Camera permission request failed: ${permError.message}`, 'warn');
      }

      // Check backend connection using TestService
      const healthResult = await TestService.checkSystemHealth();
      
      setSystemStatus(prev => ({
        ...prev,
        backendConnected: healthResult.connected
      }));

      testLog(`Backend health check: ${healthResult.connected ? 'CONNECTED' : 'FAILED'}`, healthResult.connected ? 'info' : 'error');

      if (healthResult.data) {
        testLog(`Backend version: ${healthResult.data.version || 'Unknown'}`);
      }

      // Check camera availability
      await checkCameraAvailability();

      // Check notification service
      await checkNotificationService();

      // Test WebSocket connectivity
      await testWebSocketConnectivity();

    } catch (error) {
      testLog(`System health check failed: ${error.message}`, 'error');
      setSystemStatus(prev => ({
        ...prev,
        backendConnected: false
      }));
    }
  }, [checkCameraAvailability, checkNotificationService, testWebSocketConnectivity]);


  const startEndToEndTest = async () => {
    if (testStatus.isRunning) {
      testLog('Test is already running!', 'warn');
      return;
    }

    try {
      testLog('=== STARTING END-TO-END TEST ===', 'info');
      testLog(`Test configuration: ${JSON.stringify(testConfig, null, 2)}`);

      setTestStatus(prev => ({ ...prev, isRunning: true, status: 'starting' }));

      // Clear previous logs
      testLogCaptureRef.current = [];
      setRealTimeLogs([]);

      // Start the test on the backend using TestService
      const testData = await TestService.startEndToEndTest(testConfig);
      testLog(`Backend test started with ID: ${testData.test_id}`);

      setTestStatus(prev => ({
        ...prev,
        currentTestId: testData.test_id,
        status: 'running'
      }));

      // Start camera streaming test
      await startCameraStreamingTest(testData.test_id);

      // Monitor test progress
      monitorTestProgress(testData.test_id);

    } catch (error) {
      testLog(`Failed to start test: ${error.message}`, 'error');
      setTestStatus(prev => ({ ...prev, isRunning: false, status: 'failed' }));
    }
  };

  const startCameraStreamingTest = async (testId) => {
    try {
      testLog('🎥 Starting camera streaming test...');

      // Ensure we have camera permissions before starting
      try {
        testLog('Requesting camera permissions before streaming test');
        const tempStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        });
        tempStream.getTracks().forEach(track => track.stop());
        testLog('Camera permissions granted for streaming test');
        
        // Wait a moment for permissions to take effect
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (permError) {
        testLog(`Camera permissions denied: ${permError.message}`, 'error');
        testLog('Cannot proceed with camera streaming test - permissions required', 'error');
        return;
      }

      // Use the singleton CameraService instance
      // Get available cameras
      const allCameras = await CameraService.getAvailableCameras();
      testLog(`Total cameras detected: ${allCameras.length}`);

      if (allCameras.length === 0) {
        testLog('❌ No cameras found for testing', 'error');
        return;
      }

      // Ensure we have camera labels by requesting permissions if not already done
      try {
        const hasLabels = allCameras.some(cam => cam.label && cam.label.length > 0);
        if (!hasLabels) {
          testLog('Camera labels not available - requesting permissions first');
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          tempStream.getTracks().forEach(track => track.stop());
          
          // Re-fetch cameras after getting permissions
          const updatedCameras = await CameraService.getAvailableCameras();
          if (updatedCameras.length > 0) {
            allCameras.splice(0, allCameras.length, ...updatedCameras);
          }
        }
      } catch (permError) {
        testLog(`Unable to get camera labels: ${permError.message}`, 'warn');
      }

      // Analyze cameras to find unique physical devices
      const uniqueCameras = filterUniquePhysicalCameras(allCameras);
      testLog(`Unique physical cameras: ${uniqueCameras.length}`);
      
      uniqueCameras.forEach((cam, i) => {
        const deviceName = cam.label || `Unknown Device ${i}`;
        // Add null check before using slice on groupId
        const groupIdPreview = cam.groupId ? cam.groupId.slice(0, 8) : 'unknown';
        testLog(`Camera ${i}: ${deviceName} (Group: ${groupIdPreview}...)`);
      });

      if (uniqueCameras.length === 0) {
        testLog('❌ No accessible cameras found', 'error');
        return;
      }

      // Start internal camera stream (use first unique camera)
      let internalCameraIndex = 0;
      let internalStream = null;
      
      testLog('🎥 Starting internal camera stream...');
      
      try {
        const internalCamera = uniqueCameras[internalCameraIndex];
        const internalCameraName = internalCamera.label || `Unknown Device ${internalCameraIndex}`;
        testLog(`Using internal camera: ${internalCameraName}`);
        
        internalStream = await CameraService.startCamera(internalCamera.deviceId);
        
        // Log actual stream details
        if (internalStream && internalStream.getVideoTracks().length > 0) {
          const videoTrack = internalStream.getVideoTracks()[0];
          const settings = videoTrack.getSettings();
          testLog(`✅ Internal camera started with resolution: ${settings.width}x${settings.height}`);
          
          if (videoTrack.label && videoTrack.label !== internalCameraName) {
            testLog(`Camera identified as: ${videoTrack.label}`);
          }
        }
        
        setCameraStreams(prev => ({ ...prev, internal: internalStream }));
        testLog('✅ Internal camera stream started');

        // Connect to WebSocket for live streaming
        await connectToLiveStream(testId, 'internal');

      } catch (error) {
        testLog(`❌ Internal camera stream failed: ${error.message}`, 'error');
        if (error.name === 'NotReadableError') {
          testLog('💡 Camera may be in use by another application', 'warn');
          testLog('💡 Try closing other applications that might be using the camera', 'info');
        } else if (error.name === 'NotAllowedError') {
          testLog('💡 Camera access denied - check browser permissions', 'warn');
        } else if (error.name === 'OverconstrainedError') {
          testLog('💡 Camera constraints not satisfied - trying with default settings', 'warn');
          try {
            internalStream = await navigator.mediaDevices.getUserMedia({ video: true });
            setCameraStreams(prev => ({ ...prev, internal: internalStream }));
            testLog('✅ Internal camera stream started with default settings');
          } catch (fallbackError) {
            testLog(`❌ Fallback camera attempt failed: ${fallbackError.message}`, 'error');
          }
        }
        return; // Don't continue if internal camera fails
      }

      // Wait a moment before starting external camera to avoid resource conflicts
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Start external camera stream if we have more unique cameras
      if (uniqueCameras.length > 1) {
        testLog('🎥 Starting external camera stream...');
        
        // Filter out the camera already in use by internal stream
        const availableForExternal = uniqueCameras.filter((cam, index) => index !== internalCameraIndex);
        const externalCameraList = availableForExternal.map((cam, i) => {
          const name = cam.label || `Unknown Device ${cam.deviceId.slice(0, 8)}...`;
          return `[${i}] ${name}`;
        }).join(', ');
        testLog(`Available cameras for external: ${externalCameraList}`);
        
        let externalStreamStarted = false;
        
        for (let i = 0; i < availableForExternal.length && !externalStreamStarted; i++) {
          try {
            const externalCamera = availableForExternal[i];
            const externalCameraName = externalCamera.label || `Unknown Device ${externalCamera.deviceId.slice(0, 8)}...`;
            testLog(`Attempting external camera ${i}: ${externalCameraName}`);
            
            // Add some delay between attempts
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Check if this camera is truly different from internal
            if (externalCamera.deviceId === uniqueCameras[internalCameraIndex].deviceId) {
              testLog(`⚠️ Skipping camera ${i} - same device as internal camera`, 'warn');
              continue;
            }
            
            const externalStream = await CameraService.startCamera(externalCamera.deviceId);
            
            // Log actual stream details
            if (externalStream && externalStream.getVideoTracks().length > 0) {
              const videoTrack = externalStream.getVideoTracks()[0];
              const settings = videoTrack.getSettings();
              testLog(`✅ External camera started with resolution: ${settings.width}x${settings.height}`);
              
              if (videoTrack.label && videoTrack.label !== externalCameraName) {
                testLog(`Camera identified as: ${videoTrack.label}`);
              }
            }
            
            setCameraStreams(prev => ({ ...prev, external: externalStream }));
            testLog(`✅ External camera stream started with camera ${i}`);
            externalStreamStarted = true;
            
          } catch (error) {
            testLog(`❌ External camera ${i} failed: ${error.message}`, 'warn');
            testLog(`   Error details: ${error.name} - ${error.constraint || 'no constraint info'}`);
            
            if (i === availableForExternal.length - 1) {
              testLog('❌ All available external cameras failed to start', 'error');
              testLog('💡 You may need a second physical camera for dual camera testing');
            }
          }
        }
        
        if (!externalStreamStarted) {
          testLog('⚠️ External camera could not be started - continuing with internal camera only', 'warn');
        }
        
      } else {
        testLog('⚠️ Only one unique physical camera detected - cannot test dual camera streaming', 'warn');
        testLog('💡 SOLUTION: Connect a second physical camera (different model/brand)', 'info');
        testLog('💡 NOTE: The same camera model may appear multiple times but is still one physical device', 'info');
        
        // Provide specific feedback based on the camera analysis
        if (allCameras.length > 1) {
          testLog(`🔍 ANALYSIS: Detected ${allCameras.length} camera entries but only 1 unique physical device`, 'warn');
          testLog('📝 Common cause: Same camera appears multiple times in system (Windows driver behavior)', 'info');
        }
      }

    } catch (error) {
      testLog(`Camera streaming test failed: ${error.message}`, 'error');
    }
  };

  // Helper function to filter unique physical cameras
  const filterUniquePhysicalCameras = (cameras) => {
    const uniqueCameras = [];
    const seenDevices = new Set();
    const deviceLabels = new Map(); // Track device labels for better duplicate detection
    
    testLog(`🔍 Analyzing ${cameras.length} camera entries for duplicates...`);
    
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
        testLog(`Found ${modelCameras.length} entries for model: ${model}`, 'info');
      }
    });
    
    for (const camera of cameras) {
      // Enhanced duplicate detection using multiple criteria
      const labelKey = camera.label || 'unnamed-camera';
      const groupKey = camera.groupId || 'no-group';
      
      // Create multiple identifiers to catch duplicates
      const identifiers = [
        `${labelKey}-${groupKey}`,
        `${labelKey}-${camera.deviceId.slice(-8)}`, // Last 8 chars of device ID
        labelKey // Just the label for basic duplicate detection
      ];
      
      // Check if this is a duplicate using any identifier
      let isDuplicate = false;
      for (const id of identifiers) {
        if (seenDevices.has(id)) {
          isDuplicate = true;
          testLog(`Duplicate detected: ${camera.label || camera.deviceId} (matches existing device)`, 'warn');
          break;
        }
      }
      
      if (isDuplicate) {
        continue;
      }
      
      // Special handling for specific camera types
      if (camera.label) {
        // Skip OBS Virtual Camera unless it's the only option available
        if (camera.label.includes('OBS Virtual Camera')) {
          testLog(`Found OBS Virtual Camera - will use as fallback only`, 'info');
          uniqueCameras.push({ ...camera, priority: 'fallback' });
          identifiers.forEach(id => seenDevices.add(id));
          continue;
        }
        
        // Check for Microsoft LifeCam VX-800 duplicate issue specifically
        if (camera.label.includes('Microsoft LifeCam VX-800')) {
          testLog(`📝 Found Microsoft LifeCam VX-800 - known to have duplicate entries`, 'info');
        }
        
        // Detect multiple entries of same physical camera model
        if (deviceLabels.has(labelKey)) {
          const existingCount = deviceLabels.get(labelKey);
          testLog(`Found additional entry for ${labelKey} (entry #${existingCount + 1})`, 'warn');
          deviceLabels.set(labelKey, existingCount + 1);
          
          // For Microsoft LifeCam, we know these are duplicates
          if (camera.label.includes('Microsoft LifeCam')) {
            testLog(`Skipping duplicate Microsoft LifeCam entry`, 'info');
            continue; // Skip this duplicate
          }
        } else {
          deviceLabels.set(labelKey, 1);
        }
      }
      
      // Add all identifiers to seen set
      identifiers.forEach(id => seenDevices.add(id));
      
      // Add to unique cameras list with priority
      uniqueCameras.unshift({ ...camera, priority: 'primary' });
      testLog(`✅ Added unique camera: ${camera.label || camera.deviceId}`);
    }
    
    // Sort cameras: primary physical cameras first, then fallbacks
    uniqueCameras.sort((a, b) => {
      if (a.priority === 'primary' && b.priority === 'fallback') return -1;
      if (a.priority === 'fallback' && b.priority === 'primary') return 1;
      return 0;
    });
    
    testLog(`📊 Found ${uniqueCameras.length} unique physical cameras from ${cameras.length} entries`);
    
    return uniqueCameras;
  };

  const connectToLiveStream = async (testId, cameraType) => {
    try {
      testLog(`🔌 Connecting to live stream WebSocket (${cameraType})...`);

      const ws = new WebSocket('ws://localhost:8000/video/live-stream');

      ws.onopen = () => {
        testLog(`✅ WebSocket connected for ${cameraType} camera`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          testLog(`📨 WebSocket message (${cameraType}): ${JSON.stringify(data)}`);

          if (data.type === 'external_camera_control') {
            testLog(`🎯 EXTERNAL CAMERA CONTROL RECEIVED: ${data.action}`, 'warn');
          }

        } catch (error) {
          testLog(`📨 WebSocket raw message (${cameraType}): ${event.data}`);
        }
      };

      ws.onerror = (error) => {
        testLog(`❌ WebSocket error (${cameraType}): ${error.message || 'Unknown error'}`, 'error');
      };

      ws.onclose = (event) => {
        testLog(`🔌 WebSocket closed (${cameraType}): Code ${event.code}, Reason: ${event.reason}`);
      };

      // Store WebSocket reference for cleanup
      if (cameraType === 'internal') {
        window.testInternalWS = ws;
      }

    } catch (error) {
      testLog(`WebSocket connection failed (${cameraType}): ${error.message}`, 'error');
    }
  };

  const monitorTestProgress = (testId) => {
    const interval = setInterval(async () => {
      try {
        // Get test status
        const statusResponse = await fetch(`http://localhost:8000/test/status/${testId}`);
        if (statusResponse.ok) {
          const status = await statusResponse.json();
          
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(interval);
            setTestStatus(prev => ({ 
              ...prev, 
              isRunning: false, 
              status: status.status 
            }));
            
            testLog(`=== TEST ${status.status.toUpperCase()} ===`);
            
            // Get final logs
            await fetchServerLogs(testId);
          }
        }

        // Get real-time logs
        const logsResponse = await fetch(`http://localhost:8000/test/logs/${testId}`);
        if (logsResponse.ok) {
          // eslint-disable-next-line no-unused-vars
          const logsData = await logsResponse.json();
          // Process new server logs if needed
        }

      } catch (error) {
        testLog(`Error monitoring test progress: ${error.message}`, 'error');
      }
    }, 2000); // Check every 2 seconds

    // Stop monitoring after test duration + buffer
    setTimeout(() => {
      clearInterval(interval);
    }, (testConfig.test_duration + 30) * 1000);
  };

  const fetchServerLogs = async (testId) => {
    try {
      const response = await fetch(`http://localhost:8000/test/logs/${testId}`);
      if (response.ok) {
        const logsData = await response.json();
        testLog(`Server returned ${logsData.log_count} log entries`);
      }
    } catch (error) {
      testLog(`Failed to fetch server logs: ${error.message}`, 'error');
    }
  };

  const downloadCombinedLogs = async () => {
    if (!testStatus.currentTestId) {
      testLog('No test ID available for log download', 'warn');
      return;
    }

    try {
      // Download server logs
      const serverResponse = await fetch(`http://localhost:8000/test/download-logs/${testStatus.currentTestId}`);
      
      let combinedLogs = [];

      if (serverResponse.ok) {
        const serverLogs = await serverResponse.text();
        combinedLogs.push('=== SERVER LOGS ===');
        combinedLogs.push(serverLogs);
        combinedLogs.push('');
      }

      // Add frontend logs
      combinedLogs.push('=== FRONTEND LOGS ===');
      testLogCaptureRef.current.forEach(log => {
        combinedLogs.push(`[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`);
      });

      // Create and download file
      const logContent = combinedLogs.join('\n');
      const blob = new Blob([logContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `test_${testStatus.currentTestId}_combined_logs.log`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      testLog('✅ Combined logs downloaded successfully');

    } catch (error) {
      testLog(`Failed to download logs: ${error.message}`, 'error');
    }
  };

  const stopTest = () => {
    setTestStatus(prev => ({ 
      ...prev, 
      isRunning: false, 
      status: 'stopped' 
    }));

    // Clean up camera streams
    Object.values(cameraStreams).forEach(stream => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    });

    // Close WebSocket connections
    if (window.testInternalWS) {
      window.testInternalWS.close();
    }

    testLog('🛑 Test stopped by user');
  };

  // Enhanced diagnose function with detailed camera labels
  const diagnoseCameraIssues = async () => {
    testLog('🔧 Starting comprehensive camera diagnostic...');
    
    try {
      // Request permissions first to ensure labels are available
      let hasPermissions = false;
      
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        tempStream.getTracks().forEach(track => track.stop());
        hasPermissions = true;
        testLog('Camera permissions granted for diagnostics');
      } catch (permError) {
        testLog(`Camera permissions denied: ${permError.message}`, 'warn');
        testLog('Without camera permissions, device information will be limited', 'warn');
        testLog('Please grant camera permissions in your browser settings and try again', 'info');
      }
      
      // Wait a moment for permissions to take effect
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get all devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      testLog(`Found ${videoDevices.length} video device entries:`);
      
      // Show detailed info for each camera
      videoDevices.forEach((device, index) => {
        // Try to get the most descriptive label possible
        const label = device.label || 
          (hasPermissions ? `Unknown Camera ${index}` : `Camera ${index} (No Permission)`);
        
        // Safe access to device properties
        const deviceIdPreview = device.deviceId ? 
          `${device.deviceId.slice(0, 8)}...${device.deviceId.slice(-5)}` : 
          'unknown';
          
        testLog(`📷 Camera ${index}: ${label}`);
        testLog(`   Device ID: ${deviceIdPreview}`);
        testLog(`   Group ID: ${device.groupId || 'unknown'}`);
      });
      
      // Analyze for duplicates first
      const deviceGroups = new Map();
      videoDevices.forEach((device, index) => {
        // Create a device key based on available information
        const key = device.label 
          ? `${device.label}-${device.groupId}`
          : `unknown-${device.groupId}`;
          
        if (!deviceGroups.has(key)) {
          deviceGroups.set(key, []);
        }
        deviceGroups.get(key).push({ device, index });
      });
      
      testLog(`\nAnalysis of ${deviceGroups.size} unique physical devices:`);
      
      for (const [, group] of deviceGroups) { // eslint-disable-line no-unused-vars
        const device = group[0].device;
        testLog(`📷 Physical Device: ${device.label || 'Unknown'}`);
        testLog(`   Group ID: ${device.groupId}`);
        testLog(`   System Entries: ${group.length} (indices: ${group.map(g => g.index).join(', ')})`);
        
        if (group.length > 1) {
          if (device.label && device.label.includes('Microsoft LifeCam')) {
            testLog(`   ⚠️ KNOWN ISSUE: Microsoft LifeCam appears ${group.length} times (Windows driver behavior)`, 'warn');
            testLog(`   💡 This is normal - Windows lists the same camera multiple times`, 'warn');
          } else {
            testLog(`   ⚠️ DUPLICATE DETECTION: Same camera appears ${group.length} times`, 'warn');
            testLog(`   💡 Cannot use for dual camera - need different physical cameras`, 'warn');
          }
        }
      }
      
      // Test access to each unique physical device
      testLog('\n🧪 Testing camera access:');
      
      const testedDevices = new Set();
      let accessibleCameras = 0;
      
      for (let i = 0; i < videoDevices.length; i++) {
        const device = videoDevices[i];
        const deviceKey = device.label ? `${device.label}-${device.groupId}` : `unknown-${device.groupId}`;
        
        // Skip if we already tested this physical device
        if (testedDevices.has(deviceKey)) {
          testLog(`Skipping Camera ${i} - already tested this physical device`, 'info');
          continue;
        }
        
        testedDevices.add(deviceKey);
        const deviceName = device.label || `Unknown Device ${device.deviceId.slice(0, 8)}...`;
        testLog(`Testing Camera ${i}: ${deviceName}`);
        
        try {
          // Test with minimal constraints
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: { exact: device.deviceId },
              width: { ideal: 320 },
              height: { ideal: 240 }
            }
          });
          
          const videoTrack = testStream.getVideoTracks()[0];
          if (videoTrack) {
            const settings = videoTrack.getSettings();
            const actualLabel = videoTrack.label || deviceName;
            
            testLog(`✅ Camera ${i} is accessible:`, 'info');
            testLog(`   Label: ${actualLabel}`);
            testLog(`   Resolution: ${settings.width}x${settings.height}`);
            
            if (videoTrack.label && videoTrack.label !== device.label) {
              testLog(`   📝 Note: Track label "${videoTrack.label}" differs from device label "${device.label}"`, 'info');
            }
            
            accessibleCameras++;
          }
          
          // Clean up immediately
          testStream.getTracks().forEach(track => track.stop());
          
          // Small delay before next test
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          testLog(`❌ Camera ${i} failed: ${error.name} - ${error.message}`, 'error');
          
          // Specific error analysis
          if (error.name === 'NotReadableError') {
            testLog(`   → Likely in use by another application or same device conflict`, 'warn');
          } else if (error.name === 'NotAllowedError') {
            testLog(`   → Access denied - check browser permissions`, 'warn');
          } else if (error.name === 'NotFoundError') {
            testLog(`   → Device not found or disconnected`, 'warn');
          }
        }
      }
      
      // Final diagnosis
      testLog('\n📋 DIAGNOSIS SUMMARY:');
      testLog(`Total device entries detected: ${videoDevices.length}`);
      testLog(`Unique physical cameras: ${deviceGroups.size}`);
      testLog(`Accessible cameras: ${accessibleCameras}`);
      
      // Analyze the specific scenario from the logs
      const microsoftLifeCamCount = videoDevices.filter(d => 
        d.label && d.label.includes('Microsoft LifeCam VX-800')
      ).length;
      
      if (microsoftLifeCamCount > 1) {
        testLog('\n🔍 SPECIFIC ISSUE DETECTED:', 'warn');
        testLog(`Found ${microsoftLifeCamCount} entries for "Microsoft LifeCam VX-800"`, 'warn');
        testLog('💡 This is the EXACT issue from your logs - same camera appearing multiple times', 'error');
        testLog('📝 Windows is listing the same physical camera multiple times', 'info');
      }
      
      if (deviceGroups.size < 2) {
        testLog('\n❌ MAIN ISSUE: Only 1 unique physical camera detected', 'error');
        testLog('💡 PRIMARY SOLUTION: Connect a second physical camera (different model/brand)', 'info');
        testLog('💡 ALTERNATIVE: Configure OBS Virtual Camera (requires OBS Studio running)', 'info');
        
        if (videoDevices.length > 1) {
          testLog('📝 NOTE: Multiple entries detected but they are the same physical device', 'warn');
        }
      } else if (accessibleCameras < 2) {
        testLog('\n❌ ISSUE: Less than 2 cameras are accessible', 'error');
        testLog('💡 SOLUTION: Close other applications using cameras', 'info');
      } else {
        testLog('\n✅ GOOD: Multiple unique cameras are accessible for dual streaming', 'info');
      }
      
      testLog('🔧 Camera diagnosis completed');
      
    } catch (error) {
      testLog(`Camera diagnosis failed: ${error.message}`, 'error');
    }
  };

  const showCameraUsageTips = () => {
    const tips = [
      '💡 Close video conferencing apps (Teams, Zoom, Skype)',
      '💡 Close browser tabs with video calls or camera access',
      '💡 Exit OBS Studio or other streaming software',
      '💡 Close Windows Camera app if open',
      '💡 For dual camera testing, use 2 different physical cameras',
      '💡 Try different USB ports if cameras are not working',
      '💡 Check Windows Camera privacy settings (Windows + I → Privacy → Camera)',
      '💡 OBS Virtual Camera requires OBS Studio to be running with Virtual Camera started'
    ];
    
    tips.forEach(tip => testLog(tip, 'info'));
    
    testLog('📋 To check which apps are using cameras:', 'info');
    testLog('   1. Windows + I → Privacy & Security → Camera → Recent activity', 'info');
    testLog('   2. Task Manager → Details tab → Look for Teams.exe, Zoom.exe, obs64.exe', 'info');
    testLog('   3. Close any camera-using applications and try again', 'info');
  };

  // Auto-scroll logs
  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [realTimeLogs]);

  // Run initial health check
  useEffect(() => {
    checkSystemHealth();
  }, [checkSystemHealth]);

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🧪 End-to-End Camera Streaming Test</h1>
      
      {/* System Status */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h3>System Status</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div>Backend: <span style={{ color: systemStatus.backendConnected ? 'green' : 'red' }}>
            {systemStatus.backendConnected ? '✅ Connected' : '❌ Disconnected'}
          </span></div>
          <div>Internal Camera: <span style={{ color: systemStatus.internalCameraConnected ? 'green' : 'red' }}>
            {systemStatus.internalCameraConnected ? '✅ Available' : '❌ Not Found'}
          </span></div>
          <div>External Camera: <span style={{ color: systemStatus.externalCameraConnected ? 'green' : 'orange' }}>
            {systemStatus.externalCameraConnected ? '✅ Available' : '⚠️ Not Found'}
          </span></div>
          <div>Notification Service: <span style={{ color: systemStatus.notificationServiceConnected ? 'green' : 'orange' }}>
            {systemStatus.notificationServiceConnected ? '✅ Connected' : '⚠️ Disconnected'}
          </span></div>
        </div>
        <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={checkSystemHealth} 
            style={{ backgroundColor: '#2196F3', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🔄 Refresh System Status
          </button>
          <button 
            onClick={diagnoseCameraIssues} 
            style={{ backgroundColor: '#ff9800', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🔧 Diagnose Camera Issues
          </button>
          <button 
            onClick={showCameraUsageTips} 
            style={{ backgroundColor: '#2196F3', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            💡 Camera Usage Tips
          </button>
        </div>
      </div>

      {/* Test Configuration */}
      <div style={{ marginBottom: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h3>Test Configuration</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          <div>
            <label>Test Duration (seconds):</label>
            <input
              type="number"
              value={testConfig.test_duration}
              onChange={(e) => setTestConfig(prev => ({ ...prev, test_duration: parseInt(e.target.value) }))}
              disabled={testStatus.isRunning}
              style={{ width: '100%', marginTop: '5px' }}
            />
          </div>
          <div>
            <label>Test Name:</label>
            <input
              type="text"
              value={testConfig.test_name}
              onChange={(e) => setTestConfig(prev => ({ ...prev, test_name: e.target.value }))}
              disabled={testStatus.isRunning}
              style={{ width: '100%', marginTop: '5px' }}
            />
          </div>
        </div>
        
        <div style={{ marginTop: '10px' }}>
          <label>
            <input
              type="checkbox"
              checked={testConfig.enable_external_trigger}
              onChange={(e) => setTestConfig(prev => ({ ...prev, enable_external_trigger: e.target.checked }))}
              disabled={testStatus.isRunning}
            />
            Enable External Camera Trigger Test
          </label>
        </div>
      </div>

      {/* Test Controls */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={startEndToEndTest}
          disabled={testStatus.isRunning || !systemStatus.backendConnected}
          style={{
            backgroundColor: testStatus.isRunning ? '#ccc' : '#4CAF50',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '5px',
            marginRight: '10px',
            cursor: testStatus.isRunning ? 'not-allowed' : 'pointer'
          }}
        >
          {testStatus.isRunning ? '🔄 Test Running...' : '▶️ Start Test'}
        </button>

        {testStatus.isRunning && (
          <button
            onClick={stopTest}
            style={{
              backgroundColor: '#f44336',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              marginRight: '10px',
              cursor: 'pointer'
            }}
          >
            ⏹️ Stop Test
          </button>
        )}

        {testStatus.currentTestId && (
          <button
            onClick={downloadCombinedLogs}
            style={{
              backgroundColor: '#2196F3',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            💾 Download Logs
          </button>
        )}
      </div>

      {/* Test Status */}
      {testStatus.currentTestId && (
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '5px' }}>
          <strong>Current Test ID:</strong> {testStatus.currentTestId}<br/>
          <strong>Status:</strong> {testStatus.status}<br/>
          <strong>Logs Count:</strong> {realTimeLogs.length}
        </div>
      )}

      {/* WebSocket Test Clients */}
      <div style={{ marginBottom: '20px' }}>
        <h3>WebSocket Test Clients with Camera Streams</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <WebSocketTestClient 
            onLog={testLog} 
            testId={testStatus.currentTestId} 
            cameraType="internal" 
          />
          <WebSocketTestClient 
            onLog={testLog} 
            testId={testStatus.currentTestId} 
            cameraType="external" 
          />
        </div>
      </div>

      {/* Camera Streams */}
      {(cameraStreams.internal || cameraStreams.external) && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Camera Streams</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {cameraStreams.internal && (
              <CameraStreamDisplay 
                stream={cameraStreams.internal} 
                title="Internal Camera" 
                onError={(error) => testLog(`Internal camera error: ${error.message}`, 'error')}
              />
            )}
            {cameraStreams.external && (
              <CameraStreamDisplay 
                stream={cameraStreams.external} 
                title="External Camera" 
                onError={(error) => testLog(`External camera error: ${error.message}`, 'error')}
              />
            )}
          </div>
        </div>
      )}

      {/* Real-time Logs */}
      <div style={{ marginBottom: '20px' }}>
        <h3>Real-time Test Logs</h3>
        <div
          ref={logsContainerRef}
          style={{
            height: '400px',
            overflow: 'auto',
            padding: '10px',
            backgroundColor: '#000',
            color: '#00ff00',
            fontSize: '12px',
            fontFamily: 'Courier New, monospace',
            border: '1px solid #ccc',
            borderRadius: '5px'
          }}
        >
          {realTimeLogs.map((log, index) => (
            <div key={index} style={{
              color: log.type === 'error' ? '#ff6b6b' : 
                    log.type === 'warn' ? '#ffd93d' : '#00ff00'
            }}>
              [{log.timestamp}] [{log.type.toUpperCase()}] {log.message}
            </div>
          ))}
          {realTimeLogs.length === 0 && (
            <div style={{ color: '#888' }}>No logs yet. Start a test to see real-time output.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TestPage;