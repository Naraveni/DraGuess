
import React, { useState } from 'react';
import { db } from '../firebaseConfig';
import { RoomStatus, RoomVisibility } from '../types';

interface LandingPageProps {
  user: any;
  onJoinRoom: (roomId: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ user, onJoinRoom }) => {
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName || '');

  const createRoom = async (visibility: RoomVisibility) => {
    setIsJoining(true);
    try {
      const roomData = {
        status: RoomStatus.WAITING,
        visibility,
        currentRound: 0,
        maxRounds: 3,
        drawerId: null,
        currentWord: null,
        timer: 0,
        hostId: user.uid,
        playerCount: 1,
        maxPlayers: 8,
        lastActiveAt: Date.now(),
      };
      const docRef = await db.collection('rooms').add(roomData);
      
      // Add initial player
      await db.collection(`rooms/${docRef.id}/players`).doc(user.uid).set({
        id: user.uid,
        name: displayName || 'Guest',
        score: 0,
        hasGuessed: false,
        isHost: true,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        joinedAt: Date.now()
      });

      onJoinRoom(docRef.id);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Failed to create room.");
    } finally {
      setIsJoining(false);
    }
  };

  const joinRandom = async () => {
    setIsJoining(true);
    try {
      const snapshot = await db.collection('rooms')
        .where('visibility', '==', RoomVisibility.PUBLIC)
        .where('status', '==', RoomStatus.WAITING)
        .get();
      
      const availableRooms = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((r: any) => r.playerCount < r.maxPlayers)
        .sort((a: any, b: any) => b.playerCount - a.playerCount);

      if (availableRooms.length > 0) {
        onJoinRoom(availableRooms[0].id);
      } else {
        await createRoom(RoomVisibility.PUBLIC);
      }
    } catch (error) {
      console.error("Matchmaking error:", error);
      alert("Matchmaking failed. Try creating a room.");
    } finally {
      setIsJoining(false);
    }
  };

  const joinByCode = async () => {
    if (!roomCode.trim()) return;
    setIsJoining(true);
    try {
      const doc = await db.collection('rooms').doc(roomCode.trim()).get();
      if (doc.exists) {
        onJoinRoom(roomCode.trim());
      } else {
        alert("Room not found!");
      }
    } catch (error) {
      alert("Error joining room.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden p-8">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-game text-indigo-600 mb-2 drop-shadow-md">ScribbleSync</h1>
          <p className="text-slate-500">The ultimate draw & guess experience</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Your Nickname</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:ring-0 transition-all outline-none text-lg"
              placeholder="Enter name..."
              maxLength={15}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={joinRandom}
              disabled={isJoining}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transform active:scale-95 transition-all text-xl disabled:opacity-50"
            >
              <i className="fas fa-play mr-2"></i> Join Random Room
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => createRoom(RoomVisibility.PUBLIC)}
                disabled={isJoining}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                Create Public
              </button>
              <button
                onClick={() => createRoom(RoomVisibility.PRIVATE)}
                disabled={isJoining}
                className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                Create Private
              </button>
            </div>
          </div>

          <div className="relative flex items-center py-4">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-sm">OR JOIN BY CODE</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 transition-all outline-none"
              placeholder="Enter Code"
            />
            <button
              onClick={joinByCode}
              disabled={isJoining || !roomCode}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-8 text-white/80 text-sm flex gap-4">
        <span><i className="fas fa-users mr-1"></i> Multiplayer</span>
        <span><i className="fas fa-bolt mr-1"></i> Realtime Sync</span>
        <span><i className="fas fa-shield-alt mr-1"></i> No Account Required</span>
      </div>
    </div>
  );
};

export default LandingPage;
