
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, collection, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Room, Player, RoomStatus } from '../types';
import { GoogleGenAI } from "@google/genai";
import Canvas from './Canvas';
import Chat from './Chat';
import Scoreboard from './Scoreboard';

interface GameRoomProps {
  roomId: string;
  user: any;
  onLeave: () => void;
}

const GameRoom: React.FC<GameRoomProps> = ({ roomId, user, onLeave }) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [isPickingWord, setIsPickingWord] = useState(false);
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [isGeneratingWords, setIsGeneratingWords] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);
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

  // Gemini AI: Generate Words
  const generateWordsWithAI = async () => {
    setIsGeneratingWords(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Generate a list of 3 distinct, fun-to-draw objects or concepts for a game like Pictionary. Return only the 3 words separated by commas.',
        config: { temperature: 0.9 }
      });
      const words = response.text.split(',').map(w => w.trim());
      setWordChoices(words.length === 3 ? words : ['Rocket', 'Pizza', 'Guitar']);
    } catch (error) {
      console.error("Gemini Error:", error);
      setWordChoices(['Dragon', 'Ice Cream', 'Bicycle']); // Fallback
    } finally {
      setIsGeneratingWords(false);
    }
  };

  // Gemini AI: Generate Hint
  const generateHint = async () => {
    if (!room?.currentWord) return;
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Give a one-sentence clever riddle or hint for the word "${room.currentWord}" without using the word itself or being too obvious.`,
      });
      setAiHint(response.text);
      // Auto-clear hint after 10 seconds
      setTimeout(() => setAiHint(null), 10000);
    } catch (error) {
      setAiHint("It's something you might find in a house!");
    }
  };

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
    setAiHint(null);
  };

  const endTurn = async () => {
    const currentIndex = players.findIndex(p => p.id === room?.drawerId);
    const isLastPlayer = currentIndex === players.length - 1;
    const isGameOver = room!.currentRound >= room!.maxRounds && isLastPlayer;
    
    if (isGameOver) {
      const winner = players[0];
      await updateDoc(doc(db, 'rooms', roomId), { status: RoomStatus.ENDED, winner: winner.name });
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
      generateWordsWithAI();
      setIsPickingWord(true);
    }
  }, [room?.drawerId, room?.currentWord, room?.status, user.uid]);

  const isDrawer = room?.drawerId === user.uid;
  if (!room) return null;

  return (
    <div className="h-full flex flex-col p-4 space-y-4 max-w-7xl mx-auto bg-slate-50">
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

        <div className="flex-1 flex justify-center flex-col items-center">
          <div className="bg-indigo-50 text-indigo-700 px-10 py-3 rounded-2xl font-game text-2xl tracking-[0.2em] shadow-inner border border-indigo-100 min-w-[300px] text-center">
            {isDrawer ? (
                room.currentWord?.toUpperCase() || "SELECT A WORD"
            ) : (
                room.currentWord ? room.currentWord.split('').map(c => c === ' ' ? ' ' : '_').join(' ') : "WAITING..."
            )}
          </div>
          {aiHint && (
            <div className="mt-2 text-xs font-bold text-indigo-500 animate-bounce">
              <i className="fas fa-lightbulb mr-1"></i> Hint: {aiHint}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className={`px-5 py-3 rounded-2xl font-game text-2xl flex items-center gap-3 transition-colors ${room.timer < 15 ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-600 text-white'}`}>
            <i className="fas fa-clock text-xl opacity-80"></i> {room.timer}s
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
        <div className="w-full md:w-72 flex flex-col h-full">
           <Scoreboard players={players} drawerId={room.drawerId} />
        </div>

        <div className="flex-1 flex flex-col gap-4 relative">
          <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden relative">
             <Canvas roomId={roomId} isDrawer={isDrawer && !!room.currentWord} color={color} brushSize={brushSize} />
          </div>
          
          {isDrawer && room.currentWord && (
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div className="flex gap-2">
                {['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'].map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-10 h-10 rounded-xl border-4 transition-all hover:scale-110 active:scale-90 ${color === c ? 'border-indigo-400 scale-110 shadow-lg' : 'border-slate-50'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <div className="flex items-center gap-6">
                <button onClick={generateHint} className="bg-amber-100 text-amber-600 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-amber-200 transition-colors">
                  <i className="fas fa-magic mr-1"></i> Send AI Hint
                </button>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Size</span>
                    <input type="range" min="2" max="30" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-24 accent-indigo-600" />
                </div>
              </div>
            </div>
          )}

          {room.status === RoomStatus.WAITING && (
            <div className="absolute inset-0 bg-indigo-900/40 backdrop-blur-md rounded-3xl flex items-center justify-center z-20">
              <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl text-center max-w-sm w-full mx-4 border-4 border-white">
                <div className="w-24 h-24 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                    <i className="fas fa-users text-indigo-600 text-5xl"></i>
                </div>
                <h3 className="text-3xl font-game text-slate-800 mb-2">Game Lobby</h3>
                <p className="text-slate-500 mb-10 font-medium">({players.length}/8 players)</p>
                {room.hostId === user.uid ? (
                  <button onClick={startGame} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-game text-xl py-4 rounded-2xl shadow-xl transition-all">START MATCH</button>
                ) : (
                  <div className="text-indigo-600 font-game text-xl animate-pulse tracking-widest uppercase">Waiting for host</div>
                )}
              </div>
            </div>
          )}

          {isPickingWord && (
             <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-lg rounded-3xl flex items-center justify-center z-30">
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl text-center max-w-md w-full border-4 border-indigo-500">
                <h3 className="text-4xl font-game text-indigo-600 mb-2">Your Turn!</h3>
                <p className="text-slate-400 mb-8 font-bold uppercase tracking-widest text-xs">AI is generating choices...</p>
                <div className="flex flex-col gap-4">
                  {isGeneratingWords ? (
                    <div className="py-10 text-indigo-600"><i className="fas fa-spinner fa-spin text-4xl"></i></div>
                  ) : (
                    wordChoices.map(word => (
                      <button key={word} onClick={() => selectWord(word)} className="bg-slate-50 border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 px-8 py-5 rounded-3xl font-game text-2xl transition-all">
                        {word}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {room.status === RoomStatus.ENDED && (
            <div className="absolute inset-0 bg-emerald-600/90 backdrop-blur-xl rounded-3xl flex items-center justify-center z-40">
              <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center max-w-md w-full border-8 border-emerald-400/30">
                <div className="text-7xl mb-6">🏆</div>
                <h3 className="text-5xl font-game text-emerald-600 mb-2">Winner!</h3>
                <p className="text-2xl font-bold text-slate-700 mb-10">{room.winner}</p>
                <button onClick={onLeave} className="w-full bg-slate-800 hover:bg-slate-900 text-white font-game text-xl py-4 rounded-2xl shadow-lg transition-all uppercase tracking-widest">Back to Menu</button>
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
