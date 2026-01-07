
import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import LandingPage from './components/LandingPage';
import GameRoom from './components/GameRoom';

const App: React.FC = () => {
  const [user, setUser] = useState<any>(auth.currentUser);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);

  useEffect(() => {
    // Initial auth check
    if (!user) {
      auth.signInAnonymously().then(res => setUser(res.user));
    }
  }, [user]);

  const handleJoinRoom = (roomId: string) => {
    setCurrentRoomId(roomId);
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
  };

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-blue-500 text-white">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl mb-4"></i>
          <h1 className="text-2xl font-game">Initializing ScribbleSync...</h1>
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
