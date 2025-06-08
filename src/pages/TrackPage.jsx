import React, { useState, useEffect } from 'react';
const backendUrl = process.env.REACT_APP_BACKEND_URL;

function TrackPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // בעת טעינת הקומפוננטה, נשלח בקשה ל-Backend להביא את כל האירועים
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await fetch(`${backendUrl}/events`); 
        // כתובת לדוגמה; החליפו לפי מה שה-Backend מאזין
        if (!response.ok) {
          throw new Error('Failed to fetch events');
        }
        const data = await response.json();
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
      return `${backendUrl}${videoUrl}`;
    }
    
    // Fallback: treat as filename and construct URL
    return `${backendUrl}/videos/${videoUrl}`;
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
    <div style={{ padding: '1rem' }}>
      <h1>רשימת אירועים</h1>
      
      {events.length === 0 ? (
        <p>לא נמצאו אירועים.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ backgroundColor: '#f2f2f2' }}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>זמן יציאה</th>
              <th style={thStyle}>זמן כניסה</th>
              <th style={thStyle}>משך זמן</th>
              <th style={thStyle}>צפה/הורד וידאו</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => {
              const fullVideoUrl = getFullVideoUrl(event.video_url);
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
              
              return (
                <tr key={event.id || index}>
                  <td style={tdStyle}>{index + 1}</td>
                  <td style={tdStyle}>{timeOut}</td>
                  <td style={tdStyle}>{timeIn}</td>
                  <td style={tdStyle}>{duration}</td>
                  <td style={tdStyle}>
                    {/* כפתור/לינק לצפייה בווידאו */}
                    {fullVideoUrl ? (
                      <div>
                        <a 
                          href={fullVideoUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ color: 'blue', marginRight: '10px' }}
                        >
                          צפה בווידאו
                        </a>
                        <a 
                          href={fullVideoUrl}
                          download
                          style={{ color: 'green' }}
                        >
                          הורד
                        </a>
                      </div>
                    ) : (
                      'לא קיים וידאו'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// קצת סגנון בסיסי לטבלה
const thStyle = {
  border: '1px solid #ddd',
  padding: '8px',
  textAlign: 'left'
};

const tdStyle = {
  border: '1px solid #ddd',
  padding: '8px'
};

export default TrackPage;
