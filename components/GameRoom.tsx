
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, collection, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Room, Player, Message, RoomStatus } from '../types';
import Canvas from './Canvas';
import Chat from './Chat';
import Scoreboard from './Scoreboard';

interface GameRoomProps {
  roomId: string;
  user: any;
  onLeave: () => void;
}

const WORDS = ['Apple', 'Dog', 'Skyline', 'Pizza', 'Rocket', 'Guitar', 'Laptop', 'Elephant', 'Tree', 'Ocean', 'Sushi', 'Robot', 'Volcano', 'Parrot', 'Skateboard'];

const GameRoom: React.FC<GameRoomProps> = ({ roomId, user, onLeave }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [isPickingWord, setIsPickingWord] = useState(false);
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    const unsubRoom = onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (snap.exists()) setRoom({ id: snap.id, ...snap.data() } as Room);
      else onLeave();
    });

    const unsubPlayers = onSnapshot(collection(db, `rooms/${roomId}/players`), (snap) => {
      const p = snap.docs.map(d => d.data() as Player);
      const sorted = p.sort((a, b) => b.score - a.score);
      setPlayers(sorted);
      updateDoc(doc(db, 'rooms', roomId), { playerCount: sorted.length });
    });

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [roomId, onLeave]);

  useEffect(() => {
    if (!room || room.hostId !== user.uid) return;

    if (room.status === RoomStatus.PLAYING && room.timer > 0) {
      timerRef.current = setInterval(() => {
        updateDoc(doc(db, 'rooms', roomId), { timer: room.timer - 1 });
      }, 1000);
    } else if (room.status === RoomStatus.PLAYING && room.timer === 0) {
      endTurn();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
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
    const nextPlayerIndex = round ? 0 : (players.findIndex(p => p.id === room?.drawerId) + 1) % players.length;
    const nextDrawer = players[nextPlayerIndex];
    
    // Clear canvas strokes
    const strokesSnap = await getDocs(collection(db, `rooms/${roomId}/strokes`));
    const batch = writeBatch(db);
    strokesSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();

    // Reset player guess statuses
    for (const p of players) {
      await updateDoc(doc(db, `rooms/${roomId}/players`, p.id), { hasGuessed: false });
    }

    await updateDoc(doc(db, 'rooms', roomId), {
      status: RoomStatus.PLAYING,
      drawerId: nextDrawer.id,
      currentRound: round || room!.currentRound,
      timer: 80,
      currentWord: null
    });
  };

  const endTurn = async () => {
    const isLastPlayer = players.findIndex(p => p.id === room?.drawerId) === players.length - 1;
    const isGameOver = room!.currentRound >= room!.maxRounds && isLastPlayer;
    
    if (isGameOver) {
      await updateDoc(doc(db, 'rooms', roomId), { status: RoomStatus.ENDED });
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
    <div className="h-full flex flex-col p-4 space-y-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onLeave} className="text-slate-400 hover:text-red-500 transition-colors">
            <i className="fas fa-chevron-left text-xl"></i>
          </button>
          <div>
            <h2 className="font-game text-xl text-indigo-600">Round {room.currentRound}/{room.maxRounds}</h2>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">{room.id}</p>
          </div>
        </div>

        <div className="flex-1 flex justify-center">
          <div className="bg-slate-100 px-8 py-2 rounded-full font-game text-2xl tracking-widest">
            {isDrawer ? (
                room.currentWord?.toUpperCase() || "SELECT A WORD"
            ) : (
                room.currentWord ? room.currentWord.split('').map(c => c === ' ' ? ' ' : '_').join(' ') : "WAITING..."
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`px-4 py-2 rounded-xl font-game text-xl flex items-center gap-2 ${room.timer < 15 ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-indigo-100 text-indigo-600'}`}>
            <i className="fas fa-clock"></i> {room.timer}s
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
        <div className="w-full md:w-64">
           <Scoreboard players={players} drawerId={room.drawerId} />
        </div>

        <div className="flex-1 flex flex-col gap-4 relative">
          <div className="flex-1 min-h-[400px]">
             <Canvas 
               roomId={roomId} 
               isDrawer={isDrawer && !!room.currentWord} 
               color={color} 
               brushSize={brushSize} 
             />
          </div>
          
          {isDrawer && room.currentWord && (
            <div className="bg-white p-3 rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex gap-2">
                {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff'].map(c => (
                  <button 
                    key={c} 
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-indigo-500 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-4">
                <input 
                  type="range" min="2" max="20" value={brushSize} 
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  className="w-32 accent-indigo-500"
                />
              </div>
            </div>
          )}

          {room.status === RoomStatus.WAITING && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
              <div className="bg-white p-8 rounded-3xl shadow-2xl text-center max-w-sm w-full mx-4">
                <h3 className="text-2xl font-game text-slate-800 mb-2">Lobby</h3>
                <p className="text-slate-500 mb-8">{players.length}/8 players</p>
                {room.hostId === user.uid ? (
                  <button onClick={startGame} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg">Start</button>
                ) : (
                  <div className="text-indigo-600 font-bold animate-pulse">Waiting for host...</div>
                )}
              </div>
            </div>
          )}

          {isPickingWord && (
             <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-20">
              <div className="bg-white p-8 rounded-3xl shadow-2xl text-center">
                <h3 className="text-3xl font-game text-indigo-600 mb-6">Pick a Word!</h3>
                <div className="flex flex-col gap-3">
                  {wordChoices.map(word => (
                    <button key={word} onClick={() => selectWord(word)} className="bg-slate-100 hover:bg-indigo-500 hover:text-white px-8 py-4 rounded-2xl font-bold text-xl transition-all">
                      {word}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full md:w-80 flex flex-col gap-2 overflow-hidden">
          <Chat roomId={roomId} user={user} isDrawer={isDrawer} currentWord={room.currentWord} timer={room.timer} status={room.status} />
        </div>
      </div>
    </div>
  );
};

export default GameRoom;
