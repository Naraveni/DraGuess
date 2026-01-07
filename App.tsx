
import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
// Fix: Corrected modular imports for Firebase Auth functions
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import LandingPage from './components/LandingPage';
import GameRoom from './components/GameRoom';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fix: Using the correct modular onAuthStateChanged listener with the auth instance
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(u);
        setLoading(false);
      } else {
        signInAnonymously(auth).catch(err => console.error("Auth error:", err));
      }
    });
    return () => unsubscribe();
  }, []);

  const handleJoinRoom = (roomId: string) => {
    setCurrentRoomId(roomId);
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-indigo-600 text-white">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl mb-4"></i>
          <h1 className="text-2xl font-game">Syncing with Firebase...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100">
      {currentRoomId ? (
        <GameRoom 
          roomId={currentRoomId} 
          user={user} 
          onLeave={handleLeaveRoom} 
        />
      ) : (
        <LandingPage 
          user={user} 
          onJoinRoom={handleJoinRoom} 
        />
      )}
    </div>
  );
};

export default App;
