/* eslint-disable no-console */
import React, { useRef, useEffect, useState } from 'react';
import { CameraService, NotificationService } from '../../services';
import { CAMERA_STATUS } from '../../constants';

const ExternalCameraComponent = ({ selectedDeviceId, onStatusChange }) => {
  const videoRef = useRef(null);
  const [cameraStatus, setCameraStatus] = useState(CAMERA_STATUS.INACTIVE);
  const [isActive, setIsActive] = useState(false);
  const [stream, setStream] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [lastRetryTime, setLastRetryTime] = useState(0);
  const [activationHistory, setActivationHistory] = useState([]);
  const [showTransition, setShowTransition] = useState(false);
  const [isStreamShared, setIsStreamShared] = useState(false);

  useEffect(() => {
    // Listen for camera service events
    const handleExternalCameraStarted = ({ stream: cameraStream }) => {
      setStream(cameraStream);
      setIsActive(true);
      setCameraStatus(CAMERA_STATUS.ACTIVE);
      setErrorInfo(null);
      
      if (videoRef.current) {
        videoRef.current.srcObject = cameraStream;
      }
      
      if (onStatusChange) {
        onStatusChange({ status: CAMERA_STATUS.ACTIVE, isActive: true });
      }
    };

    const handleExternalCameraStopped = () => {
      setStream(null);
      setIsActive(false);
      setCameraStatus(CAMERA_STATUS.INACTIVE);
      setErrorInfo(null);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      if (onStatusChange) {
        onStatusChange({ status: CAMERA_STATUS.INACTIVE, isActive: false });
      }
    };

    const handleExternalCameraError = (error) => {
      setStream(null);
      setIsActive(false);
      setCameraStatus(CAMERA_STATUS.ERROR);
      setErrorInfo(error);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      if (onStatusChange) {
        onStatusChange({ status: CAMERA_STATUS.ERROR, isActive: false, error });
      }
    };

    // Listen for notification service events (external camera activation)
    const handleExternalCameraActivate = async () => {
      console.log('🎥 [External Camera] Activation signal received');
      
      // Add to activation history
      const activationEvent = {
        timestamp: new Date(),
        type: 'activation_signal',
        success: false
      };
      
      setActivationHistory(prev => [activationEvent, ...prev.slice(0, 4)]);
      
      // Show transition animation
      setShowTransition(true);
      setTimeout(() => setShowTransition(false), 3000);
      
      try {
        setCameraStatus(CAMERA_STATUS.STARTING);
        if (onStatusChange) {
          onStatusChange({ status: CAMERA_STATUS.STARTING, isActive: false });
        }
        
        await CameraService.startExternalCamera(selectedDeviceId);
        
        // Update activation history with success
        setActivationHistory(prev => {
          const updated = [...prev];
          if (updated[0] && updated[0].type === 'activation_signal') {
            updated[0].success = true;
          }
          return updated;
        });
      } catch (error) {
        console.error('🎥 [External Camera] Activation failed:', error);
        
        // Update activation history with failure
        setActivationHistory(prev => {
          const updated = [...prev];
          if (updated[0] && updated[0].type === 'activation_signal') {
            updated[0].error = error.message;
          }
          return updated;
        });
      }
    };

    const handleExternalCameraDeactivate = () => {
      console.log('🛑 [External Camera] Deactivation signal received');
      CameraService.stopExternalCamera();
    };

    const handleStreamShared = ({ sharedStream }) => {
      console.log('🔄 [External Camera] Stream sharing detected');
      setIsStreamShared(sharedStream);
    };

    // Add event listeners
    CameraService.addEventListener('externalCameraStarted', handleExternalCameraStarted);
    CameraService.addEventListener('externalCameraStopped', handleExternalCameraStopped);
    CameraService.addEventListener('externalCameraError', handleExternalCameraError);
    CameraService.addEventListener('streamShared', handleStreamShared);
    
    NotificationService.addEventListener('externalCameraActivate', handleExternalCameraActivate);
    NotificationService.addEventListener('externalCameraDeactivate', handleExternalCameraDeactivate);

    // Get initial camera state
    const cameraState = CameraService.getCameraState();
    setIsActive(cameraState.externalCameraActive);
    setCameraStatus(cameraState.externalCameraStatus);
    setLastRetryTime(cameraState.lastRetryTime);

    // Cleanup
    return () => {
      CameraService.removeEventListener('externalCameraStarted', handleExternalCameraStarted);
      CameraService.removeEventListener('externalCameraStopped', handleExternalCameraStopped);
      CameraService.removeEventListener('externalCameraError', handleExternalCameraError);
      CameraService.removeEventListener('streamShared', handleStreamShared);
      
      NotificationService.removeEventListener('externalCameraActivate', handleExternalCameraActivate);
      NotificationService.removeEventListener('externalCameraDeactivate', handleExternalCameraDeactivate);
    };
  }, [selectedDeviceId, onStatusChange]);

  const handleManualTest = async () => {
    console.log('🧪 [Manual Test] Testing external camera activation');
    try {
      setCameraStatus(CAMERA_STATUS.STARTING);
      await CameraService.startExternalCamera(selectedDeviceId);
    } catch (error) {
      console.error('🧪 [Manual Test] Failed:', error);
    }
  };

  const handleManualStop = () => {
    console.log('🛑 [Manual Stop] Stopping external camera');
    CameraService.stopExternalCamera();
  };

  const handleManualReset = () => {
    console.log('🔄 [Manual Reset] Resetting camera retry counters');
    // This would need to be implemented in CameraService
    setLastRetryTime(0);
    setCameraStatus(CAMERA_STATUS.INACTIVE);
    setErrorInfo(null);
  };

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

  const statusBadgeStyle = {
    position: 'absolute',
    top: '10px',
    left: '10px',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    zIndex: 2,
    backgroundColor: 
      cameraStatus === CAMERA_STATUS.ACTIVE ? 'green' :
      cameraStatus === CAMERA_STATUS.STARTING ? 'orange' :
      cameraStatus === CAMERA_STATUS.ERROR ? 'red' : 'gray'
  };

  const transitionIndicatorStyle = {
    position: 'absolute',
    top: '10px',
    right: '10px',
    backgroundColor: 'red',
    color: 'white',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '0.8rem',
    zIndex: 3,
    animation: 'pulse 1s infinite'
  };

  const activationHistoryStyle = {
    position: 'absolute',
    bottom: '10px',
    left: '10px',
    right: '10px',
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: 'white',
    padding: '8px',
    borderRadius: '4px',
    fontSize: '0.7rem',
    zIndex: 2,
    maxHeight: '80px',
    overflowY: 'auto'
  };

  const placeholderStyle = {
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
  };

  const buttonStyle = {
    marginTop: '10px',
    padding: '8px 16px',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem'
  };

  const getStatusText = () => {
    switch (cameraStatus) {
      case CAMERA_STATUS.ACTIVE:
        return isStreamShared ? "SHARED STREAM" : "TRACKING ACTIVE";
      case CAMERA_STATUS.STARTING:
        return "STARTING...";
      case CAMERA_STATUS.ERROR:
        return "ERROR";
      default:
        return "WAITING";
    }
  };

  const renderPlaceholderContent = () => {
    if (cameraStatus === CAMERA_STATUS.ERROR && errorInfo) {
      return (
        <>
          <div style={{fontSize: '1.2rem', color: '#ff6b6b', marginBottom: '10px'}}>
            ⚠️ שגיאה במצלמה חיצונית
          </div>
          <div style={{fontSize: '0.9rem', color: '#ccc', marginBottom: '10px'}}>
            {errorInfo.errorMessage || 'המצלמה לא זמינה או בשימוש'}
          </div>
          <div style={{fontSize: '0.8rem', color: '#999', textAlign: 'right', lineHeight: '1.4'}}>
            <div><strong>פתרונות אפשריים:</strong></div>
            {errorInfo.possibleSolutions && errorInfo.possibleSolutions.map((solution, index) => (
              <div key={index}>• {solution}</div>
            ))}
          </div>
          <div style={{fontSize: '0.7rem', color: '#666', marginTop: '10px', textAlign: 'center'}}>
            <div><strong>סטטוס מערכת:</strong></div>
            <div>ניסיונות: {errorInfo.retryAttempts || 0}</div>
            <div>זמן איפוס אחרון: {lastRetryTime ? new Date(lastRetryTime).toLocaleTimeString() : 'אין'}</div>
          </div>
          <button onClick={handleManualReset} style={buttonStyle}>
            🔄 נסה שוב (איפוס מלא)
          </button>
        </>
      );
    }

    if (cameraStatus === CAMERA_STATUS.STARTING) {
      return (
        <>
          <div style={{fontSize: '1.2rem', color: '#ffa500', marginBottom: '10px'}}>
            🔄 מתחיל מעקב חיצוני...
          </div>
          <div style={{fontSize: '0.9rem', color: '#ccc'}}>
            המצלמה החיצונית מופעלת אוטומטית
          </div>
        </>
      );
    }

    return (
      <>
        <div style={{fontSize: '1.2rem', color: '#888', marginBottom: '10px'}}>
          📱 ממתין לאירוע יציאה
        </div>
        <div style={{fontSize: '0.9rem', color: '#ccc'}}>
          המצלמה תופעל אוטומטית כאשר<br/>
          הדבורה המסומנת תצא מהכוורת
        </div>
        <div style={{fontSize: '0.8rem', color: '#666', marginTop: '10px'}}>
          🎯 מצלמה נבחרת: {selectedDeviceId ? 'מוגדרת' : 'לא נבחרה'}
        </div>
        {isStreamShared && (
          <div style={{fontSize: '0.8rem', color: '#17a2b8', marginTop: '5px', padding: '5px', backgroundColor: 'rgba(23, 162, 184, 0.1)', borderRadius: '4px'}}>
            🔄 משתף זרם עם מצלמה פנימית
          </div>
        )}
        <button onClick={handleManualTest} style={buttonStyle}>
          🧪 בדוק מצלמה חיצונית ידנית
        </button>
        {isActive && (
          <button onClick={handleManualStop} style={{...buttonStyle, backgroundColor: '#dc3545', marginLeft: '10px'}}>
            🛑 עצור מצלמה
          </button>
        )}
      </>
    );
  };

  return (
    <div style={videoWrapperStyle}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); }
          }
        `}
      </style>
      
      <div style={statusBadgeStyle}>
        {getStatusText()}
      </div>
      
      {/* Transition indicator for activation signals */}
      {showTransition && (
        <div style={transitionIndicatorStyle}>
          🚨 ACTIVATION SIGNAL
        </div>
      )}
      
      {isActive && stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={videoStyle}
          />
          
          {/* Show activation history when camera is active */}
          {activationHistory.length > 0 && (
            <div style={activationHistoryStyle}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                📊 היסטוריית הפעלות:
              </div>
              {activationHistory.slice(0, 3).map((event, index) => (
                <div key={index} style={{ marginBottom: '2px' }}>
                  {event.timestamp.toLocaleTimeString()} - 
                  {event.success ? ' ✅ הופעל' : event.error ? ` ❌ ${event.error}` : ' ⏳ בתהליך'}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={placeholderStyle}>
            {renderPlaceholderContent()}
          </div>
          
          {/* Show activation history in placeholder */}
          {activationHistory.length > 0 && (
            <div style={activationHistoryStyle}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                📊 ניסיונות הפעלה אחרונים:
              </div>
              {activationHistory.slice(0, 3).map((event, index) => (
                <div key={index} style={{ marginBottom: '2px' }}>
                  {event.timestamp.toLocaleTimeString()} - 
                  {event.success ? ' ✅ הופעל' : event.error ? ` ❌ ${event.error}` : ' ⏳ בתהליך'}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ExternalCameraComponent;