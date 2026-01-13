import React, { useState, useEffect } from 'react';
import { auth } from './firebaseConfig';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import LandingPage from './components/LandingPage';
import GameRoom from './components/GameRoom';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Ensure we don't hang on the loading screen forever
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    let unsubscribe = () => {};

    if (auth && typeof auth.onAuthStateChanged === 'function') {
      unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u);
        setLoading(false);
        clearTimeout(loadingTimeout);
      });

      // Try to sign in if no current user
      if (!auth.currentUser) {
        signInAnonymously(auth).catch(err => {
          console.error("Auth sign-in failed (likely missing API key):", err);
          setLoading(false);
        });
      }
    } else {
      console.error("Firebase Auth not properly initialized.");
      setLoading(false);
    }

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
    };
  }, []);

  const handleJoinRoom = (roomId: string) => {
    setCurrentRoomId(roomId);
  };

  const handleLeaveRoom = () => {
    setCurrentRoomId(null);
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-indigo-600 text-white">
        <div className="relative flex items-center justify-center mb-8">
          <div className="w-24 h-24 border-8 border-indigo-400/30 rounded-full"></div>
          <div className="absolute w-24 h-24 border-8 border-white rounded-full border-t-transparent animate-spin"></div>
          <i className="fas fa-pencil-alt absolute text-2xl animate-bounce"></i>
        </div>
        <h1 className="text-4xl font-game tracking-widest animate-pulse mb-2">ScribbleSync</h1>
        <p className="text-indigo-200 font-medium tracking-wide">Initializing workspace...</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100 selection:bg-indigo-100">
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