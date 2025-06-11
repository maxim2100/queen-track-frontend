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
  const videoRef = useRef(null);
  const externalVideoRef = useRef(null);
  const socketRef = useRef(null);
  const statusCheckIntervalRef = useRef(null);
  const videoFileRef = useRef(null);

  // איסוף רשימת מצלמות
  useEffect(() => {
    // Check if mediaDevices is available (requires HTTPS or localhost)
    if (!navigator.mediaDevices) {
      console.error("mediaDevices not available. Camera access requires HTTPS or localhost.");
      // Set a default message or fallback behavior
      setVideoDevices([]);
      return;
    }

    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        const cameras = devices.filter((device) => device.kind === "videoinput");
        setVideoDevices(cameras);
        if (cameras.length > 0) {
          setSelectedInternalDeviceId(cameras[0].deviceId);
          // Set external camera to second camera if available, otherwise use first camera
          setSelectedExternalDeviceId(cameras.length > 1 ? cameras[1].deviceId : cameras[0].deviceId);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Error enumerating devices:", err);
        setVideoDevices([]);
      });
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
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
    
    return cleanup;
  }, [stream]);

  const handleChangeInternalDevice = (event) => {
    setSelectedInternalDeviceId(event.target.value);
  };

  const handleChangeExternalDevice = (event) => {
    setSelectedExternalDeviceId(event.target.value);
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
        console.log("Camera configuration saved successfully");
        // Update local config state to show both cameras are configured
        setCameraConfig({
          internalSelected: true,
          externalSelected: true
        });
      } else {
        // eslint-disable-next-line no-console
        console.error("Failed to save camera configuration");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error saving camera config:", error);
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
              console.error("Error playing external video:", err);
            });
          }
        }
      } else {
        setExternalCameraStatus("error");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error checking external camera status:", error);
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
      console.error("Error fetching debug info:", error);
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
      console.error("Error fetching model info:", error);
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
        console.log("Tracking state reset successfully");
        // Refresh debug info after reset
        setTimeout(fetchDebugInfo, 500);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error resetting tracking:", error);
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
        console.log(`Initial status set to: ${status}`);
        // Refresh debug info after setting status
        setTimeout(fetchDebugInfo, 500);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error setting initial status:", error);
    }
  };

  const startCamera = async () => {
    try {
      if (streamMode === "live") {
        // Original live camera functionality
        if (!selectedInternalDeviceId) return;
        
        // Check if mediaDevices is available
        if (!navigator.mediaDevices) {
          console.error("Camera access not available. Requires HTTPS or localhost.");
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
        
        const socket = new WebSocket(`${websocketUrl}/video/live-stream`);
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
        
        socket.onclose = () => {
          // eslint-disable-next-line no-console
          console.log("WebSocket disconnected");
          clearInterval(intervalId);
        };
    
        socket.onerror = (error) => {
          // eslint-disable-next-line no-console
          console.error("WebSocket error:", error);
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
            console.error("Error playing video file:", error);
            return;
          }
        }
        
        const socket = new WebSocket(`${websocketUrl}/video/live-stream`);
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
        
        socket.onclose = () => {
          // eslint-disable-next-line no-console
          console.log("WebSocket disconnected");
          clearInterval(intervalId);
        };
    
        socket.onerror = (error) => {
          // eslint-disable-next-line no-console
          console.error("WebSocket error:", error);
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
      console.error("Error starting camera/video:", error);
    }
  };

  const stopCamera = () => {
    // Stop live camera stream if active
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    
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

    // סגירת WebSocket
    if (socketRef.current) {
      socketRef.current.close();
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
            )}
          </div>
        </div>
        
        <button 
          onClick={saveCameraConfig} 
          style={{...buttonStyle, backgroundColor: '#4CAF50', color: 'white', border: 'none'}}
        >
          שמור הגדרות מצלמה
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
          <h3 style={{textAlign: 'center', margin: '0.5rem 0'}}>מצלמה חיצונית</h3>
          {externalCameraStatus === "active" ? (
            <div style={liveBadgeStyle}>
              RECORDING
            </div>
          ) : (
            <div style={{
              ...liveBadgeStyle, 
              backgroundColor: externalCameraStatus === "error" ? 'gray' : 'gray'
            }}>
              {externalCameraStatus === "error" ? "ERROR" : "STANDBY"}
            </div>
          )}
          
          {externalCameraStatus === "active" ? (
            <video
              ref={externalVideoRef}
              autoPlay
              playsInline
              style={videoStyle}
            />
          ) : (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '300px',
              backgroundColor: '#222',
              color: '#fff',
              fontSize: '1.2rem'
            }}>
              {externalCameraStatus === "error" ? 
                "שגיאה בהתחברות למצלמה חיצונית" : 
                "המצלמה החיצונית תופעל כאשר הדבורה תצא מהכוורת"}
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
            <p><strong>מצלמה חיצונית:</strong> {externalCameraStatus}</p>
            <p><strong>אירוע פעיל:</strong> {eventActive ? 'כן' : 'לא'}</p>
            <p><strong>פעולת אירוע אחרונה:</strong> {eventAction || 'אין'}</p>
            <p><strong>זיהויים רצופים בפנים:</strong> {consecutiveDetections.inside}</p>
            <p><strong>זיהויים רצופים בחוץ:</strong> {consecutiveDetections.outside}</p>
            <p><strong>רצף סטטוסים:</strong> {statusSequence.join(' → ') || 'אין'}</p>
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
