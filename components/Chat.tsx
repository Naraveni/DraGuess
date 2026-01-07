
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, addDoc, doc, updateDoc, getDoc, query, orderBy } from 'firebase/firestore';
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
    const q = query(collection(db, `rooms/${roomId}/messages`), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });

    const unsubPlayer = onSnapshot(doc(db, `rooms/${roomId}/players`, user.uid), (snap) => {
        if (snap.exists()) setHasGuessedCorrectly(snap.data().hasGuessed);
    });

    return () => { unsub(); unsubPlayer(); };
  }, [roomId, user.uid]);

  useEffect(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== RoomStatus.PLAYING) return;

    const text = input.trim().toLowerCase();
    const isCorrect = text === currentWord && !isDrawer && !hasGuessedCorrectly;
    
    if (isCorrect) {
      const scoreGain = Math.floor((timer / 80) * 500) + 100;
      const playerRef = doc(db, `rooms/${roomId}/players`, user.uid);
      const playerSnap = await getDoc(playerRef);
      await updateDoc(playerRef, {
        score: (playerSnap.data()?.score || 0) + scoreGain,
        hasGuessed: true
      });

      const roomSnap = await getDoc(doc(db, 'rooms', roomId));
      const drawerId = roomSnap.data()?.drawerId;
      if (drawerId) {
          const dRef = doc(db, `rooms/${roomId}/players`, drawerId);
          const dSnap = await getDoc(dRef);
          await updateDoc(dRef, { score: (dSnap.data()?.score || 0) + 50 });
      }
    }

    await addDoc(collection(db, `rooms/${roomId}/messages`), {
      senderId: user.uid,
      senderName: user.displayName || 'Guest',
      text: isCorrect ? 'Guessed correctly!' : input.trim(),
      isCorrect,
      timestamp: Date.now()
    });
    setInput('');
  };

  return (
    <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-3 border-b bg-slate-50 font-bold text-slate-500 text-sm uppercase tracking-wider">Chat</div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={`text-sm ${m.isCorrect ? 'text-emerald-600 font-bold' : 'text-slate-700'}`}>
            <span className="font-bold opacity-70">{m.senderName}: </span>
            <span>{m.isCorrect ? 'guessed the word!' : m.text}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={sendMessage} className="p-3 bg-slate-50">
        <input
          type="text" value={input} onChange={(e) => setInput(e.target.value)}
          disabled={isDrawer || hasGuessedCorrectly || status !== RoomStatus.PLAYING}
          className="w-full px-4 py-2 rounded-xl border-2 border-slate-200 outline-none disabled:bg-slate-100"
          placeholder={isDrawer ? "Drawing..." : "Type guess..."}
        />
      </form>
    </div>
  );
};

export default Chat;
