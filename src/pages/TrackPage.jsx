import React, { useState, useEffect, useRef } from 'react';
import { EventsApiService } from '../services';

function TrackPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [deletingEvents, setDeletingEvents] = useState(new Set());
  
  // Refs to store video elements for synchronized playback
  const videoRefs = useRef({});

  // בעת טעינת הקומפוננטה, נשלח בקשה ל-Backend להביא את כל האירועים
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await EventsApiService.getAllEvents();
        setEvents(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Helper function to construct full video URL
  const getFullVideoUrl = (videoUrl) => {
    if (!videoUrl) return null;
    
    // If it's already a full URL, return as is
    if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
      return videoUrl;
    }
    
    // If it's a relative URL starting with /videos/, construct full URL
    if (videoUrl.startsWith('/videos/')) {
      return `${process.env.REACT_APP_BACKEND_URL}${videoUrl}`;
    }
    
    // Fallback: treat as filename and construct URL
    return `${process.env.REACT_APP_BACKEND_URL}/videos/${videoUrl}`;
  };

  // Toggle video section visibility
  const toggleVideos = (eventId) => {
    const newExpanded = new Set(expandedEvents);
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId);
    } else {
      newExpanded.add(eventId);
    }
    setExpandedEvents(newExpanded);
  };

  // Synchronized video playback
  const handleVideoPlay = (eventId, videoType) => {
    const internalVideo = videoRefs.current[`${eventId}_internal`];
    const externalVideo = videoRefs.current[`${eventId}_external`];
    
    if (internalVideo && externalVideo) {
      if (videoType === 'internal') {
        externalVideo.currentTime = internalVideo.currentTime;
        externalVideo.play();
      } else {
        internalVideo.currentTime = externalVideo.currentTime;
        internalVideo.play();
      }
    }
  };

  const handleVideoPause = (eventId) => {
    const internalVideo = videoRefs.current[`${eventId}_internal`];
    const externalVideo = videoRefs.current[`${eventId}_external`];
    
    if (internalVideo && externalVideo) {
      internalVideo.pause();
      externalVideo.pause();
    }
  };

  // Delete event function
  const deleteEvent = async (eventId) => {
    if (!window.confirm('האם אתה בטוח שברצונך למחוק את האירוע הזה? פעולה זו תמחק את האירוע ואת כל הווידאו הקשור אליו.')) {
      return;
    }

    setDeletingEvents(prev => new Set([...prev, eventId]));

    try {
      await EventsApiService.deleteEvent(eventId);

      // Remove the event from the state
      setEvents(prev => prev.filter(event => {
        const currentEventId = event.id || event._id;
        return currentEventId !== eventId;
      }));

      // Remove from expanded events if it was expanded
      setExpandedEvents(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });

      alert('האירוע נמחק בהצלחה');
    } catch (error) {
      // console.error('Error deleting event:', error);
      alert('שגיאה במחיקת האירוע: ' + error.message);
    } finally {
      setDeletingEvents(prev => {
        const newSet = new Set(prev);
        newSet.delete(eventId);
        return newSet;
      });
    }
  };

  if (loading) {
    return <div style={{ padding: '1rem' }}>טוען נתונים...</div>;
  }

  if (error) {
    return <div style={{ padding: '1rem', color: 'red' }}>
      שגיאה בטעינת האירועים: {error}
    </div>;
  }

  return (
    <div style={{ padding: '1rem', direction: 'rtl' }}>
      <h1 style={{ textAlign: 'right', marginBottom: '20px' }}>רשימת אירועים</h1>
      
      {events.length === 0 ? (
        <p>לא נמצאו אירועים.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {events.map((event, index) => {
            // Prioritize converted videos over original ones
            const internalVideoUrl = getFullVideoUrl(
              event.internal_video_url_converted || event.internal_video_url
            );
            const externalVideoUrl = getFullVideoUrl(
              event.external_video_url_converted || event.external_video_url
            );
            const timeOut = event.time_out ? new Date(event.time_out).toLocaleString('he-IL') : '';
            const timeIn = event.time_in ? new Date(event.time_in).toLocaleString('he-IL') : 'עדיין בחוץ';
            
            // Calculate duration if both times exist
            let duration = '';
            if (event.time_out && event.time_in) {
              const outTime = new Date(event.time_out);
              const inTime = new Date(event.time_in);
              const diffMs = inTime - outTime;
              const diffMins = Math.round(diffMs / 60000);
              duration = `${diffMins} דקות`;
            }
            
            const eventId = event.id || event._id || index;
            const isExpanded = expandedEvents.has(eventId);
            const hasVideos = internalVideoUrl || externalVideoUrl;
            
            return (
              <div key={eventId} style={eventContainerStyle}>
                {/* Event Header */}
                <div style={eventHeaderStyle}>
                  <div style={eventInfoStyle}>
                    <span style={eventNumberStyle}>אירוע #{index + 1}</span>
                    <span>זמן יציאה: {timeOut}</span>
                    <span>זמן כניסה: {timeIn}</span>
                    <span>משך זמן: {duration}</span>
                    {/* Conversion status indicator */}
                    {event.conversion_status && (
                      <span style={{
                        fontSize: '0.8em',
                        color: event.conversion_status === 'completed' ? '#28a745' : 
                               event.conversion_status === 'processing' ? '#ffc107' : 
                               event.conversion_status === 'failed' ? '#dc3545' : '#6c757d',
                        fontStyle: 'italic'
                      }}>
                        סטטוס המרה: {
                          event.conversion_status === 'completed' ? 'הושלמה' :
                          event.conversion_status === 'processing' ? 'מתבצעת...' :
                          event.conversion_status === 'failed' ? 'נכשלה' :
                          event.conversion_status === 'pending' ? 'ממתינה' : event.conversion_status
                        }
                        {event.conversion_status === 'completed' && 
                         (event.internal_video_url_converted || event.external_video_url_converted) && 
                         ' ✓ (גרסה מומרת)'
                        }
                      </span>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {hasVideos && (
                      <button
                        onClick={() => toggleVideos(eventId)}
                        style={{
                          ...videoToggleButtonStyle,
                          backgroundColor: isExpanded ? '#dc3545' : '#007bff'
                        }}
                      >
                        {isExpanded ? 'הסתר וידאו' : 'הצג וידאו'}
                      </button>
                    )}
                    
                    {!hasVideos && (
                      <span style={{ color: '#666', fontStyle: 'italic' }}>
                        לא קיים וידאו
                      </span>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={() => deleteEvent(eventId)}
                      disabled={deletingEvents.has(eventId)}
                      style={{
                        ...deleteButtonStyle,
                        opacity: deletingEvents.has(eventId) ? 0.6 : 1,
                        cursor: deletingEvents.has(eventId) ? 'not-allowed' : 'pointer'
                      }}
                      title="מחק אירוע"
                    >
                      {deletingEvents.has(eventId) ? '🔄' : '🗑️'}
                    </button>
                  </div>
                </div>

                {/* Video Section */}
                {isExpanded && hasVideos && (
                  <div style={videoSectionStyle}>
                    <div style={videoControlsStyle}>
                      <button
                        onClick={() => {
                          const internalVideo = videoRefs.current[`${eventId}_internal`];
                          const externalVideo = videoRefs.current[`${eventId}_external`];
                          if (internalVideo) internalVideo.play();
                          if (externalVideo) externalVideo.play();
                        }}
                        style={controlButtonStyle}
                      >
                        ▶ השמע שניהם
                      </button>
                      
                      <button
                        onClick={() => handleVideoPause(eventId)}
                        style={controlButtonStyle}
                      >
                        ⏸ עצור שניהם
                      </button>
                    </div>

                    <div style={videosContainerStyle}>
                      {/* Internal Camera Video */}
                      {internalVideoUrl && (
                        <div style={videoWrapperStyle}>
                          <h4 style={videoTitleStyle}>מצלמה פנימית</h4>
                          <video
                            ref={(el) => {
                              if (el) videoRefs.current[`${eventId}_internal`] = el;
                            }}
                            src={internalVideoUrl}
                            controls
                            style={videoStyle}
                            onPlay={() => handleVideoPlay(eventId, 'internal')}
                            onPause={() => handleVideoPause(eventId)}
                          >
                            הדפדפן שלך אינו תומך בתגית וידאו.
                          </video>
                          <div style={videoLinksStyle}>
                            <a 
                              href={internalVideoUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              style={linkStyle}
                            >
                              פתח בחלון נפרד
                            </a>
                            <a 
                              href={internalVideoUrl}
                              download
                              style={linkStyle}
                            >
                              הורד
                            </a>
                          </div>
                        </div>
                      )}

                      {/* External Camera Video */}
                      {externalVideoUrl && (
                        <div style={videoWrapperStyle}>
                          <h4 style={videoTitleStyle}>מצלמה חיצונית</h4>
                          <video
                            ref={(el) => {
                              if (el) videoRefs.current[`${eventId}_external`] = el;
                            }}
                            src={externalVideoUrl}
                            controls
                            style={videoStyle}
                            onPlay={() => handleVideoPlay(eventId, 'external')}
                            onPause={() => handleVideoPause(eventId)}
                          >
                            הדפדפן שלך אינו תומך בתגית וידאו.
                          </video>
                          <div style={videoLinksStyle}>
                            <a 
                              href={externalVideoUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              style={linkStyle}
                            >
                              פתח בחלון נפרד
                            </a>
                            <a 
                              href={externalVideoUrl}
                              download
                              style={linkStyle}
                            >
                              הורד
                            </a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Styles
const eventContainerStyle = {
  border: '1px solid #ddd',
  borderRadius: '8px',
  overflow: 'hidden',
  backgroundColor: '#fff',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
};

const eventHeaderStyle = {
  padding: '15px',
  backgroundColor: '#f8f9fa',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: '10px',
  flexDirection: 'row-reverse' // מידע בימין, כפתור בשמאל
};

const eventInfoStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '5px',
  flex: 1
};

const eventNumberStyle = {
  fontWeight: 'bold',
  fontSize: '1.1em',
  color: '#007bff'
};

const videoToggleButtonStyle = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '4px',
  color: 'white',
  cursor: 'pointer',
  fontWeight: 'bold',
  transition: 'opacity 0.2s'
};

const videoSectionStyle = {
  padding: '20px',
  backgroundColor: '#fff'
};

const videoControlsStyle = {
  display: 'flex',
  gap: '10px',
  marginBottom: '15px',
  justifyContent: 'center'
};

const controlButtonStyle = {
  padding: '8px 16px',
  backgroundColor: '#28a745',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const videosContainerStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
  gap: '20px'
};

const videoWrapperStyle = {
  display: 'flex',
  flexDirection: 'column'
};

const videoTitleStyle = {
  margin: '0 0 10px 0',
  color: '#333',
  textAlign: 'center'
};

const videoStyle = {
  width: '100%',
  maxWidth: '100%',
  height: 'auto',
  border: '1px solid #ddd',
  borderRadius: '4px'
};

const videoLinksStyle = {
  display: 'flex',
  gap: '10px',
  justifyContent: 'center',
  marginTop: '10px'
};

const linkStyle = {
  color: '#007bff',
  textDecoration: 'none',
  padding: '4px 8px',
  border: '1px solid #007bff',
  borderRadius: '4px',
  fontSize: '0.9em'
};

const deleteButtonStyle = {
  padding: '8px 12px',
  backgroundColor: '#dc3545',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '16px',
  transition: 'all 0.2s'
};

export default TrackPage;
