
import React, { useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, updateDoc, increment } from 'firebase/firestore';
import { RoomStatus, RoomVisibility } from '../types';

interface LandingPageProps {
  user: any;
  onJoinRoom: (roomId: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ user, onJoinRoom }) => {
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');

  const registerPlayerInRoom = async (roomId: string, isHost: boolean = false) => {
    await setDoc(doc(db, `rooms/${roomId}/players`, user.uid), {
      id: user.uid,
      name: displayName || 'Guest ' + user.uid.slice(0, 4),
      score: 0,
      hasGuessed: false,
      isHost,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
      joinedAt: Date.now()
    });
    // Increment player count
    if (!isHost) {
      await updateDoc(doc(db, 'rooms', roomId), {
        playerCount: increment(1)
      });
    }
  };

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
      const roomRef = await addDoc(collection(db, 'rooms'), roomData);
      await registerPlayerInRoom(roomRef.id, true);
      onJoinRoom(roomRef.id);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Failed to create room. Ensure Firestore rules allow writes.");
    } finally {
      setIsJoining(false);
    }
  };

  const joinRandom = async () => {
    setIsJoining(true);
    try {
      const q = query(
        collection(db, 'rooms'),
        where('visibility', '==', RoomVisibility.PUBLIC),
        where('status', '==', RoomStatus.WAITING)
      );
      const snapshot = await getDocs(q);
      
      const availableRooms = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(r => r.playerCount < r.maxPlayers)
        .sort((a, b) => b.playerCount - a.playerCount);

      if (availableRooms.length > 0) {
        const roomId = availableRooms[0].id;
        await registerPlayerInRoom(roomId);
        onJoinRoom(roomId);
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
    const cleanCode = roomCode.trim();
    if (!cleanCode) return;
    setIsJoining(true);
    try {
      const roomSnap = await getDoc(doc(db, 'rooms', cleanCode));
      if (roomSnap.exists()) {
        await registerPlayerInRoom(cleanCode);
        onJoinRoom(cleanCode);
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
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden p-8 transform transition-all hover:scale-[1.01]">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
             <i className="fas fa-pencil-alt text-indigo-600 text-4xl"></i>
          </div>
          <h1 className="text-5xl font-game text-indigo-600 mb-2 drop-shadow-md">ScribbleSync</h1>
          <p className="text-slate-500">Real-time Multiplayer Drawing</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Your Nickname</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-100 focus:border-indigo-400 focus:bg-white bg-slate-50 outline-none text-lg transition-all"
              placeholder="Enter name..."
              maxLength={15}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={joinRandom}
              disabled={isJoining}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transform active:scale-95 transition-all text-xl disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {isJoining ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-play"></i>}
              Play Now
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => createRoom(RoomVisibility.PUBLIC)}
                disabled={isJoining}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 text-sm"
              >
                Create Public
              </button>
              <button
                onClick={() => createRoom(RoomVisibility.PRIVATE)}
                disabled={isJoining}
                className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 text-sm"
              >
                Create Private
              </button>
            </div>
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-slate-100"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase tracking-widest">or private code</span>
            <div className="flex-grow border-t border-slate-100"></div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="flex-1 px-4 py-2 rounded-xl border-2 border-slate-100 focus:border-indigo-400 outline-none bg-slate-50"
              placeholder="Room ID"
            />
            <button
              onClick={joinByCode}
              disabled={isJoining || !roomCode}
              className="px-6 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold rounded-xl transition-all disabled:opacity-50"
            >
              Join
            </button>
          </div>
        </div>
      </div>
      <p className="mt-8 text-white/60 text-sm font-medium">Build with ❤️ for Scribble Fans</p>
    </div>
  );
};

export default LandingPage;
