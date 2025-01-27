import React from 'react';
import { Link } from 'react-router-dom'; // אם משתמשים ב-React Router

function Navbar() {
  // אובייקט סגנון (inline styles) לדוגמה
  const navStyle = {
    textAlign: 'right',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEE',
    padding: '0.5rem 1rem',
    boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    direction: 'rtl',      // אם רוצים RTL (לא חובה)
  };

  const brandStyle = {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#333',
    margin: 0
  };

  const ulStyle = {
    listStyle: 'none',
    display: 'flex',
    gap: '1rem',
    margin: 0,
    padding: 0
  };

  const linkStyle = {
    textDecoration: 'none',
    color: '#333',
    fontWeight: '500',
  };

  const linkHoverStyle = {
    textDecoration: 'none',
    color: '#007bff'
  };

  // פונקציה קטנה ליצירת אפקט hover אינליין (לא אופטימלי לפרודקשן)
  const handleMouseOver = (e) => {
    Object.assign(e.target.style, linkHoverStyle);
  };
  const handleMouseOut = (e) => {
    Object.assign(e.target.style, linkStyle);
  };

  return (
    <nav style={navStyle}>
      {/* לוגו/שם המותג */}
      <h2 style={brandStyle}>Queen Track</h2>

      {/* תפריט ניווט */}
      <ul style={ulStyle}>
        <li>
          <Link 
            to="/" 
            style={linkStyle}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
          >
            בית
          </Link>
        </li>
        <li>
          <Link 
            to="/upload" 
            style={linkStyle}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
          >
            העלאה
          </Link>
        </li>
        <li>
          <Link 
            to="/track" 
            style={linkStyle}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
          >
            מעקב
          </Link>
        </li>
      </ul>
    </nav>
  );
}

export default Navbar;
