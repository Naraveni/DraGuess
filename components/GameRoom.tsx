
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, collection, updateDoc, getDocs, writeBatch, query, limit } from 'firebase/firestore';
import { Room, Player, RoomStatus } from '../types';
import Canvas from './Canvas';
import Chat from './Chat';
import Scoreboard from './Scoreboard';
import { GoogleGenAI } from "@google/genai";

interface GameRoomProps {
  roomId: string;
  user: any;
  onLeave: () => void;
}

const FALLBACK_WORDS = [
  'Apple', 'Banana', 'Car', 'Dog', 'Elephant', 'Flower', 'Guitar', 'House', 
  'Ice Cream', 'Jellyfish', 'Kangaroo', 'Lamp', 'Mountain', 'Notebook', 
  'Ocean', 'Pizza', 'Queen', 'Rocket', 'Sun', 'Tree', 'Umbrella', 'Volcano', 
  'Whale', 'Xylophone', 'Yo-yo', 'Zebra', 'Robot', 'Dragon', 'Pirate', 'Castle'
];

const GameRoom: React.FC<GameRoomProps> = ({ roomId, user, onLeave }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [isPickingWord, setIsPickingWord] = useState(false);
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [isLoadingWords, setIsLoadingWords] = useState(false);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!roomId) return;
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

  // Fetch unique drawing words using Gemini
  const fetchWords = async () => {
    setIsLoadingWords(true);
    try {
      // Initialize Gemini directly before use with process.env.API_KEY
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Generate 3 unique, simple common nouns for a drawing game. Simple to draw. Comma separated list.',
      });
      // Access text directly from the response object
      const text = response.text;
      const words = text?.split(',').map(w => w.trim()) || [];
      if (words.length >= 3) {
        setWordChoices(words.slice(0, 3));
        setIsLoadingWords(false);
        return;
      }
      throw new Error("Invalid response format");
    } catch (error) {
      console.warn("Gemini word fetch failed, using fallbacks.", error);
      const shuffled = [...FALLBACK_WORDS].sort(() => 0.5 - Math.random());
      setWordChoices(shuffled.slice(0, 3));
    } finally {
      setIsLoadingWords(false);
    }
  };

  useEffect(() => {
    if (!room || room.hostId !== user?.uid) return;

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
  }, [room?.status, room?.timer, room?.hostId, user?.uid, roomId]);

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
    
    const strokesSnap = await getDocs(collection(db, `rooms/${roomId}/strokes`));
    const batch = writeBatch(db);
    strokesSnap.docs.forEach(d => batch.delete(d.ref));
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
      const sorted = [...players].sort((a,b) => b.score - a.score);
      await updateDoc(doc(db, 'rooms', roomId), { status: RoomStatus.ENDED, winner: sorted[0].name });
    } else {
      nextTurn(isLastPlayer ? (room!.currentRound + 1) : undefined);
    }
  };

  const selectWord = async (word: string) => {
    await updateDoc(doc(db, 'rooms', roomId), { currentWord: word.toLowerCase() });
    setIsPickingWord(false);
  };

  useEffect(() => {
    if (room?.drawerId === user?.uid && !room.currentWord && room.status === RoomStatus.PLAYING) {
      fetchWords();
      setIsPickingWord(true);
    }
  }, [room?.drawerId, room?.currentWord, room?.status, user?.uid]);

  const isDrawer = room?.drawerId === user?.uid;
  if (!room) return null;

  return (
    <div className="h-full flex flex-col p-4 space-y-4 max-w-7xl mx-auto">
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <button onClick={onLeave} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:text-red-500 transition-all">
            <i className="fas fa-chevron-left"></i>
          </button>
          <div>
            <h2 className="font-game text-xl text-indigo-600">Round {room.currentRound}/{room.maxRounds}</h2>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Lobby: {room.id.slice(0, 6)}</p>
          </div>
        </div>

        <div className="flex-1 flex justify-center items-center">
          <div className="bg-indigo-50 text-indigo-700 px-8 py-2 rounded-2xl font-game text-xl tracking-widest border border-indigo-100">
            {isDrawer ? (
                room.currentWord?.toUpperCase() || "SELECT A WORD"
            ) : (
                room.currentWord ? room.currentWord.split('').map(c => c === ' ' ? ' ' : '_').join(' ') : "WAITING..."
            )}
          </div>
        </div>

        <div className={`px-5 py-3 rounded-2xl font-game text-2xl flex items-center gap-3 transition-colors ${room.timer < 15 ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-600 text-white'}`}>
           {room.timer}s
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        <div className="w-full md:w-72 flex flex-col h-full overflow-y-auto">
           <Scoreboard players={players} drawerId={room.drawerId} />
        </div>

        <div className="flex-1 flex flex-col gap-4 relative min-h-[400px]">
          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
             <Canvas roomId={roomId} isDrawer={isDrawer && !!room.currentWord} color={color} brushSize={brushSize} />
          </div>
          
          {isDrawer && room.currentWord && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div className="flex gap-2">
                {['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'].map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-8 h-8 rounded-lg border-2 transition-all ${color === c ? 'border-indigo-600 scale-110 shadow-md' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Size</span>
                <input type="range" min="2" max="30" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-24 accent-indigo-600" />
              </div>
            </div>
          )}

          {room.status === RoomStatus.WAITING && (
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm rounded-3xl flex items-center justify-center z-20">
              <div className="bg-white p-8 rounded-[2rem] shadow-2xl text-center max-w-sm w-full mx-4">
                <h3 className="text-2xl font-game text-slate-800 mb-2">Waiting for Players</h3>
                <p className="text-slate-500 mb-6 font-medium">Invite friends using the ID above</p>
                {room.hostId === user?.uid ? (
                  <button onClick={startGame} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-game py-3 rounded-xl shadow-lg transition-all">START GAME</button>
                ) : (
                  <div className="text-indigo-600 font-game animate-pulse">Host starting soon...</div>
                )}
              </div>
            </div>
          )}

          {isPickingWord && (
             <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-md rounded-3xl flex items-center justify-center z-30">
              <div className="bg-white p-8 rounded-[2rem] shadow-2xl text-center max-w-md w-full">
                <h3 className="text-3xl font-game text-indigo-600 mb-6">Choose a Word</h3>
                <div className="flex flex-col gap-3">
                  {isLoadingWords ? (
                    <div className="py-10 text-indigo-600"><i className="fas fa-spinner fa-spin text-3xl"></i></div>
                  ) : (
                    wordChoices.map(word => (
                      <button key={word} onClick={() => selectWord(word)} className="bg-slate-50 border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 px-6 py-4 rounded-2xl font-game text-xl transition-all">
                        {word}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="w-full md:w-80 flex flex-col h-full">
          <Chat roomId={roomId} user={user} isDrawer={isDrawer} currentWord={room.currentWord} timer={room.timer} status={room.status} />
        </div>
      </div>
    </div>
  );
};

export default GameRoom;
