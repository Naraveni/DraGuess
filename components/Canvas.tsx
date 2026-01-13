import React, { useRef, useEffect, useState, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, addDoc, getDocs, writeBatch, query, orderBy } from 'firebase/firestore';
import { Stroke, Point } from '../types';

interface CanvasProps {
  roomId: string;
  isDrawer: boolean;
  color: string;
  brushSize: number;
}

const Canvas: React.FC<CanvasProps> = ({ roomId, isDrawer, color, brushSize }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const lastPointRef = useRef<Point | null>(null);
  const currentPathRef = useRef<Point[]>([]);

  const drawSegment = useCallback((ctx: CanvasRenderingContext2D, start: Point, end: Point, strokeColor: string, width: number) => {
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }, []);

  useEffect(() => {
    const q = query(collection(db, `rooms/${roomId}/strokes`), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const remoteStrokes: Stroke[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stroke));
      setStrokes(remoteStrokes);
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(stroke => {
      if (stroke.points.length < 2) return;
      for (let i = 1; i < stroke.points.length; i++) {
        drawSegment(ctx, stroke.points[i - 1], stroke.points[i], stroke.color, stroke.width);
      }
    });
  }, [strokes, drawSegment]);

  const getPos = (e: any): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const handleMouseDown = (e: any) => {
    if (!isDrawer) return;
    const pos = getPos(e);
    setIsDrawing(true);
    lastPointRef.current = pos;
    currentPathRef.current = [pos];
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !isDrawer || !lastPointRef.current) return;
    const currentPoint = getPos(e);
    const dist = Math.hypot(currentPoint.x - lastPointRef.current.x, currentPoint.y - lastPointRef.current.y);

    if (dist > 3) {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawSegment(ctx, lastPointRef.current, currentPoint, color, brushSize);
      
      currentPathRef.current.push(currentPoint);
      lastPointRef.current = currentPoint;

      // Realtime Sync Strategy: 
      // Instead of every single move (which lags Firestore), 
      // we could push in chunks if path length > 10. 
      // For this demo, we'll sync on MouseUp for maximum stability, 
      // or short bursts for "realtime" feel.
      if (currentPathRef.current.length > 15) {
          syncPath();
      }
    }
  };

  const syncPath = async () => {
    if (currentPathRef.current.length < 2) return;
    const pointsToSync = [...currentPathRef.current];
    // Keep the last point to continue the line in the next batch
    currentPathRef.current = [pointsToSync[pointsToSync.length - 1]];
    
    await addDoc(collection(db, `rooms/${roomId}/strokes`), {
      points: pointsToSync,
      color,
      width: brushSize,
      timestamp: Date.now()
    });
  };

  const handleMouseUp = async () => {
    if (!isDrawing || !isDrawer) return;
    setIsDrawing(false);
    await syncPath();
    lastPointRef.current = null;
    currentPathRef.current = [];
  };

  const clearCanvas = async () => {
    if (!isDrawer) return;
    const snap = await getDocs(collection(db, `rooms/${roomId}/strokes`));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  };

  return (
    <div className="relative w-full h-full bg-white rounded-3xl overflow-hidden shadow-inner border-4 border-slate-50">
      <canvas
        ref={canvasRef}
        width={1200}
        height={800}
        className={`w-full h-full block ${isDrawer ? 'canvas-cursor-brush' : 'cursor-default'} touch-none`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      />
      {isDrawer && (
        <button 
          onClick={clearCanvas} 
          className="absolute bottom-6 right-6 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 w-12 h-12 rounded-2xl transition-all flex items-center justify-center border-2 border-slate-200"
          title="Clear Canvas"
        >
          <i className="fas fa-trash-alt"></i>
        </button>
      )}
    </div>
  );
};

export default Canvas;