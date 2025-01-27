import React, { useEffect, useState, useRef } from 'react';

function HomePage() {
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);

  // איסוף רשימת מצלמות
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        const cameras = devices.filter((device) => device.kind === "videoinput");
        setVideoDevices(cameras);
        if (cameras.length > 0) {
          setSelectedDeviceId(cameras[0].deviceId);
        }
      })
      .catch((err) => {
        console.error("Error enumerating devices:", err);
      });
  }, []);

  const handleChangeDevice = (event) => {
    setSelectedDeviceId(event.target.value);
  };

  const startCamera = async () => {
    if (!selectedDeviceId) return;
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedDeviceId } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setStream(newStream);
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      setStream(null);
    }
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

  const videoStyle = {
    width: '100%',
    height: 'auto'
  };

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>ברוכים הבאים ל-Queen Track</h1>
      <p>בחר מצלמה מהרשימה כדי להציג תצוגה מקדימה ב"לייב" ולנהל צילום.</p>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ marginRight: '0.5rem' }}>בחר מצלמה:</label>
        <select value={selectedDeviceId} onChange={handleChangeDevice} style={selectStyle}>
          {videoDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId}`}
            </option>
          ))}
        </select>
      </div>

      <div style={buttonGroupStyle}>
        <button onClick={startCamera} style={buttonStyle}>התחל לצלם</button>
        <button onClick={stopCamera} style={buttonStyle}>כבה מצלמה</button>
      </div>

      {/* "מסגרת" הווידאו - 60% מרוחב העמוד, עם כיתוב LIVE */}
      <div style={videoWrapperStyle}>
        {/* badge אדום שכותרתו LIVE */}
        {stream && (
          <div style={liveBadgeStyle}>
            LIVE
          </div>
        )}
        {/* תצוגת הווידאו */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={videoStyle}
        />
      </div>
    </div>
  );
}

export default HomePage;
