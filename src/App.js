import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import UploadPage from './pages/UploadPage';
import TrackPage from './pages/TrackPage';

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/track" element={<TrackPage />} />
      </Routes>
    </Router>
  );
}

export default App;
