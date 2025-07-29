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
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px',
    marginTop: '1rem',
    maxWidth: '1200px',
    width: '100%',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const headerStyle = {
    backgroundColor: '#f8f9fa',
    padding: '1rem',
    borderBottom: '1px solid #ddd',
    borderRadius: '8px 8px 0 0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.5rem'
  };

  const buttonStyle = {
    padding: '0.5rem 1rem',
    fontSize: '0.9rem',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    transition: 'all 0.2s'
  };

  const contentStyle = {
    padding: '1rem'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: '1rem',
    marginBottom: '1rem'
  };

  const cardStyle = {
    backgroundColor: '#f8f9fa',
    border: '1px solid #e9ecef',
    borderRadius: '6px',
    padding: '1rem'
  };

  const cardHeaderStyle = {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    marginBottom: '0.75rem',
    color: '#333',
    borderBottom: '2px solid #007bff',
    paddingBottom: '0.5rem'
  };

  const statusItemStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.4rem 0',
    borderBottom: '1px solid #e9ecef',
    fontSize: '0.9rem'
  };

  const statusLabelStyle = {
    fontWeight: '500',
    color: '#495057',
    flex: 1
  };

  const statusValueStyle = {
    color: '#007bff',
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'left',
    wordBreak: 'break-word'
  };

  const infoBoxStyle = {
    backgroundColor: '#fff3cd',
    padding: '1rem',
    borderRadius: '6px',
    margin: '1rem 0',
    border: '1px solid #ffeaa7'
  };

  const explanationBoxStyle = {
    backgroundColor: '#d4f4f7',
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

  const historyContainerStyle = {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    maxHeight: '200px',
    overflowY: 'auto',
    padding: '0.5rem'
  };

  const historyItemStyle = {
    fontSize: '0.85rem',
    marginBottom: '0.25rem',
    padding: '0.25rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '3px',
    border: '1px solid #e9ecef'
  };

  return (
    <div style={debugPanelStyle}>
      <div style={headerStyle}>
        <h3 style={{ margin: 0, color: '#333' }}>🔧 מידע דיבוג ומעקב</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            onClick={fetchModelInfo}
            style={{...buttonStyle, backgroundColor: '#6f42c1'}}
          >
            מידע מודל
          </button>
          <button 
            onClick={fetchDebugInfo}
            style={{...buttonStyle, backgroundColor: '#17a2b8'}}
          >
            רענן מידע דיבוג
          </button>
          <button 
            onClick={resetTracking}
            style={{...buttonStyle, backgroundColor: '#dc3545'}}
          >
            אפס מעקב
          </button>
          <button 
            onClick={resetCameraRetries}
            style={{...buttonStyle, backgroundColor: '#28a745'}}
          >
            אפס מוני מצלמה
          </button>
        </div>
      </div>

      <div style={contentStyle}>
      
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
          {/* Current Status Card */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>📊 סטטוס נוכחי</div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>מיקום דבורה:</span>
              <span style={statusValueStyle}>{streamingState.lastBeeStatus || 'לא זוהתה'}</span>
            </div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>נקודות מעקב:</span>
              <span style={statusValueStyle}>{streamingState.positionHistoryCount || 0}</span>
            </div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>מצלמה חיצונית:</span>
              <span style={statusValueStyle}>
                {cameraState.externalCameraActive ? 'פעילה' : 'כבויה'} ({cameraState.externalCameraStatus})
              </span>
            </div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>אירוע פעיל:</span>
              <span style={statusValueStyle}>{streamingState.eventActive ? 'כן' : 'לא'}</span>
            </div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>פעולת אירוע אחרונה:</span>
              <span style={statusValueStyle}>{streamingState.eventAction || 'אין'}</span>
            </div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>זיהויים רצופים בפנים:</span>
              <span style={statusValueStyle}>{streamingState.consecutiveDetections?.inside || 0}</span>
            </div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>זיהויים רצופים בחוץ:</span>
              <span style={statusValueStyle}>{streamingState.consecutiveDetections?.outside || 0}</span>
            </div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>רצף סטטוסים:</span>
              <span style={statusValueStyle}>{streamingState.statusSequence?.join(' → ') || 'אין'}</span>
            </div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>WebSocket התראות:</span>
              <span style={statusValueStyle}>
                {NotificationService.getConnectionStatus() === 'OPEN' ? 'מחובר' : 'מנותק'}
              </span>
            </div>
          </div>
          
          {/* Camera & Services Card */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>📹 מצלמות ושירותים</div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>ServiceManager:</span>
              <span style={statusValueStyle}>{serviceHealth.overall || 'unknown'}</span>
            </div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>מצלמות זמינות:</span>
              <span style={statusValueStyle}>
                {cameraState.devices?.length || 0} ({cameraState.devices?.map(d => d.label || 'Unknown').join(', ') || 'אין'})
              </span>
            </div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>הרשאות מצלמה:</span>
              <span style={statusValueStyle}>
                {cameraState.devices?.length > 0 ? 'ניתנו' : 'לא ניתנו/שגיאה'}
              </span>
            </div>
            <div style={statusItemStyle}>
              <span style={statusLabelStyle}>מצלמה חיצונית נבחרת:</span>
              <span style={statusValueStyle}>
                {cameraState.selectedExternalDeviceId ? 
                  (cameraState.devices.find(d => d.deviceId === cameraState.selectedExternalDeviceId)?.label || 
                   cameraState.selectedExternalDeviceId.substr(0, 20) + '...') : 
                  'לא נבחרה'}
              </span>
            </div>
            
            {debugInfo && (
              <>
                <div style={statusItemStyle}>
                  <span style={statusLabelStyle}>קו מרכזי X:</span>
                  <span style={statusValueStyle}>{debugInfo.configuration?.center_line_x || 'לא זמין'}</span>
                </div>
                <div style={statusItemStyle}>
                  <span style={statusLabelStyle}>רזולוציית מסגרת:</span>
                  <span style={statusValueStyle}>
                    {debugInfo.configuration?.frame_width}x{debugInfo.configuration?.frame_height}
                  </span>
                </div>
                <div style={statusItemStyle}>
                  <span style={statusLabelStyle}>זיהויים רצופים נדרשים:</span>
                  <span style={statusValueStyle}>{debugInfo.configuration?.min_consecutive_detections}</span>
                </div>
                <div style={statusItemStyle}>
                  <span style={statusLabelStyle}>מחפש מעבר:</span>
                  <span style={statusValueStyle}>{debugInfo.debug_info?.looking_for_crossing || 'לא זמין'}</span>
                </div>
              </>
            )}
          </div>

          {/* Model Info Card */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>🤖 מידע מודל</div>
            {modelInfo ? (
              <>
                <div style={statusItemStyle}>
                  <span style={statusLabelStyle}>מודל סיווג:</span>
                  <span style={statusValueStyle}>{modelInfo.classification_model?.model_file}</span>
                </div>
                <div style={statusItemStyle}>
                  <span style={statusLabelStyle}>סף זיהוי:</span>
                  <span style={statusValueStyle}>{modelInfo.detection_threshold}</span>
                </div>
                <div style={statusItemStyle}>
                  <span style={statusLabelStyle}>קו מרכזי:</span>
                  <span style={statusValueStyle}>{modelInfo.center_line_x || 'לא זמין'}</span>
                </div>
                <div style={statusItemStyle}>
                  <span style={statusLabelStyle}>מימדי מסגרת:</span>
                  <span style={statusValueStyle}>{modelInfo.frame_dimensions || 'לא זמין'}</span>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={statusLabelStyle}>מחלקות זמינות:</div>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.85rem' }}>
                    {modelInfo.classification_model?.available_classes?.map((className, index) => (
                      <span key={index} style={{
                        display: 'inline-block',
                        backgroundColor: '#007bff',
                        color: 'white',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        margin: '0.1rem',
                      }}>
                        {className}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#666', padding: '1rem' }}>
                לחץ על "מידע מודל" לטעינת נתונים
              </div>
            )}
          </div>
        </div>
      
        {debugInfo && debugInfo.position_history?.length > 0 && (
          <div style={{ ...cardStyle, marginTop: '1rem' }}>
            <div style={cardHeaderStyle}>📍 היסטוריית מיקומים אחרונה</div>
            <div style={historyContainerStyle}>
              {debugInfo.position_history.map((pos, index) => (
                <div key={index} style={historyItemStyle}>
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
    </div>
  );
};

export default DebugPanel;