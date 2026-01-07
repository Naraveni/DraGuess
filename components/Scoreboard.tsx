
import React from 'react';
import { Player } from '../types';

interface ScoreboardProps {
  players: Player[];
  drawerId: string | null;
}

const Scoreboard: React.FC<ScoreboardProps> = ({ players, drawerId }) => {
  return (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-[200px] md:max-h-none">
      {players.map((p, index) => (
        <div 
          key={p.id} 
          className={`flex items-center gap-3 p-3 rounded-2xl transition-all shadow-sm ${p.hasGuessed ? 'bg-emerald-50 border-emerald-200 border' : 'bg-white'}`}
        >
          <div className="relative">
            <img 
              src={p.avatar} 
              className="w-10 h-10 rounded-full border-2 border-white shadow-sm" 
              alt={p.name} 
            />
            {p.id === drawerId && (
              <div className="absolute -top-1 -right-1 bg-amber-400 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-sm">
                <i className="fas fa-pencil-alt"></i>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-bold truncate ${p.hasGuessed ? 'text-emerald-700' : 'text-slate-700'}`}>
              {p.name} {p.isHost && <span className="text-[10px] bg-indigo-100 text-indigo-500 px-1.5 py-0.5 rounded-md ml-1">HOST</span>}
            </h4>
            <p className="text-xs text-slate-400 font-bold">{p.score} points</p>
          </div>

          {p.hasGuessed && (
            <div className="text-emerald-500 animate-pulse">
              <i className="fas fa-check-circle"></i>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default Scoreboard;
