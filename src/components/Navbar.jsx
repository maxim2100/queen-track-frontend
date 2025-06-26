import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

const websocketUrl = process.env.REACT_APP_WEBSOCKET_URL;
const backendUrl = process.env.REACT_APP_BACKEND_URL;

function Navbar() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [ws, setWs] = useState(null);

  // פונקציה לטעינת התרעות מהמונגו
  const loadNotificationsFromDB = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/video/notifications`);
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        
        // חישוב מספר התרעות שלא נקראו
        const unreadCount = data.notifications.filter(n => !n.read).length;
        setUnreadCount(unreadCount);
      }
    } catch (error) {
      // Silent error handling for production
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading notifications from database:', error);
      }
    }
  }, [backendUrl]);

  // התחברות ל-WebSocket להתרעות
  useEffect(() => {
    const connectWebSocket = () => {
      const websocket = new WebSocket(`${websocketUrl}/video/notifications`);
      
      websocket.onopen = () => {
        // טעינת התרעות קיימות מהמונגו
        loadNotificationsFromDB();
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'bee_notification') {
            addNotification(data);
          }
        } catch (error) {
          // Silent error handling for production
          if (process.env.NODE_ENV === 'development') {
            console.error('Error parsing notification:', error);
          }
        }
      };

      websocket.onclose = () => {
        // נסה להתחבר מחדש אחרי 5 שניות
        setTimeout(connectWebSocket, 5000);
      };

      websocket.onerror = (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('Notifications WebSocket error:', error);
        }
      };

      setWs(websocket);
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [loadNotificationsFromDB, websocketUrl, ws]);

  const addNotification = (notificationData) => {
    const newNotification = {
      id: Date.now(),
      event_type: notificationData.event_type,
      message: notificationData.message,
      timestamp: new Date(notificationData.timestamp),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]); // שמור רק 50 התרעות אחרונות
    setUnreadCount(prev => prev + 1);
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`${backendUrl}/video/notifications/mark-all-read`, {
        method: 'POST'
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to mark notifications as read');
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error marking notifications as read:', error);
      }
    }
  };

  const deleteAllNotifications = async () => {
    try {
      const response = await fetch(`${backendUrl}/video/notifications`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
        setShowNotifications(false);
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.error('Failed to delete notifications');
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting notifications:', error);
      }
    }
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && unreadCount > 0) {
      markAllAsRead();
    }
  };

  const navStyle = {
    backgroundColor: '#343a40',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    position: 'relative'
  };

  const brandStyle = {
    color: 'white',
    textDecoration: 'none',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    margin: 0
  };

  const navLinksStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    listStyle: 'none',
    margin: 0,
    padding: 0
  };

  const linkStyle = {
    color: 'white',
    textDecoration: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    transition: 'background-color 0.3s'
  };

  const bellStyle = {
    position: 'relative',
    background: 'none',
    border: 'none',
    color: 'white',
    fontSize: '1.2rem',
    cursor: 'pointer',
    padding: '0.5rem',
    borderRadius: '4px',
    transition: 'background-color 0.3s'
  };

  const badgeStyle = {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    backgroundColor: '#dc3545',
    color: 'white',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const notificationsDropdownStyle = {
    position: 'absolute',
    top: '100%',
    right: '0',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    width: '350px',
    maxHeight: '400px',
    overflowY: 'auto',
    zIndex: 1000,
    direction: 'rtl'
  };

  const notificationItemStyle = {
    padding: '10px',
    borderBottom: '1px solid #eee',
    fontSize: '14px',
    color: '#333'
  };

  const notificationHeaderStyle = {
    padding: '10px',
    borderBottom: '2px solid #ddd',
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#f8f9fa',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const buttonStyle = {
    background: 'none',
    border: '1px solid #dc3545',
    color: '#dc3545',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    cursor: 'pointer',
    marginLeft: '8px'
  };

  const getNotificationIcon = (type) => {
    return type === 'exit' ? '🐝➡️' : '🐝⬅️';
  };

  const formatNotificationTime = (timestamp) => {
    const now = new Date();
    const notifTime = new Date(timestamp);
    const diff = now - notifTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'עכשיו';
    if (minutes < 60) return `לפני ${minutes} דקות`;
    if (hours < 24) return `לפני ${hours} שעות`;
    return notifTime.toLocaleDateString('he-IL');
  };

  return (
    <nav style={navStyle}>
      {/* כותרת בשמאל */}
      <Link to="/" style={{ textDecoration: 'none' }}>
        <h2 style={brandStyle}>Queen Track</h2>
      </Link>

      {/* תפריט ניווט בימין */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <ul style={navLinksStyle}>
          <li>
            <Link to="/" style={linkStyle}>
              🏠 בית
            </Link>
          </li>
          <li>
            <Link to="/track" style={linkStyle}>
              📊 מעקב
            </Link>
          </li>
          <li>
            <Link to="/settings" style={linkStyle}>
              ⚙️ הגדרות
            </Link>
          </li>
        </ul>

        {/* פעמון התרעות */}
        <div style={{ position: 'relative' }}>
          <button 
            style={bellStyle}
            onClick={toggleNotifications}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#495057'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            🔔
            {unreadCount > 0 && (
              <span style={badgeStyle}>{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div style={notificationsDropdownStyle}>
              <div style={notificationHeaderStyle}>
                <span>התרעות ({notifications.length})</span>
                <div>
                  <button 
                    style={buttonStyle}
                    onClick={deleteAllNotifications}
                    onMouseEnter={(e) => {
                      e.target.style.backgroundColor = '#dc3545';
                      e.target.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = 'transparent';
                      e.target.style.color = '#dc3545';
                    }}
                  >
                    מחק הכל
                  </button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                  אין התרעות
                </div>
              ) : (
                notifications.map(notification => (
                  <div key={notification.id || notification._id} style={{
                    ...notificationItemStyle,
                    backgroundColor: notification.read ? 'white' : '#f8f9fa'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{getNotificationIcon(notification.event_type)}</span>
                      <div style={{ flex: 1 }}>
                        <div>{notification.message}</div>
                        <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                          {formatNotificationTime(notification.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
