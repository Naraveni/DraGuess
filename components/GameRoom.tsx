
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, collection, updateDoc, deleteDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Room, Player, Message, RoomStatus } from '../types';
import Canvas from './Canvas';
import Chat from './Chat';
import Scoreboard from './Scoreboard';

interface GameRoomProps {
  roomId: string;
  user: any;
  onLeave: () => void;
}

const WORDS = ['Apple', 'Dog', 'Skyline', 'Pizza', 'Rocket', 'Guitar', 'Laptop', 'Elephant', 'Tree', 'Ocean', 'Sushi', 'Robot', 'Volcano', 'Parrot', 'Skateboard', 'Sunflower', 'Mountain', 'Butterfly', 'Hamburger', 'Ice Cream'];

const GameRoom: React.FC<GameRoomProps> = ({ roomId, user, onLeave }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [isPickingWord, setIsPickingWord] = useState(false);
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (snap.exists()) setRoom({ id: snap.id, ...snap.data() } as Room);
      else onLeave();
    });

    const unsubPlayers = onSnapshot(collection(db, `rooms/${roomId}/players`), (snap) => {
      const p = snap.docs.map(d => d.data() as Player);
      const sorted = p.sort((a, b) => b.score - a.score);
      setPlayers(sorted);
    });

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomId, onLeave]);

  useEffect(() => {
    if (!room || room.hostId !== user.uid) return;

    if (room.status === RoomStatus.PLAYING && room.timer > 0) {
      if (!timerIntervalRef.current) {
        timerIntervalRef.current = setInterval(() => {
          updateDoc(doc(db, 'rooms', roomId), { timer: room.timer - 1 });
        }, 1000);
      }
    } else {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (room.status === RoomStatus.PLAYING && room.timer === 0) {
            endTurn();
        }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [room?.status, room?.timer, room?.hostId, user.uid, roomId]);

  const startGame = async () => {
    if (players.length < 2) {
      alert("Need at least 2 players to start!");
      return;
    }
    await nextTurn(1);
  };

  const nextTurn = async (round?: number) => {
    const currentIndex = players.findIndex(p => p.id === room?.drawerId);
    const nextPlayerIndex = round ? 0 : (currentIndex + 1) % players.length;
    const nextDrawer = players[nextPlayerIndex];
    
    // Clear canvas strokes efficiently
    const strokesSnap = await getDocs(collection(db, `rooms/${roomId}/strokes`));
    const batch = writeBatch(db);
    strokesSnap.docs.forEach(d => batch.delete(d.ref));
    
    // Reset player guess statuses
    players.forEach(p => {
        batch.update(doc(db, `rooms/${roomId}/players`, p.id), { hasGuessed: false });
    });

    await batch.commit();

    await updateDoc(doc(db, 'rooms', roomId), {
      status: RoomStatus.PLAYING,
      drawerId: nextDrawer.id,
      currentRound: round || room!.currentRound,
      timer: 80,
      currentWord: null,
      lastActiveAt: Date.now()
    });
  };

  const endTurn = async () => {
    const currentIndex = players.findIndex(p => p.id === room?.drawerId);
    const isLastPlayer = currentIndex === players.length - 1;
    const isGameOver = room!.currentRound >= room!.maxRounds && isLastPlayer;
    
    if (isGameOver) {
      const winner = players[0]; // players are sorted by score
      await updateDoc(doc(db, 'rooms', roomId), { 
          status: RoomStatus.ENDED,
          winner: winner.name 
      });
    } else {
      nextTurn(isLastPlayer ? (room!.currentRound + 1) : undefined);
    }
  };

  const selectWord = async (word: string) => {
    await updateDoc(doc(db, 'rooms', roomId), { currentWord: word.toLowerCase() });
    setIsPickingWord(false);
  };

  useEffect(() => {
    if (room?.drawerId === user.uid && !room.currentWord && room.status === RoomStatus.PLAYING) {
      const picks = [...WORDS].sort(() => 0.5 - Math.random()).slice(0, 3);
      setWordChoices(picks);
      setIsPickingWord(true);
    }
  }, [room?.drawerId, room?.currentWord, room?.status, user.uid]);

  const isDrawer = room?.drawerId === user.uid;
  if (!room) return null;

  return (
    <div className="h-full flex flex-col p-4 space-y-4 max-w-7xl mx-auto bg-slate-50">
      {/* Top Navigation Bar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <button onClick={onLeave} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
            <i className="fas fa-chevron-left"></i>
          </button>
          <div>
            <h2 className="font-game text-xl text-indigo-600">Round {room.currentRound}/{room.maxRounds}</h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">ID: {room.id}</p>
          </div>
        </div>

        <div className="flex-1 flex justify-center">
          <div className="bg-indigo-50 text-indigo-700 px-10 py-3 rounded-2xl font-game text-2xl tracking-[0.2em] shadow-inner border border-indigo-100 min-w-[300px] text-center">
            {isDrawer ? (
                room.currentWord?.toUpperCase() || "SELECT A WORD"
            ) : (
                room.currentWord ? room.currentWord.split('').map(c => c === ' ' ? ' ' : '_').join(' ') : "WAITING..."
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`px-5 py-3 rounded-2xl font-game text-2xl flex items-center gap-3 transition-colors ${room.timer < 15 ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-600 text-white'}`}>
            <i className="fas fa-clock text-xl opacity-80"></i> {room.timer}s
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        {/* Left Sidebar: Scoreboard */}
        <div className="w-full md:w-72 flex flex-col h-full">
           <Scoreboard players={players} drawerId={room.drawerId} />
        </div>

        {/* Center: Canvas Area */}
        <div className="flex-1 flex flex-col gap-4 relative">
          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
             <Canvas 
               roomId={roomId} 
               isDrawer={isDrawer && !!room.currentWord} 
               color={color} 
               brushSize={brushSize} 
             />
          </div>
          
          {/* Drawing Tools */}
          {isDrawer && room.currentWord && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex gap-2">
                {['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'].map(c => (
                  <button 
                    key={c} 
                    onClick={() => setColor(c)}
                    className={`w-10 h-10 rounded-xl border-4 transition-all hover:scale-110 active:scale-90 ${color === c ? 'border-indigo-400 scale-110 shadow-lg' : 'border-slate-50'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Size</span>
                    <input 
                    type="range" min="2" max="30" value={brushSize} 
                    onChange={(e) => setBrushSize(parseInt(e.target.value))}
                    className="w-32 accent-indigo-600"
                    />
                </div>
              </div>
            </div>
          )}

          {/* Overlays */}
          {room.status === RoomStatus.WAITING && (
            <div className="absolute inset-0 bg-indigo-900/40 backdrop-blur-md rounded-3xl flex items-center justify-center z-20">
              <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-sm w-full mx-4 border-4 border-white transform animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-users text-indigo-600 text-5xl"></i>
                </div>
                <h3 className="text-3xl font-game text-slate-800 mb-2">Game Lobby</h3>
                <p className="text-slate-500 mb-10 font-medium">Waiting for players... ({players.length}/8)</p>
                {room.hostId === user.uid ? (
                  <button onClick={startGame} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-game text-xl py-4 rounded-2xl shadow-xl transition-all active:scale-95">START MATCH</button>
                ) : (
                  <div className="text-indigo-600 font-game text-xl animate-pulse tracking-widest uppercase">Waiting for host</div>
                )}
              </div>
            </div>
          )}

          {isPickingWord && (
             <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-lg rounded-3xl flex items-center justify-center z-30">
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center max-w-md w-full border-4 border-indigo-500 transform animate-in zoom-in-90 duration-300">
                <h3 className="text-4xl font-game text-indigo-600 mb-2">Your Turn!</h3>
                <p className="text-slate-400 mb-8 font-bold uppercase tracking-widest text-xs">Pick a word to draw</p>
                <div className="flex flex-col gap-4">
                  {wordChoices.map(word => (
                    <button key={word} onClick={() => selectWord(word)} className="bg-slate-50 border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 px-8 py-5 rounded-3xl font-game text-2xl transition-all active:scale-95 shadow-sm">
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {room.status === RoomStatus.ENDED && (
            <div className="absolute inset-0 bg-emerald-600/90 backdrop-blur-xl rounded-3xl flex items-center justify-center z-40">
              <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center max-w-md w-full border-8 border-emerald-400/30 transform animate-in scale-110 duration-700">
                <div className="text-7xl mb-6">🏆</div>
                <h3 className="text-5xl font-game text-emerald-600 mb-2">Winner!</h3>
                <p className="text-2xl font-bold text-slate-700 mb-10">{room.winner}</p>
                <button onClick={onLeave} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-game text-xl py-4 rounded-2xl shadow-lg transition-all active:scale-95 uppercase tracking-widest">Back to Menu</button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Chat Area */}
        <div className="w-full md:w-80 flex flex-col h-full">
          <Chat 
            roomId={roomId} 
            user={user} 
            isDrawer={isDrawer} 
            currentWord={room.currentWord} 
            timer={room.timer} 
            status={room.status} 
          />
        </div>
      </div>
    </div>
  );
};

export default GameRoom;
