
export enum RoomStatus {
  WAITING = 'waiting',
  STARTING = 'starting',
  PLAYING = 'playing',
  ENDED = 'ended'
}

export enum RoomVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private'
}

export interface Point {
  x: number;
  y: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  timestamp: number;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  hasGuessed: boolean;
  isHost: boolean;
  avatar: string;
  joinedAt: number;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  isCorrect: boolean;
  timestamp: number;
}

export interface Room {
  id: string;
  status: RoomStatus;
  visibility: RoomVisibility;
  currentRound: number;
  maxRounds: number;
  drawerId: string | null;
  currentWord: string | null;
  timer: number;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  lastActiveAt: number;
  winner?: string;
}
