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
  const [cameraConfig, setCameraConfig] = useState({
    internalSelected: true,
    externalSelected: false
  });
  const videoRef = useRef(null);
  const externalVideoRef = useRef(null);
  const socketRef = useRef(null);
  const statusCheckIntervalRef = useRef(null);

  // איסוף רשימת מצלמות
  useEffect(() => {
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
        console.error("Error enumerating devices:", err);
      });
  }, []);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
      stopCamera();
    };
  }, []);

  const handleChangeInternalDevice = (event) => {
    setSelectedInternalDeviceId(event.target.value);
  };

  const handleChangeExternalDevice = (event) => {
    setSelectedExternalDeviceId(event.target.value);
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
        console.log("Camera configuration saved successfully");
        // Update local config state to show both cameras are configured
        setCameraConfig({
          internalSelected: true,
          externalSelected: true
        });
      } else {
        console.error("Failed to save camera configuration");
      }
    } catch (error) {
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
              console.error("Error playing external video:", err);
            });
          }
        }
      } else {
        setExternalCameraStatus("error");
      }
    } catch (error) {
      console.error("Error checking external camera status:", error);
      setExternalCameraStatus("error");
    }
  };

  const startCamera = async () => {
    if (!selectedInternalDeviceId) return;
    try {
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
          if (data.external_camera_status) {
            setExternalCameraStatus(data.external_camera_status ? "active" : "inactive");
          }
        } catch (error) {
          // Not a JSON message, ignore
        }
      };
      
      socket.onclose = () => {
        console.log("WebSocket disconnected");
        clearInterval(intervalId);
      };
  
      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        clearInterval(intervalId);
      };
  
      // Start polling for external camera status
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
      }
      statusCheckIntervalRef.current = setInterval(checkExternalCameraStatus, 5000); // Check every 5 seconds
      
      // Check status immediately
      checkExternalCameraStatus();
  
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
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

  const videoStyle = {
    width: '100%',
    height: 'auto'
  };

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>ברוכים הבאים ל-Queen Track</h1>
      <p>בחר את המצלמות שלך והתחל לנטר את פעילות הדבורים</p>

      <div style={configurationBoxStyle}>
        <h2>הגדרת מצלמות</h2>
        
        <div style={cameraSelectorStyle}>
          {/* Internal Camera Selection */}
          <div style={cameraSelectionContainerStyle}>
            <h3>מצלמת כניסה לכוורת</h3>
            <p>מצלמה זו תפקח על פתח הכוורת ותזהה כניסות ויציאות של הדבורה המסומנת</p>
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
          </div>
          
          {/* External Camera Selection */}
          <div style={cameraSelectionContainerStyle}>
            <h3>מצלמה חיצונית</h3>
            <p>מצלמה זו תופעל אוטומטית כאשר הדבורה המסומנת יוצאת מהכוורת</p>
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
        <button onClick={startCamera} style={buttonStyle}>התחל לצלם</button>
        <button onClick={stopCamera} style={buttonStyle}>כבה מצלמה</button>
      </div>

      <div style={videosContainerStyle}>
        {/* Main Camera (at the hive entrance) */}
        <div style={{...videoWrapperStyle, marginRight: '10px', flex: 1}}>
          <h3 style={{textAlign: 'center', margin: '0.5rem 0'}}>מצלמת כניסה לכוורת</h3>
          {stream && (
            <div style={liveBadgeStyle}>
              LIVE
            </div>
          )}
          {lastBeeStatus && (
            <div style={statusBadgeStyle}>
              דבורה {lastBeeStatus === "inside" ? "בפנים" : "בחוץ"}
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
    </div>
  );
}

export default HomePage;
