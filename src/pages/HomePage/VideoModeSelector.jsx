import React from 'react';
import { STREAM_MODES } from '../../constants';

const VideoModeSelector = ({ streamMode, onStreamModeChange }) => {
  const handleModeChange = (event) => {
    const newMode = event.target.value;
    if (onStreamModeChange) {
      onStreamModeChange(newMode);
    }
  };

  const containerStyle = {
    marginBottom: '1.5rem',
    padding: '1rem',
    backgroundColor: '#f0f8ff',
    borderRadius: '6px',
    border: '1px solid #ddd'
  };

  const radioGroupStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap'
  };

  const radioLabelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer'
  };

  const descriptionStyle = {
    fontSize: '0.9rem',
    color: '#666',
    marginTop: '0.5rem'
  };

  const infoBoxStyle = {
    backgroundColor: '#e8f5e8',
    padding: '1rem',
    marginTop: '1rem',
    borderRadius: '4px',
    border: '1px solid #4CAF50'
  };

  const infoHeaderStyle = {
    margin: '0 0 0.5rem 0',
    color: '#2e7d32'
  };

  const infoTextStyle = {
    fontSize: '0.9rem',
    color: '#2e7d32',
    margin: 0
  };

  return (
    <div style={containerStyle}>
      <h3>מצב שידור מצלמת הכניסה</h3>
      <div style={radioGroupStyle}>
        <label style={radioLabelStyle}>
          <input
            type="radio"
            name="streamMode"
            value={STREAM_MODES.VIDEO}
            checked={streamMode === STREAM_MODES.VIDEO}
            onChange={handleModeChange}
          />
          <span>שידור קובץ וידאו לדוגמה (ברירת מחדל)</span>
        </label>
        <label style={radioLabelStyle}>
          <input
            type="radio"
            name="streamMode"
            value={STREAM_MODES.LIVE}
            checked={streamMode === STREAM_MODES.LIVE}
            onChange={handleModeChange}
          />
          <span>שידור חי מהמצלמה</span>
        </label>
      </div>
      <p style={descriptionStyle}>
        {streamMode === STREAM_MODES.VIDEO
          ? "קובץ הווידאו ישודר בלולאה ויועבר לשרת לעיבוד. החלף את הקובץ בתיקיית public/sample-videos/"
          : "המצלמה הנבחרת תשדר בזמן אמת"}
      </p>
      
      <div style={infoBoxStyle}>
        <h4 style={infoHeaderStyle}>🎯 זיהוי אירועים מבוסס קו מרכזי</h4>
        <p style={infoTextStyle}>
          <strong>קו צהוב במרכז המסך:</strong> מפריד בין צד ימין (תוך הכוורת) לצד שמאל (מחוץ לכוורת)<br/>
          <strong>התחלת אירוע:</strong> דבורה עוברת מימין לשמאל (יוצאת מהכוורת) 🚪<br/>
          <strong>סיום אירוע:</strong> דבורה עוברת משמאל לימין (חוזרת לכוורת) 🏠
        </p>
      </div>
    </div>
  );
};

export default VideoModeSelector;