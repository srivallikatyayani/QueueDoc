import { Routes, Route, Navigate } from 'react-router-dom';
import Receptionist from './pages/Receptionist';
import Display from './pages/Display';
import { io } from 'socket.io-client';

export const socket = io(import.meta.env.PROD ? '/' : (import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'));

function App() {
  return (
    <Routes>
      <Route path="/reception" element={<Receptionist />} />
      <Route path="/display" element={<Display />} />
      <Route path="*" element={<Navigate to="/reception" replace />} />
    </Routes>
  );
}

export default App;
