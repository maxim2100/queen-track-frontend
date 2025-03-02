import React, { useState } from 'react';
const backendUrl = process.env.REACT_APP_BACKEND_URL;

function UploadPage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);

  // פונקציית העלאה
  const handleUpload = async () => {
    if (!selectedFile) {
      alert("אנא בחר קובץ להעלאה");
      return;
    }
    try {
      const formData = new FormData();
      formData.append('videoFile', selectedFile);

      const response = await fetch(`${backendUrl}/video/upload`, {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      setUploadStatus("Success");
      console.log('Uploaded successfully!');
    } catch (err) {
      console.error(err);
      setUploadStatus("Error");
    }
  };

  // סגנונות אינליין לדוגמה
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '1rem',
    fontFamily: 'Arial, sans-serif',
    backgroundColor: '#f8f9fa',
    minHeight: '100vh',
    direction: 'rtl' // אם רוצים RTL בעברית
  };

  const cardStyle = {
    backgroundColor: '#fff',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    width: '400px',
    maxWidth: '90%',
    textAlign: 'center'
  };

  const headingStyle = {
    marginBottom: '1rem'
  };

  const fileInputStyle = {
    margin: '1rem 0',
    fontSize: '1rem',
    padding: '0.3rem'
  };

  const buttonStyle = {
    padding: '0.6rem 1.2rem',
    fontSize: '1rem',
    cursor: 'pointer',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: '#fff',
    marginTop: '1rem'
  };

  const statusStyle = (uploadStatus) => {
    let color = uploadStatus === "Success" ? 'green' : 'red';
    return {
      marginTop: '1rem',
      color
    };
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h2 style={headingStyle}>העלאת וידאו</h2>
        
        <input
          type="file"
          accept="video/*"
          style={fileInputStyle}
          onChange={(e) => setSelectedFile(e.target.files[0])}
        />

        <button style={buttonStyle} onClick={handleUpload}>
          העלה
        </button>

        {uploadStatus && (
          <p style={statusStyle(uploadStatus)}>
            {uploadStatus === "Success"
              ? "הקובץ הועלה בהצלחה!"
              : "אירעה שגיאה במהלך ההעלאה."}
          </p>
        )}
      </div>
    </div>
  );
}

export default UploadPage;
