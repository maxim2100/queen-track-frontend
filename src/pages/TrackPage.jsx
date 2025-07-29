import React, { useState, useEffect, useRef } from 'react';
import { EventsApiService } from '../services';

function TrackPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedEvents, setExpandedEvents] = useState(new Set());
  const [deletingEvents, setDeletingEvents] = useState(new Set());
  
  // Simple filtering state
  const [filters, setFilters] = useState({
    date: '',
    minDuration: '', // in minutes
    maxDuration: ''  // in minutes
  });
  
  // Refs to store video elements for synchronized playback
  const videoRefs = useRef({});

  // Fetch and filter events
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await EventsApiService.getAllEvents();
      
      // Apply client-side filtering
      const filteredData = data.filter(event => {
        // Date filter
        if (filters.date) {
          const eventDate = new Date(event.time_out).toDateString();
          const filterDate = new Date(filters.date).toDateString();
          if (eventDate !== filterDate) return false;
        }
        
        // Duration filter (only for completed events)
        if ((filters.minDuration || filters.maxDuration) && event.time_out && event.time_in) {
          const outTime = new Date(event.time_out);
          const inTime = new Date(event.time_in);
          const durationMinutes = Math.round((inTime - outTime) / 60000);
          
          if (filters.minDuration && durationMinutes < parseInt(filters.minDuration)) return false;
          if (filters.maxDuration && durationMinutes > parseInt(filters.maxDuration)) return false;
        }
        
        return true;
      });
      
      // Sort by most recent first
      filteredData.sort((a, b) => new Date(b.time_out) - new Date(a.time_out));
      
      setEvents(filteredData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // בעת טעינת הקומפוננטה או שינוי פילטרים
  useEffect(() => {
    fetchEvents();
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      date: '',
      minDuration: '',
      maxDuration: ''
    });
  };

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
      <h1 style={{ textAlign: 'right', marginBottom: '20px' }}>רשימת אירועים ומדדים</h1>
      
      {/* Simple Filter Bar */}
      <div style={simpleFilterBarStyle}>
        <div style={filterItemStyle}>
          <label style={simpleFilterLabelStyle}>תאריך:</label>
          <input
            type="date"
            value={filters.date}
            onChange={(e) => handleFilterChange('date', e.target.value)}
            style={simpleFilterInputStyle}
          />
        </div>
        
        <div style={filterItemStyle}>
          <label style={simpleFilterLabelStyle}>משך מינימום (דקות):</label>
          <input
            type="number"
            min="0"
            placeholder="0"
            value={filters.minDuration}
            onChange={(e) => handleFilterChange('minDuration', e.target.value)}
            style={simpleFilterInputStyle}
          />
        </div>
        
        <div style={filterItemStyle}>
          <label style={simpleFilterLabelStyle}>משך מקסימום (דקות):</label>
          <input
            type="number"
            min="0"
            placeholder="∞"
            value={filters.maxDuration}
            onChange={(e) => handleFilterChange('maxDuration', e.target.value)}
            style={simpleFilterInputStyle}
          />
        </div>
        
        <button onClick={resetFilters} style={resetFilterButtonStyle}>
          אפס פילטרים
        </button>
      </div>

      {/* Events List Header */}
      <div style={eventsHeaderStyle}>
        <h2 style={{ margin: 0, color: '#333' }}>
          📋 רשימת אירועים ({events.length} תוצאות)
        </h2>
        {loading && <span style={{ color: '#007bff' }}>🔄 טוען...</span>}
      </div>
      
      {events.length === 0 && !loading ? (
        <div style={noEventsStyle}>
          <p>לא נמצאו אירועים תואמים לפילטרים שנבחרו.</p>
          <button onClick={resetFilters} style={resetButtonStyle}>
            אפס פילטרים
          </button>
        </div>
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

// Simple filter styles
const simpleFilterBarStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '20px',
  backgroundColor: '#fff',
  border: '1px solid #ddd',
  borderRadius: '8px',
  padding: '15px',
  marginBottom: '20px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  flexWrap: 'wrap'
};

const filterItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px'
};

const simpleFilterLabelStyle = {
  fontSize: '14px',
  fontWeight: '500',
  color: '#333',
  whiteSpace: 'nowrap'
};

const simpleFilterInputStyle = {
  padding: '8px 12px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  fontSize: '14px',
  width: '140px'
};

const resetFilterButtonStyle = {
  padding: '8px 16px',
  backgroundColor: '#dc3545',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '14px',
  marginRight: 'auto'
};

const eventsHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '15px',
  padding: '10px 0'
};

const noEventsStyle = {
  textAlign: 'center',
  padding: '40px',
  backgroundColor: '#f8f9fa',
  border: '1px solid #e9ecef',
  borderRadius: '8px',
  color: '#666'
};

const resetButtonStyle = {
  padding: '10px 20px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  marginTop: '10px'
};

export default TrackPage;
