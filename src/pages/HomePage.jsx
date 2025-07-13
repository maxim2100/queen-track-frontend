import React, { useEffect, useState, useRef, useCallback } from 'react';

/*
 * FIXED ISSUES:
 * 1. enumerateCameraDevices() was running continuously due to dependency loops
 *    - Removed function dependencies that caused endless re-renders
 *    - Added preserveSelections parameter to control when to override user choices
 * 
 * 2. External camera selection was not preserved after triggers
 *    - Enhanced handleExternalCameraActivation to preserve user's camera selection
 *    - Added logic to only override selection if the device is no longer available
 *    - Added user selection protection with userIsSelectingCameraRef flag
 * 
 * 3. loadCameraConfig was overriding user selections
 *    - Added respectUserSelections parameter to prevent overriding user choices
 *    - Enhanced logging to show when user selections are preserved
 * 
 * 4. Infinite retry loop with NotReadableError
 *    - Added retry limits per device (max 2 attempts per device)
 *    - Added cooldown periods to prevent rapid retries
 *    - Added automatic reset of retry counters after 30 seconds
 *    - Added prevention of simultaneous activation attempts
 *    - Enhanced error reporting in UI with system status
 */

const websocketUrl = process.env.REACT_APP_WEBSOCKET_URL;
const backendUrl = process.env.REACT_APP_BACKEND_URL;

function HomePage() {
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedInternalDeviceId, setSelectedInternalDeviceId] = useState("");
  const [selectedExternalDeviceId, setSelectedExternalDeviceId] = useState("");
  const [stream, setStream] = useState(null);
  const [externalCameraStatus, setExternalCameraStatus] = useState("inactive"); // 'inactive', 'active', 'error'
  const [lastBeeStatus, setLastBeeStatus] = useState(null); // null, 'inside', 'outside'
  const [streamMode, setStreamMode] = useState("video"); // 'live' or 'video' - default to video
  const [, setCameraConfig] = useState({
    internalSelected: true,
    externalSelected: false
  });
  const [transitionDetected, setTransitionDetected] = useState(false);
  const [positionHistoryCount, setPositionHistoryCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState(null);
  const [consecutiveDetections, setConsecutiveDetections] = useState({inside: 0, outside: 0});
  const [modelInfo, setModelInfo] = useState(null);
  const [eventActive, setEventActive] = useState(false);
  const [statusSequence, setStatusSequence] = useState([]);
  const [eventAction, setEventAction] = useState(null);
  const [externalCameraStream, setExternalCameraStream] = useState(null);
  const [externalCameraActive, setExternalCameraActive] = useState(false);
  const videoRef = useRef(null);
  const externalVideoRef = useRef(null);
  const socketRef = useRef(null);
  const externalSocketRef = useRef(null);
  const notificationSocketRef = useRef(null);
  const statusCheckIntervalRef = useRef(null);
  const videoFileRef = useRef(null);
  const handleExternalCameraActivationRef = useRef(null);
  const stopExternalCameraRef = useRef(null);
  const userIsSelectingCameraRef = useRef(false);
  const configLoadTimeoutRef = useRef(null);
  const cameraRetryAttemptsRef = useRef(new Map()); // Track retry attempts per device
  const lastRetryTimeRef = useRef(0); // Prevent rapid retries

  // Function to load camera configuration from backend
  const loadCameraConfig = useCallback(async (skipIfUserSelecting = true, respectUserSelections = true) => {
    try {
      // Skip loading if user is currently selecting a camera
      if (skipIfUserSelecting && userIsSelectingCameraRef.current) {
        // eslint-disable-next-line no-console
        console.log("⏭️ [Camera Config] Skipping auto-load - user is selecting camera");
        return;
      }

      const response = await fetch(`${backendUrl}/video/external-camera-status`);
      if (response.ok) {
        const data = await response.json();
        // eslint-disable-next-line no-console
        console.log("📥 [Camera Config] Loaded configuration:", data);
        
        // Only set internal camera if not already set or if we're not respecting user selections
        if (!respectUserSelections || !selectedInternalDeviceId) {
          if (data.internal_camera_id && videoDevices.some(d => d.deviceId === data.internal_camera_id)) {
            setSelectedInternalDeviceId(data.internal_camera_id);
          }
        }
        
        // Only set external camera if not already set or if we're not respecting user selections
        if (!respectUserSelections || !selectedExternalDeviceId) {
          if (data.external_camera_id && videoDevices.some(d => d.deviceId === data.external_camera_id)) {
            setSelectedExternalDeviceId(data.external_camera_id);
            // eslint-disable-next-line no-console
            console.log("✅ [Camera Config] External camera loaded:", data.external_camera_id);
          }
        } else if (respectUserSelections && selectedExternalDeviceId) {
          // eslint-disable-next-line no-console
          console.log("🔒 [Camera Config] Preserving user's external camera selection:", selectedExternalDeviceId);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("💥 [Camera Config] Error loading camera config:", error);
    }
  }, [videoDevices, selectedInternalDeviceId, selectedExternalDeviceId]);

  // Function to enumerate camera devices with permission handling
  const enumerateCameraDevices = useCallback(async (requestPermissions = false, preserveSelections = true) => {
    try {
      // eslint-disable-next-line no-console
      console.log("📷 [Camera Enumeration] Starting device enumeration...");
      
      if (!navigator.mediaDevices) {
        // eslint-disable-next-line no-console
        console.error("📷 [Camera Enumeration] Media devices not available");
        setVideoDevices([]);
        return false;
      }

      // Request camera permissions if needed
      if (requestPermissions) {
        try {
          // eslint-disable-next-line no-console
          console.log("🔐 [Camera Enumeration] Requesting camera permissions...");
          const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
          tempStream.getTracks().forEach(track => track.stop());
          // eslint-disable-next-line no-console
          console.log("✅ [Camera Enumeration] Camera permissions granted");
        } catch (permError) {
          // eslint-disable-next-line no-console
          console.error("❌ [Camera Enumeration] Camera permissions denied:", permError);
          setVideoDevices([]);
          return false;
        }
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");
      
      // eslint-disable-next-line no-console
      console.log("📷 [Camera Enumeration] Found cameras:", cameras);
      
      // Store current selections before updating device list
      const currentInternalId = selectedInternalDeviceId;
      const currentExternalId = selectedExternalDeviceId;
      
      setVideoDevices(cameras);
      
      if (cameras.length > 0) {
        // Only set default devices if they're not already set AND we're not preserving selections
        if (!preserveSelections || !currentInternalId) {
          if (!currentInternalId) {
            setSelectedInternalDeviceId(cameras[0].deviceId);
          }
        }
        if (!preserveSelections || !currentExternalId) {
          if (!currentExternalId) {
            setSelectedExternalDeviceId(cameras.length > 1 ? cameras[1].deviceId : cameras[0].deviceId);
          }
        }
        
        // Only load configuration if we're not preserving user selections
        if (!preserveSelections) {
          // Try to load saved configuration after devices are detected
          // Clear any existing timeout
          if (configLoadTimeoutRef.current) {
            clearTimeout(configLoadTimeoutRef.current);
          }
          
          configLoadTimeoutRef.current = setTimeout(() => {
            loadCameraConfig(true, false); // Skip if user is selecting, don't respect user selections on initial load
          }, 1000);
        }
        return true;
      } else {
        // eslint-disable-next-line no-console
        console.warn("⚠️ [Camera Enumeration] No cameras found");
        return false;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("💥 [Camera Enumeration] Error:", error);
      setVideoDevices([]);
      return false;
    }
  }, ); // Remove dependencies to prevent continuous loop

  // Function to stop external camera
  const stopExternalCamera = useCallback(() => {
    try {
      // eslint-disable-next-line no-console
      console.log("🛑 [External Camera] Stopping external camera");
      
      // Stop external camera stream
      if (externalCameraStream) {
        externalCameraStream.getTracks().forEach((track) => track.stop());
        setExternalCameraStream(null);
      }
      
      // Clear external video source
      if (externalVideoRef.current) {
        externalVideoRef.current.srcObject = null;
      }
      
      // Close external WebSocket safely
      if (externalSocketRef.current && externalSocketRef.current.readyState !== WebSocket.CLOSED) {
        try {
          externalSocketRef.current.close();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn("🔇 [External Camera] WebSocket already closed:", error.message);
        }
        externalSocketRef.current = null;
      }
      
      setExternalCameraActive(false);
      setExternalCameraStatus("inactive");
      
      // Reset retry counters when successfully stopping
      cameraRetryAttemptsRef.current.clear();
      lastRetryTimeRef.current = 0;
      // eslint-disable-next-line no-console
      console.log("🔄 [External Camera] Retry counters reset on stop");
      
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("🛑 [External Camera] Error stopping external camera:", error);
    }
  }, [externalCameraStream]);

  // Function to start external camera with specific device
  const startExternalCameraWithDevice = useCallback(async (deviceId, availableCameras) => {
    try {
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera] Starting with device:", deviceId);
      
      if (externalCameraActive) {
        // eslint-disable-next-line no-console
        console.log("🎥 [External Camera] Already active");
        return;
      }
      
      if (!deviceId) {
        // eslint-disable-next-line no-console
        console.error("🎥 [External Camera] No device ID provided");
        setExternalCameraStatus("error");
        return;
      }
      
      // Check if mediaDevices is available
      if (!navigator.mediaDevices) {
        // eslint-disable-next-line no-console
        console.error("🎥 [External Camera] Media devices not available");
        setExternalCameraStatus("error");
        return;
      }
      
      // Check if trying to use the same device as internal camera
      if (deviceId === selectedInternalDeviceId && stream) {
        // eslint-disable-next-line no-console
        console.warn("🎥 [External Camera] Cannot use same device as internal camera, trying different device");
        
        // Try to find a different camera
        const otherCameras = availableCameras.filter(cam => cam.deviceId !== selectedInternalDeviceId);
        if (otherCameras.length > 0) {
          const altDeviceId = otherCameras[0].deviceId;
          // eslint-disable-next-line no-console
          console.log("🎥 [External Camera] Switching to alternative device:", altDeviceId);
          setSelectedExternalDeviceId(altDeviceId);
          return startExternalCameraWithDevice(altDeviceId, availableCameras);
        } else {
          // eslint-disable-next-line no-console
          console.error("🎥 [External Camera] No alternative camera available");
          setExternalCameraStatus("error");
          return;
        }
      }
      
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera] Starting external camera stream with device:", deviceId);
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera] Available cameras:", availableCameras?.length || 0);
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera] Internal camera device:", selectedInternalDeviceId);
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera] Internal camera active:", !!stream);
      
      const newExternalStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });
      
      if (externalVideoRef.current) {
        externalVideoRef.current.srcObject = newExternalStream;
      }
      
      setExternalCameraStream(newExternalStream);
      setExternalCameraActive(true);
      setExternalCameraStatus("active");
      
      // Connect to external camera WebSocket
      const fullExternalWebSocketUrl = `${websocketUrl}/video/external-camera-stream`;
      // eslint-disable-next-line no-console
      console.log("🔌 [External Camera WebSocket] Connecting to:", fullExternalWebSocketUrl);
      
      // Close any existing external WebSocket first
      if (externalSocketRef.current && externalSocketRef.current.readyState !== WebSocket.CLOSED) {
        // eslint-disable-next-line no-console
        console.log("🔄 [External Camera WebSocket] Closing existing connection");
        try {
          externalSocketRef.current.close();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn("🔇 [External Camera WebSocket] Error closing existing connection:", error.message);
        }
      }
      
      const externalSocket = new WebSocket(fullExternalWebSocketUrl);
      externalSocketRef.current = externalSocket;
      
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      
      const sendExternalFrame = () => {
        if (
          externalVideoRef.current &&
          externalSocket.readyState === WebSocket.OPEN &&
          externalCameraActive
        ) {
          canvas.width = externalVideoRef.current.videoWidth;
          canvas.height = externalVideoRef.current.videoHeight;
          context.drawImage(externalVideoRef.current, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) externalSocket.send(blob);
          }, "image/jpeg");
        }
      };
      
      const externalIntervalId = setInterval(sendExternalFrame, 100);
      
      externalSocket.onopen = () => {
        // eslint-disable-next-line no-console
        console.log("✅ [External Camera WebSocket] Connected successfully");
      };
      
      externalSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // eslint-disable-next-line no-console
          console.log("📡 [External Camera WebSocket] Status:", data);
        } catch (error) {
          // Non-JSON message, ignore
        }
      };
      
      externalSocket.onclose = () => {
        // eslint-disable-next-line no-console
        console.log("❌ [External Camera WebSocket] Connection closed");
        clearInterval(externalIntervalId);
      };
      
      externalSocket.onerror = (error) => {
        // eslint-disable-next-line no-console
        console.error("💥 [External Camera WebSocket] Error:", error);
        clearInterval(externalIntervalId);
      };
      
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("🎥 [External Camera] Error starting external camera:", error);
      
      // Provide detailed error information
      let errorMessage = "שגיאה לא ידועה";
      let possibleSolutions = [];
      
      if (error.name === 'NotReadableError') {
        errorMessage = "לא ניתן לגשת למצלמה";
        possibleSolutions = [
          "המצלמה כבר בשימוש על ידי אפליקציה אחרת",
          "נסה לסגור אפליקציות אחרות שמשתמשות במצלמה",
          "המצלמה החיצונית זהה למצלמה הפנימית",
          "נסה לבחור מצלמה אחרת"
        ];
      } else if (error.name === 'NotAllowedError') {
        errorMessage = "הרשאת גישה למצלמה נדחתה";
        possibleSolutions = [
          "לחץ על אייקון המצלמה בסרגל הכתובות",
          "אפשר גישה למצלמה בהגדרות הדפדפן",
          "רענן את הדף ונסה שוב"
        ];
      } else if (error.name === 'NotFoundError') {
        errorMessage = "המצלמה לא נמצאה";
        possibleSolutions = [
          "המצלמה נותקה מהמחשב",
          "בדוק שהמצלמה מחוברת",
          "נסה מצלמה אחרת מהרשימה"
        ];
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = "המצלמה לא תומכת בהגדרות הנדרשות";
        possibleSolutions = [
          "נסה מצלמה אחרת מהרשימה",
          "הגדרות המצלמה לא מתאימות"
        ];
      }
      
      // eslint-disable-next-line no-console
      console.error("🎥 [External Camera] Error details:", {
        name: error.name,
        message: error.message,
        deviceId: deviceId,
        availableCameras: availableCameras?.length || 0,
        internalCameraActive: !!stream,
        internalCameraDevice: selectedInternalDeviceId,
        sameDevice: deviceId === selectedInternalDeviceId,
        errorMessage,
        possibleSolutions
      });
      
      setExternalCameraStatus("error");
      
      // Try automatic recovery if it's a device conflict - with retry limits
      if (error.name === 'NotReadableError' && availableCameras && availableCameras.length > 1) {
        // Check if we've already tried this device too many times
        const currentRetries = cameraRetryAttemptsRef.current.get(deviceId) || 0;
        const maxRetries = 2; // Limit retries per device
        const cooldownPeriod = 5000; // 5 seconds between major retry attempts
        const currentTime = Date.now();
        
        if (currentRetries >= maxRetries) {
          // eslint-disable-next-line no-console
          console.log("🚫 [External Camera] Max retries reached for device:", deviceId);
          
          // Try next available camera that hasn't been exhausted
          const otherCameras = availableCameras.filter(cam => 
            cam.deviceId !== deviceId && 
            cam.deviceId !== selectedInternalDeviceId &&
            (cameraRetryAttemptsRef.current.get(cam.deviceId) || 0) < maxRetries
          );
          
          if (otherCameras.length > 0 && (currentTime - lastRetryTimeRef.current) > cooldownPeriod) {
            const nextDevice = otherCameras[0];
            // eslint-disable-next-line no-console
            console.log("🔄 [External Camera] Trying recovery with fresh device:", nextDevice.deviceId);
            setSelectedExternalDeviceId(nextDevice.deviceId);
            lastRetryTimeRef.current = currentTime;
            
            // Wait a bit before retrying
            setTimeout(() => {
              startExternalCameraWithDevice(nextDevice.deviceId, availableCameras);
            }, 1000);
          } else {
            // eslint-disable-next-line no-console
            console.error("❌ [External Camera] All cameras exhausted or in cooldown period");
            setExternalCameraStatus("error");
            
            // Reset retry counters after a longer cooldown
            setTimeout(() => {
              cameraRetryAttemptsRef.current.clear();
              lastRetryTimeRef.current = 0;
              // eslint-disable-next-line no-console
              console.log("🔄 [External Camera] Retry counters reset - ready for new attempts");
            }, 30000); // 30 seconds cooldown
          }
        } else {
          // eslint-disable-next-line no-console
          console.log("🔄 [External Camera] Attempting automatic recovery with different device...");
          
          // Increment retry counter for this device
          cameraRetryAttemptsRef.current.set(deviceId, currentRetries + 1);
          
          // Try next available camera
          const otherCameras = availableCameras.filter(cam => 
            cam.deviceId !== deviceId && 
            cam.deviceId !== selectedInternalDeviceId &&
            (cameraRetryAttemptsRef.current.get(cam.deviceId) || 0) < maxRetries
          );
          
          if (otherCameras.length > 0) {
            const nextDevice = otherCameras[0];
            // eslint-disable-next-line no-console
            console.log("🔄 [External Camera] Trying recovery with device:", nextDevice.deviceId, `(attempt ${currentRetries + 1}/${maxRetries})`);
            setSelectedExternalDeviceId(nextDevice.deviceId);
            
            // Wait a bit before retrying
            setTimeout(() => {
              startExternalCameraWithDevice(nextDevice.deviceId, availableCameras);
            }, 1000);
          } else {
            // eslint-disable-next-line no-console
            console.error("❌ [External Camera] No more cameras available for retry");
            setExternalCameraStatus("error");
          }
        }
      }
    }
  }, [externalCameraActive, selectedInternalDeviceId, stream]);

  // איסוף רשימת מצלמות - רק פעם אחת בטעינה
  // Fixed: Prevent continuous loop by removing function dependencies
  // Camera enumeration now only runs once on mount and when explicitly requested
  useEffect(() => {
    enumerateCameraDevices(false, false); // Don't preserve selections on initial load
  }, []); // Empty dependency array to run only once on mount

  // Clean up when component unmounts
  useEffect(() => {
    const cleanup = () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
      if (configLoadTimeoutRef.current) {
        clearTimeout(configLoadTimeoutRef.current);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      if (externalCameraStream) {
        externalCameraStream.getTracks().forEach((track) => track.stop());
      }
      // Close WebSockets safely
      if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
        try {
          socketRef.current.close();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn("🔇 [Main WebSocket] Already closed during cleanup");
        }
      }
      if (externalSocketRef.current && externalSocketRef.current.readyState !== WebSocket.CLOSED) {
        try {
          externalSocketRef.current.close();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn("🔇 [External WebSocket] Already closed during cleanup");
        }
      }
      if (notificationSocketRef.current && notificationSocketRef.current.readyState !== WebSocket.CLOSED) {
        try {
          notificationSocketRef.current.close();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.warn("🔇 [Notification WebSocket] Already closed during cleanup");
        }
      }
    };
    
    return cleanup;
  }, [stream, externalCameraStream]);

  // Helper function to handle external camera activation with fresh state
  const handleExternalCameraActivation = useCallback(async () => {
    try {
      // Prevent multiple simultaneous activation attempts
      if (externalCameraActive) {
        // eslint-disable-next-line no-console
        console.log("🎥 [External Camera] Activation skipped - already active");
        return;
      }
      
      // Check if we're in a cooldown period
      const currentTime = Date.now();
      if (currentTime - lastRetryTimeRef.current < 5000) {
        // eslint-disable-next-line no-console
        console.log("🎥 [External Camera] Activation skipped - in cooldown period");
        return;
      }
      
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera] Activation signal received");
      
      // Get fresh camera devices but preserve current selections
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");
      
      // eslint-disable-next-line no-console
      console.log("📷 [External Camera] Fresh devices found:", cameras.length);
      
      if (cameras.length === 0) {
        // eslint-disable-next-line no-console
        console.log("🔄 [External Camera] No devices available, requesting permissions and re-enumerating...");
        const success = await enumerateCameraDevices(true, true); // Preserve selections
        if (!success) {
          // eslint-disable-next-line no-console
          console.error("❌ [External Camera] Still no devices after re-enumeration");
          setExternalCameraStatus("error");
          return;
        }
        // Retry with fresh enumeration - but only once
        await new Promise(resolve => setTimeout(resolve, 1000));
        const retriedDevices = await navigator.mediaDevices.enumerateDevices();
        const retriedCameras = retriedDevices.filter((device) => device.kind === "videoinput");
        if (retriedCameras.length === 0) {
          // eslint-disable-next-line no-console
          console.error("❌ [External Camera] No cameras available after retry");
          setExternalCameraStatus("error");
          return;
        }
        // Use the retried cameras for the rest of the function
        cameras.splice(0, cameras.length, ...retriedCameras);
      }
      
      // Update state with fresh devices (preserve selections)
      setVideoDevices(cameras);
      
      // Use currently selected external device ID (preserve user's choice)
      let externalDeviceId = selectedExternalDeviceId;
      
      // Only override if the selected device is no longer available
      if (!externalDeviceId || !cameras.some(d => d.deviceId === externalDeviceId)) {
        // eslint-disable-next-line no-console
        console.log("🔄 [External Camera] Selected device not available, checking backend config...");
        
        // Try to load from backend configuration
        try {
          const response = await fetch(`${backendUrl}/video/external-camera-status`);
          if (response.ok) {
            const data = await response.json();
            // eslint-disable-next-line no-console
            console.log("📥 [External Camera] Loaded configuration:", data);
            
            if (data.external_camera_id && cameras.some(d => d.deviceId === data.external_camera_id)) {
              externalDeviceId = data.external_camera_id;
              setSelectedExternalDeviceId(externalDeviceId);
              // eslint-disable-next-line no-console
              console.log("✅ [External Camera] Using backend configured camera:", externalDeviceId);
            } else {
              // Fall back to auto-selection
              externalDeviceId = cameras.length > 1 ? cameras[1].deviceId : cameras[0].deviceId;
              setSelectedExternalDeviceId(externalDeviceId);
              // eslint-disable-next-line no-console
              console.log("🔄 [External Camera] Auto-selected camera:", externalDeviceId);
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error("💥 [External Camera] Error loading camera config:", error);
          // Fall back to auto-selection
          externalDeviceId = cameras.length > 1 ? cameras[1].deviceId : cameras[0].deviceId;
          setSelectedExternalDeviceId(externalDeviceId);
          // eslint-disable-next-line no-console
          console.log("🔄 [External Camera] Auto-selected fallback camera:", externalDeviceId);
        }
      } else {
        // eslint-disable-next-line no-console
        console.log("✅ [External Camera] Using preserved user selection:", externalDeviceId);
      }
      
      // Start external camera with the selected device
      await startExternalCameraWithDevice(externalDeviceId, cameras);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("💥 [External Camera] Activation error:", error);
      setExternalCameraStatus("error");
    }
  }, [enumerateCameraDevices, startExternalCameraWithDevice, selectedExternalDeviceId, externalCameraActive]);

  // Update refs when functions change
  useEffect(() => {
    handleExternalCameraActivationRef.current = handleExternalCameraActivation;
    stopExternalCameraRef.current = stopExternalCamera;
  }, [handleExternalCameraActivation, stopExternalCamera]);

  // Initialize notification WebSocket connection
  useEffect(() => {
    let reconnectTimeout = null;
    
    const connectNotificationWebSocket = () => {
      const fullNotificationUrl = `${websocketUrl}/video/notifications`;
      // eslint-disable-next-line no-console
      console.log("🔔 [HomePage Notification WebSocket] Connecting to:", fullNotificationUrl);
      
      const notificationSocket = new WebSocket(fullNotificationUrl);
      notificationSocketRef.current = notificationSocket;
      
      notificationSocket.onopen = () => {
        // eslint-disable-next-line no-console
        console.log("✅ [HomePage Notification WebSocket] Connected successfully");
      };
      
      notificationSocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          // eslint-disable-next-line no-console
          console.log("📢 [HomePage Notification WebSocket] Received:", data);
          
          if (data.type === "external_camera_control") {
            if (data.action === "activate") {
              if (handleExternalCameraActivationRef.current) {
                handleExternalCameraActivationRef.current();
              }
            } else if (data.action === "deactivate") {
              // eslint-disable-next-line no-console
              console.log("🛑 [External Camera] Deactivation signal received");
              if (stopExternalCameraRef.current) {
                stopExternalCameraRef.current();
              }
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log("📢 [HomePage Notification WebSocket] Non-JSON message:", event.data);
        }
      };
      
      notificationSocket.onclose = (event) => {
        // eslint-disable-next-line no-console
        console.log("❌ [HomePage Notification WebSocket] Connection closed:", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          url: fullNotificationUrl
        });
        
        // Only attempt to reconnect if the connection was not closed cleanly (e.g., due to network issues)
        if (!event.wasClean && event.code !== 1000) {
          // eslint-disable-next-line no-console
          console.log("🔄 [HomePage Notification WebSocket] Attempting to reconnect in 5 seconds...");
          reconnectTimeout = setTimeout(connectNotificationWebSocket, 5000);
        }
      };
      
      notificationSocket.onerror = (error) => {
        // eslint-disable-next-line no-console
        console.error("💥 [HomePage Notification WebSocket] Error occurred:", {
          error: error,
          type: error.type,
          target: error.target,
          url: fullNotificationUrl,
          readyState: notificationSocket.readyState,
          readyStateText: notificationSocket.readyState === 0 ? "CONNECTING" : 
                        notificationSocket.readyState === 1 ? "OPEN" : 
                        notificationSocket.readyState === 2 ? "CLOSING" : "CLOSED"
        });
      };
    };
    
    connectNotificationWebSocket();
    
    return () => {
      // Clear any pending reconnection timeout
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      // Close the WebSocket connection cleanly
      if (notificationSocketRef.current && notificationSocketRef.current.readyState === WebSocket.OPEN) {
        notificationSocketRef.current.close(1000, 'Component unmounting');
      }
    };
  }, []); // Empty dependency array to prevent constant reconnections

  const handleChangeInternalDevice = (event) => {
    // eslint-disable-next-line no-console
    console.log("🎥 [User Selection] Internal camera changed to:", event.target.value);
    
    // Set flag to prevent automatic config loading
    userIsSelectingCameraRef.current = true;
    
    // Clear any pending config load timeout
    if (configLoadTimeoutRef.current) {
      clearTimeout(configLoadTimeoutRef.current);
    }
    
    setSelectedInternalDeviceId(event.target.value);
    
    // Auto-save configuration when device changes
    setTimeout(saveCameraConfig, 500);
    
    // Clear the flag after a delay to allow auto-loading later
    setTimeout(() => {
      userIsSelectingCameraRef.current = false;
      // eslint-disable-next-line no-console
      console.log("🎥 [User Selection] Internal camera selection completed");
    }, 2000);
  };

  const handleChangeExternalDevice = (event) => {
    // eslint-disable-next-line no-console
    console.log("🎥 [User Selection] External camera changed to:", event.target.value);
    
    // Set flag to prevent automatic config loading
    userIsSelectingCameraRef.current = true;
    
    // Clear any pending config load timeout
    if (configLoadTimeoutRef.current) {
      clearTimeout(configLoadTimeoutRef.current);
    }
    
    setSelectedExternalDeviceId(event.target.value);
    
    // Auto-save configuration when device changes
    setTimeout(saveCameraConfig, 500);
    
    // Clear the flag after a delay to allow auto-loading later
    setTimeout(() => {
      userIsSelectingCameraRef.current = false;
      // eslint-disable-next-line no-console
      console.log("🎥 [User Selection] External camera selection completed - user choice locked:", event.target.value);
    }, 2000);
  };

  const handleStreamModeChange = (event) => {
    setStreamMode(event.target.value);
    // If currently streaming, restart with new mode
    if (stream || videoFileRef.current) {
      stopCamera();
    }
  };

  // Function to save camera configuration to backend
  const saveCameraConfig = async () => {
    try {
      // eslint-disable-next-line no-console
      console.log("💾 [Camera Config] Saving configuration:", {
        internal: selectedInternalDeviceId,
        external: selectedExternalDeviceId
      });
      
      const response = await fetch(`${backendUrl}/video/camera-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          internal_camera_id: selectedInternalDeviceId,
          external_camera_id: selectedExternalDeviceId
        }),
      });
      
      if (response.ok) {
        // eslint-disable-next-line no-console
        console.log("✅ [Camera Config] Configuration saved successfully");
        // Update local config state to show both cameras are configured
        setCameraConfig({
          internalSelected: true,
          externalSelected: true
        });
      } else {
        // eslint-disable-next-line no-console
        console.error("❌ [Camera Config] Failed to save camera configuration");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("💥 [Camera Config] Error saving camera config:", error);
    }
  };

  // Function to check the external camera status from the backend
  const checkExternalCameraStatus = async () => {
    try {
      const response = await fetch(`${backendUrl}/video/external-camera-status`);
      if (response.ok) {
        const data = await response.json();
        setExternalCameraStatus(data.is_recording ? "active" : "inactive");
        setLastBeeStatus(data.last_bee_status || null);
        
        // If the external camera is streaming and we have a URL, display it
        if (data.is_recording && data.stream_url && externalVideoRef.current) {
          // This is a simplified approach - in a real implementation you might use 
          // HLS, RTSP, or WebRTC to display the camera stream
          if (externalVideoRef.current.src !== data.stream_url) {
            externalVideoRef.current.src = data.stream_url;
            externalVideoRef.current.load();
            externalVideoRef.current.play().catch(err => {
              // eslint-disable-next-line no-console
              // console.error("Error playing external video:", err);
            });
          }
        }
      } else {
        setExternalCameraStatus("error");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      // console.error("Error checking external camera status:", error);
      setExternalCameraStatus("error");
    }
  };

  // Function to fetch debug information
  const fetchDebugInfo = async () => {
    try {
      const response = await fetch(`${backendUrl}/video/debug/bee-tracking-status`);
      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      // console.error("Error fetching debug info:", error);
    }
  };

  // Function to fetch model information
  const fetchModelInfo = async () => {
    try {
      const response = await fetch(`${backendUrl}/video/debug/model-info`);
      if (response.ok) {
        const data = await response.json();
        setModelInfo(data);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      // console.error("Error fetching model info:", error);
    }
  };

  // Function to reset tracking state
  const resetTracking = async () => {
    try {
      const response = await fetch(`${backendUrl}/video/debug/reset-tracking`, {
        method: 'POST'
      });
      if (response.ok) {
        // eslint-disable-next-line no-console
        // console.log("Tracking state reset successfully");
        // Refresh debug info after reset
        setTimeout(fetchDebugInfo, 500);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      // console.error("Error resetting tracking:", error);
    }
  };

  // Function to set initial bee status
  const setInitialStatus = async (status) => {
    try {
      const response = await fetch(`${backendUrl}/video/debug/set-initial-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: status })
      });
      if (response.ok) {
        // eslint-disable-next-line no-console
        // console.log(`Initial status set to: ${status}`);
        // Refresh debug info after setting status
        setTimeout(fetchDebugInfo, 500);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      // console.error("Error setting initial status:", error);
    }
  };

  const startCamera = async () => {
    try {
      if (streamMode === "live") {
        // Original live camera functionality
        if (!selectedInternalDeviceId) return;
        
        // Check if mediaDevices is available
        if (!navigator.mediaDevices) {
          // eslint-disable-next-line no-console
          // console.error("Camera access not available. Requires HTTPS or localhost.");
          alert("Camera access requires HTTPS. Please use HTTPS to access the camera features.");
          return;
        }
        
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedInternalDeviceId } }
        });
    
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
    
        setStream(newStream);
        
        const fullWebSocketUrl = `${websocketUrl}/video/live-stream`;
        // eslint-disable-next-line no-console
        console.log("🔌 [LIVE WebSocket Debug] Attempting to connect to:", fullWebSocketUrl);
        // eslint-disable-next-line no-console
        console.log("🔌 [LIVE WebSocket Debug] Base websocketUrl:", websocketUrl);
        // eslint-disable-next-line no-console
        console.log("🔌 [LIVE WebSocket Debug] backendUrl:", backendUrl);
        // eslint-disable-next-line no-console
        console.log("🔌 [LIVE WebSocket Debug] Environment variables:", {
          REACT_APP_WEBSOCKET_URL: process.env.REACT_APP_WEBSOCKET_URL,
          REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL,
          NODE_ENV: process.env.NODE_ENV
        });
        
        const socket = new WebSocket(fullWebSocketUrl);
        socketRef.current = socket;
    
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
    
        const sendFrame = () => {
          if (
            videoRef.current &&
            socket.readyState === WebSocket.OPEN
          ) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              if (blob) socket.send(blob);
            }, "image/jpeg");
          }
        };
    
        const intervalId = setInterval(sendFrame, 100); 
    
        socket.onmessage = (event) => {
          // We can receive status updates from the server
          try {
            const data = JSON.parse(event.data);
            if (data.bee_status) {
              setLastBeeStatus(data.bee_status);
            }
            if (data.external_camera_status !== undefined) {
              setExternalCameraStatus(data.external_camera_status ? "active" : "inactive");
            }
            if (data.event_action !== undefined) {
              setEventAction(data.event_action);
              setTransitionDetected(data.event_action !== null);
              // Clear event action indicator after 3 seconds
              if (data.event_action) {
                setTimeout(() => {
                  setEventAction(null);
                  setTransitionDetected(false);
                }, 3000);
              }
            }
            if (data.position_history_count !== undefined) {
              setPositionHistoryCount(data.position_history_count);
            }
            if (data.consecutive_inside !== undefined && data.consecutive_outside !== undefined) {
              setConsecutiveDetections({
                inside: data.consecutive_inside,
                outside: data.consecutive_outside
              });
            }
            if (data.event_active !== undefined) {
              setEventActive(data.event_active);
            }
            if (data.status_sequence !== undefined) {
              setStatusSequence(data.status_sequence);
            }
          } catch (error) {
            // Not a JSON message, ignore
          }
        };
        
        socket.onopen = () => {
          // eslint-disable-next-line no-console
          console.log("✅ [LIVE WebSocket] Connection opened successfully to:", fullWebSocketUrl);
        };
        
        socket.onclose = (event) => {
          // eslint-disable-next-line no-console
          console.log("❌ [LIVE WebSocket] Connection closed:", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            url: fullWebSocketUrl
          });
          clearInterval(intervalId);
        };
    
        socket.onerror = (error) => {
          // eslint-disable-next-line no-console
          console.error("💥 [LIVE WebSocket] Error occurred:", {
            error: error,
            type: error.type,
            target: error.target,
            url: fullWebSocketUrl,
            readyState: socket.readyState,
            readyStateText: socket.readyState === 0 ? "CONNECTING" : 
                          socket.readyState === 1 ? "OPEN" : 
                          socket.readyState === 2 ? "CLOSING" : "CLOSED"
          });
          clearInterval(intervalId);
        };
        
      } else if (streamMode === "video") {
        // Video file streaming functionality
        if (videoRef.current) {
          videoRef.current.src = "/sample-videos/sample-hive-video.mp4";
          videoRef.current.load();
          
          // Set up video to loop and play
          videoRef.current.loop = true;
          videoRef.current.muted = true; // Mute to allow autoplay
          
          try {
            await videoRef.current.play();
          } catch (error) {
            // eslint-disable-next-line no-console
            // console.error("Error playing video file:", error);
            return;
          }
        }
        
        const fullWebSocketUrl = `${websocketUrl}/video/live-stream`;
        // eslint-disable-next-line no-console
        console.log("🔌 [VIDEO WebSocket Debug] Attempting to connect to:", fullWebSocketUrl);
        // eslint-disable-next-line no-console
        console.log("🔌 [VIDEO WebSocket Debug] Base websocketUrl:", websocketUrl);
        // eslint-disable-next-line no-console
        console.log("🔌 [VIDEO WebSocket Debug] backendUrl:", backendUrl);
        // eslint-disable-next-line no-console
        console.log("🔌 [VIDEO WebSocket Debug] Environment variables:", {
          REACT_APP_WEBSOCKET_URL: process.env.REACT_APP_WEBSOCKET_URL,
          REACT_APP_BACKEND_URL: process.env.REACT_APP_BACKEND_URL,
          NODE_ENV: process.env.NODE_ENV
        });
        
        const socket = new WebSocket(fullWebSocketUrl);
        socketRef.current = socket;
    
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
    
        const sendFrame = () => {
          if (
            videoRef.current &&
            socket.readyState === WebSocket.OPEN &&
            !videoRef.current.paused &&
            !videoRef.current.ended
          ) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              if (blob) socket.send(blob);
            }, "image/jpeg");
          }
        };
    
        const intervalId = setInterval(sendFrame, 100); 
    
        socket.onmessage = (event) => {
          // We can receive status updates from the server
          try {
            const data = JSON.parse(event.data);
            if (data.bee_status) {
              setLastBeeStatus(data.bee_status);
            }
            if (data.external_camera_status !== undefined) {
              setExternalCameraStatus(data.external_camera_status ? "active" : "inactive");
            }
            if (data.event_action !== undefined) {
              setEventAction(data.event_action);
              setTransitionDetected(data.event_action !== null);
              // Clear event action indicator after 3 seconds
              if (data.event_action) {
                setTimeout(() => {
                  setEventAction(null);
                  setTransitionDetected(false);
                }, 3000);
              }
            }
            if (data.position_history_count !== undefined) {
              setPositionHistoryCount(data.position_history_count);
            }
            if (data.consecutive_inside !== undefined && data.consecutive_outside !== undefined) {
              setConsecutiveDetections({
                inside: data.consecutive_inside,
                outside: data.consecutive_outside
              });
            }
            if (data.event_active !== undefined) {
              setEventActive(data.event_active);
            }
            if (data.status_sequence !== undefined) {
              setStatusSequence(data.status_sequence);
            }
          } catch (error) {
            // Not a JSON message, ignore
          }
        };
        
        socket.onopen = () => {
          // eslint-disable-next-line no-console
          console.log("✅ [VIDEO WebSocket] Connection opened successfully to:", fullWebSocketUrl);
        };
        
        socket.onclose = (event) => {
          // eslint-disable-next-line no-console
          console.log("❌ [VIDEO WebSocket] Connection closed:", {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            url: fullWebSocketUrl
          });
          clearInterval(intervalId);
        };
    
        socket.onerror = (error) => {
          // eslint-disable-next-line no-console
          console.error("💥 [VIDEO WebSocket] Error occurred:", {
            error: error,
            type: error.type,
            target: error.target,
            url: fullWebSocketUrl,
            readyState: socket.readyState,
            readyStateText: socket.readyState === 0 ? "CONNECTING" : 
                          socket.readyState === 1 ? "OPEN" : 
                          socket.readyState === 2 ? "CLOSING" : "CLOSED"
          });
          clearInterval(intervalId);
        };
      }
  
      // Start polling for external camera status
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
      statusCheckIntervalRef.current = setInterval(checkExternalCameraStatus, 5000); // Check every 5 seconds
      
      // Check status immediately
      checkExternalCameraStatus();
  
    } catch (error) {
      // eslint-disable-next-line no-console
      // console.error("Error starting camera/video:", error);
    }
  };



  const stopCamera = () => {
    // Stop live camera stream if active
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    
    // Stop external camera if active
    stopExternalCamera();
    
    // Stop video and clear source
    if (videoRef.current) {
      if (streamMode === "live") {
        videoRef.current.srcObject = null;
      } else {
        videoRef.current.pause();
        videoRef.current.src = "";
        videoRef.current.load();
      }
    }

    // Clear status check interval
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
      statusCheckIntervalRef.current = null;
    }

    // סגירת WebSocket safely
    if (socketRef.current && socketRef.current.readyState !== WebSocket.CLOSED) {
      try {
        socketRef.current.close();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn("🔇 [Main WebSocket] Already closed during stop");
      }
      socketRef.current = null;
    }
    
    // Reset status
    setExternalCameraStatus("inactive");
    setLastBeeStatus(null);
    setTransitionDetected(false);
    setPositionHistoryCount(0);
    setDebugInfo(null);
    setConsecutiveDetections({inside: 0, outside: 0});
    setModelInfo(null);
    setEventActive(false);
    setStatusSequence([]);
    setEventAction(null);
  };

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

  const selectStyle = {
    padding: '0.5rem',
    fontSize: '1rem',
    marginRight: '0.5rem'
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

  const configurationBoxStyle = {
    backgroundColor: '#fff',
    padding: '1rem',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    marginBottom: '2rem',
    width: '100%',
    maxWidth: '1000px'
  };
  
  const cameraSelectorStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '1rem',
    flexWrap: 'wrap'
  };

  const cameraSelectionContainerStyle = {
    flex: '1 1 300px',
    margin: '0.5rem',
    padding: '0.5rem',
    border: '1px solid #eee',
    borderRadius: '4px'
  };

  const videoWrapperStyle = {
    position: 'relative',
    width: '60%',           // 60% מרוחב העמוד
    maxWidth: '800px',      // אפשר להגביל רוחב מקסימלי
    margin: '1rem auto',
    border: '2px solid #ccc',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#000'
  };

  const videosContainerStyle = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    width: '100%',
    maxWidth: '1200px'
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
    backgroundColor: lastBeeStatus === "outside" ? 'orange' : 'green',
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

  const debugPanelStyle = {
    backgroundColor: '#f8f9fa',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '1rem',
    marginTop: '1rem',
    maxWidth: '1000px',
    width: '100%'
  };

  const videoStyle = {
    width: '100%',
    height: 'auto'
  };

  return (
    <div style={containerStyle}>
      <style>
        {`
          @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
          }
        `}
      </style>
      <h1 style={headerStyle}>ברוכים הבאים ל-Queen Track</h1>
      <p>בחר את המצלמות שלך והתחל לנטר את פעילות הדבורים</p>
      
      {/* HTTPS Warning */}
      {!navigator.mediaDevices && (
        <div style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '8px',
          padding: '1rem',
          margin: '1rem 0',
          color: '#856404'
        }}>
          <h3 style={{margin: '0 0 0.5rem 0', color: '#856404'}}>⚠️ דרוש HTTPS לגישה למצלמה</h3>
          <p style={{margin: 0}}>
            גישה למצלמה דורשת חיבור מאובטח (HTTPS). כרגע האתר נפתח דרך HTTP, 
            מה שמונע גישה למצלמות. ניתן עדיין להשתמש בשידור קובץ הווידאו לבדיקה.
          </p>
        </div>
      )}

      <div style={configurationBoxStyle}>
        <h2>הגדרת מצלמות</h2>
        
        {/* Camera Permission Status */}
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: videoDevices.length > 0 ? '#d4edda' : '#f8d7da',
          border: `1px solid ${videoDevices.length > 0 ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '6px',
          color: videoDevices.length > 0 ? '#155724' : '#721c24'
        }}>
          <h4 style={{margin: '0 0 0.5rem 0'}}>
            {videoDevices.length > 0 ? '✅ סטטוס מצלמות: פעילות' : '⚠️ סטטוס מצלמות: לא זמינות'}
          </h4>
          <div style={{fontSize: '0.9rem'}}>
            {videoDevices.length > 0 ? (
              <>
                <div><strong>מצלמות זמינות:</strong> {videoDevices.length}</div>
                <div><strong>הרשאות:</strong> ניתנו בהצלחה</div>
              </>
            ) : (
              <>
                <div><strong>בעיה:</strong> לא נמצאו מצלמות זמינות</div>
                <div><strong>פתרונות אפשריים:</strong></div>
                <ul style={{margin: '0.5rem 0', paddingRight: '1.5rem'}}>
                  <li>לחץ על "🔐 בקש הרשאות מצלמה"</li>
                  <li>וודא שהאתר נגיש דרך HTTPS</li>
                  <li>בדוק שמצלמות מחוברות למחשב</li>
                  <li>רענן את הדף ונסה שוב</li>
                </ul>
              </>
            )}
          </div>
        </div>
        
        {/* Stream Mode Selection */}
        <div style={{marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f0f8ff', borderRadius: '6px', border: '1px solid #ddd'}}>
          <h3>מצב שידור מצלמת הכניסה</h3>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap'}}>
            <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <input
                type="radio"
                name="streamMode"
                value="video"
                checked={streamMode === "video"}
                onChange={handleStreamModeChange}
              />
              <span>שידור קובץ וידאו לדוגמה (ברירת מחדל)</span>
            </label>
            <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <input
                type="radio"
                name="streamMode"
                value="live"
                checked={streamMode === "live"}
                onChange={handleStreamModeChange}
              />
              <span>שידור חי מהמצלמה</span>
            </label>
          </div>
          <p style={{fontSize: '0.9rem', color: '#666', marginTop: '0.5rem'}}>
            {streamMode === "video" 
              ? "קובץ הווידאו ישודר בלולאה ויועבר לשרת לעיבוד. החלף את הקובץ בתיקיית public/sample-videos/"
              : "המצלמה הנבחרת תשדר בזמן אמת"}
          </p>
          
          <div style={{backgroundColor: '#e8f5e8', padding: '1rem', marginTop: '1rem', borderRadius: '4px', border: '1px solid #4CAF50'}}>
            <h4 style={{margin: '0 0 0.5rem 0', color: '#2e7d32'}}>🎯 זיהוי אירועים מבוסס קו מרכזי</h4>
            <p style={{fontSize: '0.9rem', color: '#2e7d32', margin: 0}}>
              <strong>קו צהוב במרכז המסך:</strong> מפריד בין צד ימין (תוך הכוורת) לצד שמאל (מחוץ לכוורת)<br/>
              <strong>התחלת אירוע:</strong> דבורה עוברת מימין לשמאל (יוצאת מהכוורת) 🚪<br/>
              <strong>סיום אירוע:</strong> דבורה עוברת משמאל לימין (חוזרת לכוורת) 🏠
            </p>
          </div>
        </div>
        
        <div style={cameraSelectorStyle}>
          {/* Internal Camera Selection - only show in live mode */}
          {streamMode === "live" && (
            <div style={cameraSelectionContainerStyle}>
              <h3>מצלמת כניסה לכוורת</h3>
              <p>מצלמה זו תפקח על פתח הכוורת ותזהה כניסות ויציאות של הדבורה המסומנת</p>
              {!navigator.mediaDevices ? (
                <div style={{
                  padding: '0.5rem',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  color: '#6c757d'
                }}>
                  גישה למצלמה לא זמינה (דרוש HTTPS)
                </div>
              ) : (
                <select 
                  value={selectedInternalDeviceId} 
                  onChange={handleChangeInternalDevice} 
                  style={selectStyle}
                >
                  {videoDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `מצלמה ${videoDevices.indexOf(device) + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
          
          {/* External Camera Selection */}
          <div style={cameraSelectionContainerStyle}>
            <h3>מצלמה חיצונית</h3>
            <p>מצלמה זו תופעל אוטומטית כאשר הדבורה המסומנת יוצאת מהכוורת</p>
            {!navigator.mediaDevices ? (
              <div style={{
                padding: '0.5rem',
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                color: '#6c757d'
              }}>
                גישה למצלמה לא זמינה (דרוש HTTPS)
              </div>
            ) : (
              <>
                <select 
                  value={selectedExternalDeviceId} 
                  onChange={handleChangeExternalDevice} 
                  style={selectStyle}
                >
                  {videoDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `מצלמה ${videoDevices.indexOf(device) + 1}`}
                    </option>
                  ))}
                </select>
                
                {/* Debug Info */}
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem',
                  backgroundColor: '#f0f8ff',
                  border: '1px solid #cce7ff',
                  borderRadius: '4px',
                  fontSize: '0.9rem'
                }}>
                  <div><strong>🎯 מצלמה נבחרת:</strong> {selectedExternalDeviceId ? 
                    (videoDevices.find(d => d.deviceId === selectedExternalDeviceId)?.label || 'לא ידוע') : 
                    'לא נבחרה'}</div>
                  <div><strong>🆔 Device ID:</strong> {selectedExternalDeviceId || 'N/A'}</div>
                  <div><strong>📋 זמינות:</strong> {videoDevices.length} מצלמות זמינות</div>
                  {selectedExternalDeviceId === selectedInternalDeviceId && (
                    <div style={{color: '#dc3545', fontWeight: 'bold', marginTop: '5px'}}>
                      ⚠️ אזהרה: מצלמה זהה למצלמה הפנימית!
                    </div>
                  )}
                </div>
                
                {/* Manual Test Button */}
                <button 
                  onClick={() => {
                    // eslint-disable-next-line no-console
                    console.log("🧪 [Manual Test] Testing external camera activation");
                    handleExternalCameraActivation();
                  }}
                  style={{
                    ...buttonStyle, 
                    backgroundColor: '#6f42c1', 
                    color: 'white', 
                    border: 'none',
                    marginTop: '0.5rem',
                    fontSize: '0.9rem'
                  }}
                >
                  🧪 בדוק מצלמה חיצונית ידנית
                </button>
              </>
            )}
          </div>
        </div>
        
        <button 
          onClick={saveCameraConfig} 
          style={{...buttonStyle, backgroundColor: '#4CAF50', color: 'white', border: 'none'}}
        >
          שמור הגדרות מצלמה
        </button>
        
        {/* Camera Permission Request Button */}
        <button 
          onClick={async () => {
            // eslint-disable-next-line no-console
            console.log("🔐 [Manual Permission] Requesting camera permissions...");
            
            // Clear user selection flag temporarily to allow initial config load
            userIsSelectingCameraRef.current = false;
            
            const success = await enumerateCameraDevices(true, true); // Preserve current selections
            if (success) {
              alert("✅ גישה למצלמות הוקמה בהצלחה!");
            } else {
              alert("❌ שגיאה בגישה למצלמות. אנא וודא שהעברת הרשאות וש-HTTPS פעיל.");
            }
          }}
          style={{
            ...buttonStyle, 
            backgroundColor: '#ff9800', 
            color: 'white', 
            border: 'none',
            marginRight: '1rem'
          }}
        >
          🔐 בקש הרשאות מצלמה
        </button>
      </div>

      <div style={buttonGroupStyle}>
        <button onClick={startCamera} style={buttonStyle}>
          {streamMode === "video" ? "התחל שידור וידאו" : "התחל לצלם"}
        </button>
        <button onClick={stopCamera} style={buttonStyle}>
          {streamMode === "video" ? "עצור שידור" : "כבה מצלמה"}
        </button>
      </div>

      <div style={videosContainerStyle}>
        {/* Main Camera (at the hive entrance) */}
        <div style={{...videoWrapperStyle, marginRight: '10px', flex: 1}}>
          <h3 style={{textAlign: 'center', margin: '0.5rem 0'}}>
            מצלמת כניסה לכוורת {streamMode === "video" ? "(וידאו לדוגמה)" : "(שידור חי)"}
          </h3>
          {(stream || (streamMode === "video" && videoRef.current && !videoRef.current.paused)) && (
            <div style={{...liveBadgeStyle, backgroundColor: streamMode === "video" ? '#ff6b35' : 'red'}}>
              {streamMode === "video" ? "VIDEO" : "LIVE"}
            </div>
          )}
          {lastBeeStatus && (
            <div style={statusBadgeStyle}>
              דבורה {lastBeeStatus === "inside" ? "בפנים" : "בחוץ"}
              {positionHistoryCount > 0 && ` (${positionHistoryCount} נקודות)`}
            </div>
          )}
          {transitionDetected && (
            <div style={transitionBadgeStyle}>
              {eventAction === "start_event" ? "EVENT STARTED!" : 
               eventAction === "end_event" ? "EVENT ENDED!" : "EVENT!"}
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={videoStyle}
          />
        </div>

        {/* External Camera (for outside recording) */}
        <div style={{...videoWrapperStyle, flex: 1}}>
          <h3 style={{textAlign: 'center', margin: '0.5rem 0'}}>מצלמה חיצונית (אוטומטית)</h3>
          {externalCameraActive ? (
            <div style={{...liveBadgeStyle, backgroundColor: 'green'}}>
              TRACKING ACTIVE
            </div>
          ) : eventActive ? (
            <div style={{...liveBadgeStyle, backgroundColor: 'orange'}}>
              STARTING...
            </div>
          ) : (
            <div style={{
              ...liveBadgeStyle, 
              backgroundColor: externalCameraStatus === "error" ? 'red' : 'gray'
            }}>
              {externalCameraStatus === "error" ? "ERROR" : "WAITING"}
            </div>
          )}
          
          {externalCameraActive ? (
            <video
              ref={externalVideoRef}
              autoPlay
              playsInline
              style={videoStyle}
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '300px',
              backgroundColor: '#222',
              color: '#fff',
              fontSize: '1rem',
              textAlign: 'center',
              padding: '20px'
            }}>
              {externalCameraStatus === "error" ? (
                <>
                  <div style={{fontSize: '1.2rem', color: '#ff6b6b', marginBottom: '10px'}}>
                    ⚠️ שגיאה במצלמה חיצונית
                  </div>
                  <div style={{fontSize: '0.9rem', color: '#ccc', marginBottom: '10px'}}>
                    המצלמה לא זמינה או בשימוש
                  </div>
                  <div style={{fontSize: '0.8rem', color: '#999', textAlign: 'right', lineHeight: '1.4'}}>
                    <div><strong>פתרונות אפשריים:</strong></div>
                    <div>• בדוק שהמצלמה מחוברת</div>
                    <div>• סגור אפליקציות אחרות שמשתמשות במצלמה</div>
                    <div>• בחר מצלמה אחרת בהגדרות</div>
                    <div>• רענן את הדף ונסה שוב</div>
                    <div>• המתן 30 שניות עד שהמערכת מתאפסת</div>
                  </div>
                  <div style={{fontSize: '0.7rem', color: '#666', marginTop: '10px', textAlign: 'center'}}>
                    <div><strong>סטטוס מערכת:</strong></div>
                    <div>ניסיונות נוכחיים: {Array.from(cameraRetryAttemptsRef.current.entries()).map(([id, count]) => `${count}`).join(', ') || 'אין'}</div>
                    <div>זמן איפוס אחרון: {lastRetryTimeRef.current ? new Date(lastRetryTimeRef.current).toLocaleTimeString() : 'אין'}</div>
                  </div>
                  <button
                    onClick={() => {
                      // eslint-disable-next-line no-console
                      console.log("🔄 [Manual Recovery] Attempting to restart external camera");
                      // Reset retry counters for manual retry
                      cameraRetryAttemptsRef.current.clear();
                      lastRetryTimeRef.current = 0;
                      handleExternalCameraActivation();
                    }}
                    style={{
                      marginTop: '10px',
                      padding: '8px 16px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    🔄 נסה שוב (איפוס מלא)
                  </button>
                </>
              ) : eventActive ? (
                <>
                  <div style={{fontSize: '1.2rem', color: '#ffa500', marginBottom: '10px'}}>
                    🔄 מתחיל מעקב חיצוני...
                  </div>
                  <div style={{fontSize: '0.9rem', color: '#ccc'}}>
                    המצלמה החיצונית מופעלת אוטומטית
                  </div>
                </>
              ) : (
                <>
                  <div style={{fontSize: '1.2rem', color: '#888', marginBottom: '10px'}}>
                    📱 ממתין לאירוע יציאה
                  </div>
                  <div style={{fontSize: '0.9rem', color: '#ccc'}}>
                    המצלמה תופעל אוטומטית כאשר<br/>
                    הדבורה המסומנת תצא מהכוורת
                  </div>
                  <div style={{fontSize: '0.8rem', color: '#666', marginTop: '10px'}}>
                    🎯 מצלמה נבחרת: {selectedExternalDeviceId ? 
                      (videoDevices.find(d => d.deviceId === selectedExternalDeviceId)?.label || `מצלמה ${videoDevices.findIndex(d => d.deviceId === selectedExternalDeviceId) + 1}`) : 
                      'לא נבחרה'}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Debug Information Panel */}
      <div style={debugPanelStyle}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem'}}>
          <h3>מידע דיבוג ומעקב</h3>
          <div>
            <button 
              onClick={fetchModelInfo}
              style={{...buttonStyle, backgroundColor: '#6f42c1', color: 'white', border: 'none', marginLeft: '0.5rem'}}
            >
              מידע מודל
            </button>
            <button 
              onClick={fetchDebugInfo}
              style={{...buttonStyle, backgroundColor: '#17a2b8', color: 'white', border: 'none', marginLeft: '0.5rem'}}
            >
              רענן מידע דיבוג
            </button>
            <button 
              onClick={resetTracking}
              style={{...buttonStyle, backgroundColor: '#dc3545', color: 'white', border: 'none'}}
            >
              אפס מעקב
            </button>
            <button 
              onClick={() => {
                cameraRetryAttemptsRef.current.clear();
                lastRetryTimeRef.current = 0;
                setExternalCameraStatus("inactive");
                // eslint-disable-next-line no-console
                console.log("🔄 [Manual Reset] Camera retry counters reset");
                alert("מוני הניסיונות נמחקו! כעת ניתן לנסות שוב עם המצלמה החיצונית.");
              }}
              style={{...buttonStyle, backgroundColor: '#28a745', color: 'white', border: 'none', marginLeft: '0.5rem'}}
            >
              אפס מוני מצלמה
            </button>
          </div>
        </div>
        
        {/* Initial Status Setting */}
        <div style={{backgroundColor: '#fff3cd', padding: '1rem', borderRadius: '6px', margin: '1rem 0', border: '1px solid #ffeaa7'}}>
          <h4>הגדרת מצב התחלתי (לבדיקה)</h4>
          <p style={{fontSize: '0.9rem', color: '#856404', marginBottom: '1rem'}}>
            השתמש בכפתורים הללו כדי להגדיר מצב התחלתי של הדבורה ולבדוק את זיהוי המעברים
          </p>
          <div>
            <button 
              onClick={() => setInitialStatus('inside')}
              style={{...buttonStyle, backgroundColor: '#28a745', color: 'white', border: 'none', marginLeft: '0.5rem'}}
            >
              הגדר כ"בפנים"
            </button>
            <button 
              onClick={() => setInitialStatus('outside')}
              style={{...buttonStyle, backgroundColor: '#fd7e14', color: 'white', border: 'none'}}
            >
              הגדר כ"בחוץ"
            </button>
          </div>
        </div>
        
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem'}}>
          <div>
            <h4>סטטוס נוכחי</h4>
            <p><strong>מיקום דבורה:</strong> {lastBeeStatus || 'לא זוהתה'}</p>
            <p><strong>נקודות מעקב:</strong> {positionHistoryCount}</p>
            <p><strong>מצלמה חיצונית:</strong> {externalCameraActive ? 'פעילה' : 'כבויה'} ({externalCameraStatus})</p>
            <p><strong>אירוע פעיל:</strong> {eventActive ? 'כן' : 'לא'}</p>
            <p><strong>פעולת אירוע אחרונה:</strong> {eventAction || 'אין'}</p>
            <p><strong>זיהויים רצופים בפנים:</strong> {consecutiveDetections.inside}</p>
            <p><strong>זיהויים רצופים בחוץ:</strong> {consecutiveDetections.outside}</p>
            <p><strong>רצף סטטוסים:</strong> {statusSequence.join(' → ') || 'אין'}</p>
            <p><strong>WebSocket התראות:</strong> {notificationSocketRef.current?.readyState === 1 ? 'מחובר' : 'מנותק'}</p>
            <p><strong>מצלמה חיצונית נבחרת:</strong> {selectedExternalDeviceId ? 
              (videoDevices.find(d => d.deviceId === selectedExternalDeviceId)?.label || selectedExternalDeviceId.substr(0, 20) + '...') : 
              'לא נבחרה'}</p>
            <p><strong>מצלמות זמינות:</strong> {videoDevices.length} ({videoDevices.map(d => d.label || 'Unknown').join(', ') || 'אין'})</p>
            <p><strong>הרשאות מצלמה:</strong> {videoDevices.length > 0 ? 'ניתנו' : 'לא ניתנו/שגיאה'}</p>
            <p><strong>ניסיונות מצלמה חיצונית:</strong> {
              Array.from(cameraRetryAttemptsRef.current.entries()).length > 0 ? 
              Array.from(cameraRetryAttemptsRef.current.entries()).map(([id, count]) => 
                `${videoDevices.find(d => d.deviceId === id)?.label || 'Unknown'}: ${count}`
              ).join(', ') : 'אין'
            }</p>
            <p><strong>זמן איפוס אחרון:</strong> {lastRetryTimeRef.current ? new Date(lastRetryTimeRef.current).toLocaleTimeString() : 'אין'}</p>
          </div>
          
          <div>
            <h4>הגדרות מערכת</h4>
            {debugInfo && (
              <div>
                <p><strong>קו מרכזי X:</strong> {debugInfo.configuration.center_line_x || 'לא זמין'}</p>
                <p><strong>רזולוציית מסגרת:</strong> {debugInfo.configuration.frame_width}x{debugInfo.configuration.frame_height}</p>
                <p><strong>זיהויים רצופים נדרשים:</strong> {debugInfo.configuration.min_consecutive_detections}</p>
                <p><strong>מחפש מעבר:</strong> {debugInfo.debug_info?.looking_for_crossing || 'לא זמין'}</p>
              </div>
            )}
          </div>

          <div>
            <h4>מידע מודל</h4>
            {modelInfo && (
              <div>
                <p><strong>מודל סיווג:</strong> {modelInfo.classification_model.model_file}</p>
                <p><strong>מחלקות זמינות:</strong></p>
                <ul style={{fontSize: '0.9rem', marginTop: '0.5rem'}}>
                  {modelInfo.classification_model.available_classes.map((className, index) => (
                    <li key={index}>{className}</li>
                  ))}
                </ul>
                <p><strong>סף זיהוי:</strong> {modelInfo.detection_threshold}</p>
                <p><strong>קו מרכזי:</strong> {modelInfo.center_line_x || 'לא זמין'}</p>
                <p><strong>מימדי מסגרת:</strong> {modelInfo.frame_dimensions || 'לא זמין'}</p>
              </div>
            )}
          </div>
        </div>
        
        {debugInfo && debugInfo.position_history.length > 0 && (
          <div style={{marginTop: '1rem'}}>
            <h4>היסטוריית מיקומים אחרונה</h4>
            <div style={{maxHeight: '200px', overflowY: 'auto', backgroundColor: '#fff', padding: '0.5rem', borderRadius: '4px'}}>
              {debugInfo.position_history.map((pos, index) => (
                <div key={index} style={{fontSize: '0.9rem', marginBottom: '0.25rem'}}>
                  נקודה {index + 1}: ({pos[0]}, {pos[1]}) - {pos[3]} - {new Date(pos[2] * 1000).toLocaleTimeString()}
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{backgroundColor: '#d1ecf1', padding: '1rem', borderRadius: '6px', margin: '1rem 0', border: '1px solid #bee5eb'}}>
          <h4>🎯 הסבר על מערכת הקו המרכזי החדשה</h4>
          <div style={{fontSize: '0.9rem', color: '#0c5460'}}>
            <p><strong>ההגיון החדש:</strong></p>
            <ul>
              <li><strong>🟡 קו צהוב במרכז:</strong> מפריד בין צד ימין (תוך הכוורת) לצד שמאל (מחוץ לכוורת)</li>
              <li><strong>🚪 התחלת אירוע:</strong> דבורה עוברת מימין לשמאל (יוצאת מהכוורת)</li>
              <li><strong>🏠 סיום אירוע:</strong> דבורה עוברת משמאל לימין (חוזרת לכוורת)</li>
              <li><strong>📧 התראות:</strong> מייל נשלח בהתחלה ובסיום כל אירוע</li>
              <li><strong>🎥 הקלטה:</strong> שתי מצלמות מקליטות במהלך האירוע</li>
            </ul>
            <p><strong>מה השתנה:</strong></p>
            <ul>
              <li>פשטנו את הלוגיקה - רק מעבר אחד מפעיל/מסיים אירוע</li>
              <li>קו אנכי פשוט במקום תיבת ROI מורכבת</li>
              <li>זיהוי מיידי של כיוון החצייה</li>
              <li>הקלטת וידאו עם buffer של 5 שניות</li>
            </ul>
            <p><strong>צבעי הנתיב:</strong></p>
            <ul>
              <li><span style={{color: '#ff8c00'}}>🟠 כתום:</span> דבורה מחוץ לכוורת (צד שמאל)</li>
              <li><span style={{color: '#32cd32'}}>🟢 ירוק:</span> דבורה בתוך הכוורת (צד ימין)</li>
            </ul>
            <p><strong>כדי לבדוק:</strong></p>
            <ol>
              <li>לחץ על "הגדר כ'בפנים'" (דבורה מתחילה בצד ימין)</li>
              <li>צפה כשהדבורה חוצה את הקו הצהוב משמאל לימין</li>
              <li>המערכת אמורה להתחיל אירוע ולהציג "EVENT STARTED!"</li>
              <li>כשהדבורה חוזרת וחוצה מימין לשמאל - האירוע יסתיים</li>
            </ol>
            <p><strong>סטטוס נוכחי:</strong> אירוע פעיל = {eventActive ? 'כן' : 'לא'}, מיקום אחרון = {lastBeeStatus || 'לא זוהה'}</p>
          </div>
        </div>
        
        <div style={{backgroundColor: '#fff3cd', padding: '1rem', borderRadius: '6px', margin: '1rem 0', border: '1px solid #ffeaa7'}}>
          <h4>📹 הגנה מפני לולאות אינסופיות של מצלמה חיצונית</h4>
          <div style={{fontSize: '0.9rem', color: '#856404'}}>
            <p><strong>מה קורה כשמצלמות לא זמינות:</strong></p>
            <ul>
              <li><strong>🔄 ניסיונות מוגבלים:</strong> מקסימום 2 ניסיונות לכל מצלמה</li>
              <li><strong>⏱️ זמן המתנה:</strong> 5 שניות בין ניסיונות גדולים</li>
              <li><strong>🔄 איפוס אוטומטי:</strong> המערכת מתאפסת כל 30 שניות</li>
              <li><strong>🛑 הגנה מפני שכפול:</strong> מניעת ניסיונות מקבילים</li>
            </ul>
            <p><strong>אם יש בעיה:</strong> השתמש בכפתור "אפס מוני מצלמה" למחיקה ידנית של מוני הניסיונות.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
