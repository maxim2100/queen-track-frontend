/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import { StreamService, CameraService, NotificationService, ServiceManager } from '../../services';

const DebugPanel = () => {
  const [debugInfo, setDebugInfo] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [streamingState, setStreamingState] = useState({});
  const [cameraState, setCameraState] = useState({});
  const [serviceHealth, setServiceHealth] = useState({});

  useEffect(() => {
    // Listen for stream service events
    const handleStateUpdated = (state) => {
      setStreamingState(state);
    };

    const handleNotificationsUpdated = () => {
      // Notification updates are handled but not currently used in UI
    };

    // Add event listeners
    StreamService.addEventListener('stateUpdated', handleStateUpdated);
    NotificationService.addEventListener('notificationsUpdated', handleNotificationsUpdated);

    // Get initial states
    setStreamingState(StreamService.getStreamingState());
    setCameraState(CameraService.getCameraState());
    // NotificationService.getNotifications(); // Available but not currently used
    setServiceHealth(ServiceManager.getHealthStatus());

    // Update states periodically
    const interval = setInterval(() => {
      setCameraState(CameraService.getCameraState());
      setServiceHealth(ServiceManager.getHealthStatus());
    }, 2000);

    // Cleanup
    return () => {
      StreamService.removeEventListener('stateUpdated', handleStateUpdated);
      NotificationService.removeEventListener('notificationsUpdated', handleNotificationsUpdated);
      clearInterval(interval);
    };
  }, []);

  const fetchDebugInfo = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/video/debug/bee-tracking-status`);
      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data);
      }
    } catch (error) {
      console.error('Error fetching debug info:', error);
    }
  };

  const fetchModelInfo = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/video/debug/model-info`);
      if (response.ok) {
        const data = await response.json();
        setModelInfo(data);
      }
    } catch (error) {
      console.error('Error fetching model info:', error);
    }
  };

  const resetTracking = async () => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/video/debug/reset-tracking`, {
        method: 'POST'
      });
      if (response.ok) {
        setTimeout(fetchDebugInfo, 500);
      }
    } catch (error) {
      console.error('Error resetting tracking:', error);
    }
  };

  const setInitialStatus = async (status) => {
    try {
      const backendUrl = process.env.REACT_APP_BACKEND_URL;
      const response = await fetch(`${backendUrl}/video/debug/set-initial-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: status })
      });
      if (response.ok) {
        setTimeout(fetchDebugInfo, 500);
      }
    } catch (error) {
      console.error('Error setting initial status:', error);
    }
  };

  const resetCameraRetries = () => {
    // This would need to be implemented in CameraService
    console.log('🔄 [Manual Reset] Camera retry counters reset');
    alert('מוני הניסיונות נמחקו! כעת ניתן לנסות שוב עם המצלמה החיצונית.');
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

  const buttonStyle = {
    padding: '0.6rem 1rem',
    fontSize: '1rem',
    marginRight: '1rem',
    cursor: 'pointer',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#fff'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '1rem'
  };

  const infoBoxStyle = {
    backgroundColor: '#fff3cd',
    padding: '1rem',
    borderRadius: '6px',
    margin: '1rem 0',
    border: '1px solid #ffeaa7'
  };

  const explanationBoxStyle = {
    backgroundColor: '#d1ecf1',
    padding: '1rem',
    borderRadius: '6px',
    margin: '1rem 0',
    border: '1px solid #bee5eb'
  };

  const warningBoxStyle = {
    backgroundColor: '#fff3cd',
    padding: '1rem',
    borderRadius: '6px',
    margin: '1rem 0',
    border: '1px solid #ffeaa7'
  };

  return (
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
            onClick={resetCameraRetries}
            style={{...buttonStyle, backgroundColor: '#28a745', color: 'white', border: 'none', marginLeft: '0.5rem'}}
          >
            אפס מוני מצלמה
          </button>
        </div>
      </div>
      
      {/* Initial Status Setting */}
      <div style={infoBoxStyle}>
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
      
      <div style={gridStyle}>
        <div>
          <h4>סטטוס נוכחי</h4>
          <p><strong>מיקום דבורה:</strong> {streamingState.lastBeeStatus || 'לא זוהתה'}</p>
          <p><strong>נקודות מעקב:</strong> {streamingState.positionHistoryCount || 0}</p>
          <p><strong>מצלמה חיצונית:</strong> {cameraState.externalCameraActive ? 'פעילה' : 'כבויה'} ({cameraState.externalCameraStatus})</p>
          <p><strong>אירוע פעיל:</strong> {streamingState.eventActive ? 'כן' : 'לא'}</p>
          <p><strong>פעולת אירוע אחרונה:</strong> {streamingState.eventAction || 'אין'}</p>
          <p><strong>זיהויים רצופים בפנים:</strong> {streamingState.consecutiveDetections?.inside || 0}</p>
          <p><strong>זיהויים רצופים בחוץ:</strong> {streamingState.consecutiveDetections?.outside || 0}</p>
          <p><strong>רצף סטטוסים:</strong> {streamingState.statusSequence?.join(' → ') || 'אין'}</p>
          <p><strong>WebSocket התראות:</strong> {NotificationService.getConnectionStatus() === 'OPEN' ? 'מחובר' : 'מנותק'}</p>
          <p><strong>מצלמה חיצונית נבחרת:</strong> {cameraState.selectedExternalDeviceId ? 
            (cameraState.devices.find(d => d.deviceId === cameraState.selectedExternalDeviceId)?.label || cameraState.selectedExternalDeviceId.substr(0, 20) + '...') : 
            'לא נבחרה'}</p>
          <p><strong>מצלמות זמינות:</strong> {cameraState.devices?.length || 0} ({cameraState.devices?.map(d => d.label || 'Unknown').join(', ') || 'אין'})</p>
          <p><strong>הרשאות מצלמה:</strong> {cameraState.devices?.length > 0 ? 'ניתנו' : 'לא ניתנו/שגיאה'}</p>
        </div>
        
        <div>
          <h4>סטטוס שירותים</h4>
          <p><strong>ServiceManager:</strong> {serviceHealth.overall || 'unknown'}</p>
          {serviceHealth.services && Object.entries(serviceHealth.services).map(([serviceName, status]) => (
            <div key={serviceName} style={{marginBottom: '0.5rem'}}>
              <strong>{serviceName}:</strong>
              <div style={{fontSize: '0.9rem', marginLeft: '1rem'}}>
                {typeof status === 'object' ? (
                  Object.entries(status).map(([key, value]) => (
                    <div key={key}>{key}: {JSON.stringify(value)}</div>
                  ))
                ) : (
                  <div>{JSON.stringify(status)}</div>
                )}
              </div>
            </div>
          ))}
          
          {debugInfo && (
            <div>
              <p><strong>קו מרכזי X:</strong> {debugInfo.configuration?.center_line_x || 'לא זמין'}</p>
              <p><strong>רזולוציית מסגרת:</strong> {debugInfo.configuration?.frame_width}x{debugInfo.configuration?.frame_height}</p>
              <p><strong>זיהויים רצופים נדרשים:</strong> {debugInfo.configuration?.min_consecutive_detections}</p>
              <p><strong>מחפש מעבר:</strong> {debugInfo.debug_info?.looking_for_crossing || 'לא זמין'}</p>
            </div>
          )}
        </div>

        <div>
          <h4>מידע מודל</h4>
          {modelInfo && (
            <div>
              <p><strong>מודל סיווג:</strong> {modelInfo.classification_model?.model_file}</p>
              <p><strong>מחלקות זמינות:</strong></p>
              <ul style={{fontSize: '0.9rem', marginTop: '0.5rem'}}>
                {modelInfo.classification_model?.available_classes?.map((className, index) => (
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
      
      {debugInfo && debugInfo.position_history?.length > 0 && (
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

      <div style={explanationBoxStyle}>
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
          <p><strong>כדי לבדוק:</strong></p>
          <ol>
            <li>לחץ על "הגדר כ'בפנים'" (דבורה מתחילה בצד ימין)</li>
            <li>צפה כשהדבורה חוצה את הקו הצהוב משמאל לימין</li>
            <li>המערכת אמורה להתחיל אירוע ולהציג "EVENT STARTED!"</li>
            <li>כשהדבורה חוזרת וחוצה מימין לשמאל - האירוע יסתיים</li>
          </ol>
          <p><strong>סטטוס נוכחי:</strong> אירוע פעיל = {streamingState.eventActive ? 'כן' : 'לא'}, מיקום אחרון = {streamingState.lastBeeStatus || 'לא זוהה'}</p>
        </div>
      </div>
      
      <div style={warningBoxStyle}>
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
  );
};

export default DebugPanel;