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
              <th style={thStyle}>סוג אירוע</th>
              <th style={thStyle}>זמן התחלה</th>
              <th style={thStyle}>זמן סיום</th>
              <th style={thStyle}>צפה/הורד וידאו</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, index) => (
              <tr key={event.event_id}>
                <td style={tdStyle}>{index + 1}</td>
                <td style={tdStyle}>{event.event_type}</td>
                <td style={tdStyle}>{event.start_time}</td>
                <td style={tdStyle}>
                  {event.end_time ? event.end_time : 'עדיין נמשך'}
                </td>
                <td style={tdStyle}>
                  {/* כפתור/לינק לצפייה בווידאו */}
                  {event.video_url ? (
                    <a 
                      href={event.video_url} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ color: 'blue' }}
                    >
                      צפה/הורד
                    </a>
                  ) : (
                    'לא קיים וידאו'
                  )}
                </td>
              </tr>
            ))}
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
