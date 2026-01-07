
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { Message, RoomStatus } from '../types';

interface ChatProps {
  roomId: string;
  user: any;
  isDrawer: boolean;
  currentWord: string | null;
  timer: number;
  status: RoomStatus;
}

const Chat: React.FC<ChatProps> = ({ roomId, user, isDrawer, currentWord, timer, status }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [hasGuessedCorrectly, setHasGuessedCorrectly] = useState(false);

  useEffect(() => {
    const unsub = db.collection(`rooms/${roomId}/messages`).onSnapshot((snap: any) => {
      setMessages(snap.docs.map((d: any) => d.data() as Message).sort((a, b) => a.timestamp - b.timestamp));
    });

    const unsubPlayer = db.collection(`rooms/${roomId}/players`).doc(user.uid).onSnapshot((doc: any) => {
        if (doc) setHasGuessedCorrectly(doc.hasGuessed);
    });

    return () => { unsub(); unsubPlayer(); };
  }, [roomId, user.uid]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== RoomStatus.PLAYING) return;

    const text = input.trim().toLowerCase();
    const isCorrect = text === currentWord && !isDrawer && !hasGuessedCorrectly;
    
    // Create message object
    const newMessage: Omit<Message, 'id'> = {
      senderId: user.uid,
      senderName: user.displayName || 'Guest',
      text: isCorrect ? 'Guessed correctly!' : input.trim(),
      isCorrect,
      timestamp: Date.now()
    };

    // If correct, update score
    if (isCorrect) {
      const scoreGain = Math.floor((timer / 80) * 500) + 100;
      const playerDoc = await db.collection(`rooms/${roomId}/players`).doc(user.uid).get();
      const currentScore = playerDoc.data()?.score || 0;
      await db.collection(`rooms/${roomId}/players`).doc(user.uid).update({
        score: currentScore + scoreGain,
        hasGuessed: true
      });

      // Bonus for drawer
      const roomDoc = await db.collection('rooms').doc(roomId).get();
      const drawerId = roomDoc.data()?.drawerId;
      if (drawerId) {
          const drawerDoc = await db.collection(`rooms/${roomId}/players`).doc(drawerId).get();
          await db.collection(`rooms/${roomId}/players`).doc(drawerId).update({
              score: (drawerDoc.data()?.score || 0) + 50
          });
      }
    }

    await db.collection(`rooms/${roomId}/messages`).add(newMessage);
    setInput('');
  };

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-3 border-b bg-slate-50 font-bold text-slate-500 text-sm uppercase tracking-wider">
        Chat & Guesses
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-hide">
        {messages.map((m) => (
          <div key={m.timestamp} className={`text-sm ${m.isCorrect ? 'text-emerald-600 font-bold animate-bounce' : 'text-slate-700'}`}>
            <span className="font-bold opacity-70">{m.senderName}: </span>
            <span>{m.isCorrect ? 'guessed the word!' : m.text}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={sendMessage} className="p-3 bg-slate-50">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isDrawer || hasGuessedCorrectly || status !== RoomStatus.PLAYING}
          className="w-full px-4 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 outline-none transition-all disabled:opacity-50 disabled:bg-slate-100"
          placeholder={isDrawer ? "You are drawing!" : hasGuessedCorrectly ? "Correct!" : "Type your guess..."}
        />
      </form>
    </div>
  );
};

export default Chat;
