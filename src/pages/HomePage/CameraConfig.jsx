import React, { useState, useEffect } from 'react';
import { CameraService } from '../../services';

const CameraConfig = ({ streamMode, onDeviceChange }) => {
  const [cameraState, setCameraState] = useState({
    devices: [],
    selectedInternalDeviceId: '',
    selectedExternalDeviceId: '',
    retryAttempts: new Map(),
    lastRetryTime: 0
  });
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // Helper function to get display name for camera
  const getCameraDisplayName = (device, index) => {
    if (device.label && device.label.trim() !== '') {
      return device.label;
    }
    
    // Create a more informative fallback name
    const shortId = device.deviceId.slice(0, 8);
    const deviceNumber = index + 1;
    
    // Try to identify camera type from device ID patterns
    if (device.deviceId.includes('045e')) {
      return `Microsoft Camera ${deviceNumber} (${shortId}...)`;
    } else if (device.deviceId.includes('obs')) {
      return `OBS Virtual Camera ${deviceNumber}`;
    } else {
      return `מצלמה ${deviceNumber} (${shortId}...)`;
    }
  };

  useEffect(() => {
    // Listen for camera service events
    const handleDevicesUpdated = (devices) => {
      setCameraState(prev => ({
        ...prev,
        devices
      }));
      setPermissionsGranted(devices.length > 0);
    };

    const handleInternalDeviceChanged = (deviceId) => {
      setCameraState(prev => ({
        ...prev,
        selectedInternalDeviceId: deviceId
      }));
      if (onDeviceChange) {
        onDeviceChange({ type: 'internal', deviceId });
      }
    };

    const handleExternalDeviceChanged = (deviceId) => {
      setCameraState(prev => ({
        ...prev,
        selectedExternalDeviceId: deviceId
      }));
      if (onDeviceChange) {
        onDeviceChange({ type: 'external', deviceId });
      }
    };

    const handleConfigLoaded = (config) => {
      setCameraState(prev => ({
        ...prev,
        selectedInternalDeviceId: config.internal || prev.selectedInternalDeviceId,
        selectedExternalDeviceId: config.external || prev.selectedExternalDeviceId
      }));
    };

    // Add event listeners
    CameraService.addEventListener('devicesUpdated', handleDevicesUpdated);
    CameraService.addEventListener('internalDeviceChanged', handleInternalDeviceChanged);
    CameraService.addEventListener('externalDeviceChanged', handleExternalDeviceChanged);
    CameraService.addEventListener('configLoaded', handleConfigLoaded);

    // Get initial state
    const initialState = CameraService.getCameraState();
    setCameraState(initialState);
    setPermissionsGranted(initialState.devices.length > 0);
    
    // If no devices are enumerated yet, try to enumerate with automatic permission request
    if (initialState.devices.length === 0) {
      CameraService.enumerateDevices(true, true).catch(error => {
        // eslint-disable-next-line no-console
        console.warn('Initial device enumeration with permissions failed, trying without permissions:', error);
        // Fallback to enumeration without permissions
        CameraService.enumerateDevices(false, true).catch(fallbackError => {
          // eslint-disable-next-line no-console
          console.warn('Fallback device enumeration also failed:', fallbackError);
        });
      });
    }

    // Cleanup
    return () => {
      CameraService.removeEventListener('devicesUpdated', handleDevicesUpdated);
      CameraService.removeEventListener('internalDeviceChanged', handleInternalDeviceChanged);
      CameraService.removeEventListener('externalDeviceChanged', handleExternalDeviceChanged);
      CameraService.removeEventListener('configLoaded', handleConfigLoaded);
    };
  }, [onDeviceChange]);

  const handleInternalCameraChange = (event) => {
    CameraService.setInternalCameraDevice(event.target.value);
  };

  const handleExternalCameraChange = (event) => {
    CameraService.setExternalCameraDevice(event.target.value);
  };

  const handleRequestPermissions = async () => {
    await CameraService.enumerateDevices(true, true);
  };

  const handleSaveConfig = () => {
    CameraService.saveCameraConfig();
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

  const selectStyle = {
    padding: '0.5rem',
    fontSize: '1rem',
    marginRight: '0.5rem'
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

  return (
    <div style={configurationBoxStyle}>
      <h2>הגדרת מצלמות</h2>
      
      {/* Camera Permission Status */}
      <div style={{
        marginBottom: '1.5rem',
        padding: '1rem',
        backgroundColor: permissionsGranted ? '#d4edda' : '#f8d7da',
        border: `1px solid ${permissionsGranted ? '#c3e6cb' : '#f5c6cb'}`,
        borderRadius: '6px',
        color: permissionsGranted ? '#155724' : '#721c24'
      }}>
        <h4 style={{margin: '0 0 0.5rem 0'}}>
          {permissionsGranted ? '✅ סטטוס מצלמות: פעילות' : '⚠️ סטטוס מצלמות: לא זמינות'}
        </h4>
        <div style={{fontSize: '0.9rem'}}>
          {permissionsGranted ? (
            <>
              <div><strong>מצלמות זמינות:</strong> {cameraState.devices.length}</div>
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
                value={cameraState.selectedInternalDeviceId} 
                onChange={handleInternalCameraChange} 
                style={selectStyle}
              >
                {cameraState.devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {getCameraDisplayName(device, index)}
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
                value={cameraState.selectedExternalDeviceId} 
                onChange={handleExternalCameraChange} 
                style={selectStyle}
              >
                {cameraState.devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {getCameraDisplayName(device, index)}
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
                <div><strong>🎯 מצלמה נבחרת:</strong> {cameraState.selectedExternalDeviceId ? 
                  (() => {
                    const selectedDevice = cameraState.devices.find(d => d.deviceId === cameraState.selectedExternalDeviceId);
                    const deviceIndex = cameraState.devices.findIndex(d => d.deviceId === cameraState.selectedExternalDeviceId);
                    return selectedDevice ? getCameraDisplayName(selectedDevice, deviceIndex) : 'לא ידוע';
                  })() : 
                  'לא נבחרה'}</div>
                <div><strong>🆔 Device ID:</strong> {cameraState.selectedExternalDeviceId || 'N/A'}</div>
                <div><strong>📋 זמינות:</strong> {cameraState.devices.length} מצלמות זמינות</div>
                {cameraState.selectedExternalDeviceId === cameraState.selectedInternalDeviceId && (
                  <div style={{color: '#dc3545', fontWeight: 'bold', marginTop: '5px'}}>
                    ⚠️ אזהרה: מצלמה זהה למצלמה הפנימית!
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      <button 
        onClick={handleSaveConfig} 
        style={{...buttonStyle, backgroundColor: '#4CAF50', color: 'white', border: 'none'}}
      >
        שמור הגדרות מצלמה
      </button>
      
      {/* Camera Permission Request Button */}
      <button 
        onClick={handleRequestPermissions}
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
  );
};

export default CameraConfig;