import React, { useEffect, useState, useRef } from 'react';

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

  // Function to load camera configuration from backend
  const loadCameraConfig = async () => {
    try {
      const response = await fetch(`${backendUrl}/video/external-camera-status`);
      if (response.ok) {
        const data = await response.json();
        // eslint-disable-next-line no-console
        console.log("📥 [Camera Config] Loaded configuration:", data);
        
        if (data.internal_camera_id && videoDevices.some(d => d.deviceId === data.internal_camera_id)) {
          setSelectedInternalDeviceId(data.internal_camera_id);
        }
        
        if (data.external_camera_id && videoDevices.some(d => d.deviceId === data.external_camera_id)) {
          setSelectedExternalDeviceId(data.external_camera_id);
          // eslint-disable-next-line no-console
          console.log("✅ [Camera Config] External camera loaded:", data.external_camera_id);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("💥 [Camera Config] Error loading camera config:", error);
    }
  };

  // Function to enumerate camera devices with permission handling
  const enumerateCameraDevices = async (requestPermissions = false) => {
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
      
      setVideoDevices(cameras);
      
      if (cameras.length > 0) {
        // Only set default devices if they're not already set
        if (!selectedInternalDeviceId) {
          setSelectedInternalDeviceId(cameras[0].deviceId);
        }
        if (!selectedExternalDeviceId) {
          setSelectedExternalDeviceId(cameras.length > 1 ? cameras[1].deviceId : cameras[0].deviceId);
        }
        
        // Try to load saved configuration after devices are detected
        setTimeout(loadCameraConfig, 1000);
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
  };

  // איסוף רשימת מצלמות
  useEffect(() => {
    enumerateCameraDevices(false);
  }, []);

  // Clean up when component unmounts
  useEffect(() => {
    const cleanup = () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
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
  const handleExternalCameraActivation = async () => {
    try {
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera] Activation signal received");
      
      // Get fresh camera devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((device) => device.kind === "videoinput");
      
      // eslint-disable-next-line no-console
      console.log("📷 [External Camera] Fresh devices found:", cameras.length);
      
      if (cameras.length === 0) {
        // eslint-disable-next-line no-console
        console.log("🔄 [External Camera] No devices available, requesting permissions and re-enumerating...");
        const success = await enumerateCameraDevices(true);
        if (!success) {
          // eslint-disable-next-line no-console
          console.error("❌ [External Camera] Still no devices after re-enumeration");
          setExternalCameraStatus("error");
          return;
        }
        // Retry with fresh enumeration
        await new Promise(resolve => setTimeout(resolve, 1000));
        return handleExternalCameraActivation();
      }
      
      // Update state with fresh devices
      setVideoDevices(cameras);
      
      // Load camera configuration from backend
      try {
        const response = await fetch(`${backendUrl}/video/external-camera-status`);
        if (response.ok) {
          const data = await response.json();
          // eslint-disable-next-line no-console
          console.log("📥 [External Camera] Loaded configuration:", data);
          
          let externalDeviceId = data.external_camera_id;
          
          // Validate that the device exists
          if (externalDeviceId && cameras.some(d => d.deviceId === externalDeviceId)) {
            setSelectedExternalDeviceId(externalDeviceId);
            // eslint-disable-next-line no-console
            console.log("✅ [External Camera] Using configured camera:", externalDeviceId);
          } else {
            // Fall back to auto-selection
            externalDeviceId = cameras.length > 1 ? cameras[1].deviceId : cameras[0].deviceId;
            setSelectedExternalDeviceId(externalDeviceId);
            // eslint-disable-next-line no-console
            console.log("🔄 [External Camera] Auto-selected camera:", externalDeviceId);
          }
          
          // Start external camera with the selected device
          await startExternalCameraWithDevice(externalDeviceId, cameras);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("💥 [External Camera] Error loading camera config:", error);
        // Fall back to auto-selection
        const fallbackDeviceId = cameras.length > 1 ? cameras[1].deviceId : cameras[0].deviceId;
        await startExternalCameraWithDevice(fallbackDeviceId, cameras);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("💥 [External Camera] Activation error:", error);
      setExternalCameraStatus("error");
    }
  };

  // Initialize notification WebSocket connection
  useEffect(() => {
    const connectNotificationWebSocket = () => {
      const fullNotificationUrl = `${websocketUrl}/video/notifications`;
      // eslint-disable-next-line no-console
      console.log("🔔 [Notification WebSocket] Connecting to:", fullNotificationUrl);
      
      const notificationSocket = new WebSocket(fullNotificationUrl);
      notificationSocketRef.current = notificationSocket;
      
      notificationSocket.onopen = () => {
        // eslint-disable-next-line no-console
        console.log("✅ [Notification WebSocket] Connected successfully");
      };
      
      notificationSocket.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          // eslint-disable-next-line no-console
          console.log("📢 [Notification WebSocket] Received:", data);
          
          if (data.type === "external_camera_control") {
            if (data.action === "activate") {
              handleExternalCameraActivation();
            } else if (data.action === "deactivate") {
              // eslint-disable-next-line no-console
              console.log("🛑 [External Camera] Deactivation signal received");
              stopExternalCamera();
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.log("📢 [Notification WebSocket] Non-JSON message:", event.data);
        }
      };
      
      notificationSocket.onclose = () => {
        // eslint-disable-next-line no-console
        console.log("❌ [Notification WebSocket] Connection closed");
        // Attempt to reconnect after 5 seconds
        setTimeout(connectNotificationWebSocket, 5000);
      };
      
      notificationSocket.onerror = (error) => {
        // eslint-disable-next-line no-console
        console.error("💥 [Notification WebSocket] Error:", error);
      };
    };
    
    connectNotificationWebSocket();
    
    return () => {
      if (notificationSocketRef.current) {
        notificationSocketRef.current.close();
      }
    };
  }, []);

  const handleChangeInternalDevice = (event) => {
    setSelectedInternalDeviceId(event.target.value);
    // Auto-save configuration when device changes
    setTimeout(saveCameraConfig, 500);
  };

  const handleChangeExternalDevice = (event) => {
    setSelectedExternalDeviceId(event.target.value);
    // eslint-disable-next-line no-console
    console.log("🎥 [Camera Config] External device changed to:", event.target.value);
    // Auto-save configuration when device changes
    setTimeout(saveCameraConfig, 500);
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

  const startExternalCameraWithDevice = async (deviceId, availableCameras) => {
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
      
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera] Starting external camera stream with device:", deviceId);
      
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
      setExternalCameraStatus("error");
    }
  };

  const startExternalCamera = async () => {
    try {
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera DEBUG] Starting external camera...");
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera DEBUG] selectedExternalDeviceId:", selectedExternalDeviceId);
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera DEBUG] videoDevices:", videoDevices);
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera DEBUG] externalCameraActive:", externalCameraActive);
      
      if (externalCameraActive) {
        // eslint-disable-next-line no-console
        console.log("🎥 [External Camera] Already active");
        return;
      }
      
      // If no devices available, try to enumerate again with permissions
      if (videoDevices.length === 0) {
        // eslint-disable-next-line no-console
        console.log("🔄 [External Camera] No devices available, requesting permissions and re-enumerating...");
        const success = await enumerateCameraDevices(true);
        if (!success) {
          // eslint-disable-next-line no-console
          console.error("❌ [External Camera] Still no devices after re-enumeration");
          setExternalCameraStatus("error");
          return;
        }
        // Wait for state to update
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Try to get external device ID if not set
      let externalDeviceId = selectedExternalDeviceId;
      if (!externalDeviceId && videoDevices.length > 0) {
        // Fall back to second camera if available, otherwise use first camera
        externalDeviceId = videoDevices.length > 1 ? videoDevices[1].deviceId : videoDevices[0].deviceId;
        setSelectedExternalDeviceId(externalDeviceId);
        // eslint-disable-next-line no-console
        console.log("🎥 [External Camera DEBUG] Auto-selected external device:", externalDeviceId);
      }
      
      if (!externalDeviceId) {
        // eslint-disable-next-line no-console
        console.error("🎥 [External Camera] No external device selected");
        // eslint-disable-next-line no-console
        console.error("🎥 [External Camera] Available devices:", videoDevices);
        // eslint-disable-next-line no-console
        console.error("🎥 [External Camera] Devices length:", videoDevices.length);
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
      
      // eslint-disable-next-line no-console
      console.log("🎥 [External Camera] Starting external camera stream with device:", externalDeviceId);
      
      const newExternalStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: externalDeviceId } }
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
      setExternalCameraStatus("error");
    }
  };

  const stopExternalCamera = () => {
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
      
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("🛑 [External Camera] Error stopping external camera:", error);
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
            const success = await enumerateCameraDevices(true);
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
                  <div style={{fontSize: '0.9rem', color: '#ccc'}}>
                    בדוק את החיבור והגדרות המצלמה
                  </div>
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
      </div>
    </div>
  );
}

export default HomePage;
