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
  const currentStrokeIdRef = useRef<string | null>(null);

  // Helper to draw a single line segment
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

  // Sync with Firestore
  useEffect(() => {
    const q = query(collection(db, `rooms/${roomId}/strokes`), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const remoteStrokes: Stroke[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stroke));
      setStrokes(remoteStrokes);
    });
    return () => unsubscribe();
  }, [roomId]);

  // Redraw whenever strokes change
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
    
    // Scale points if canvas internal dimensions differ from CSS dimensions
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return { 
      x: (clientX - rect.left) * scaleX, 
      y: (clientY - rect.top) * scaleY 
    };
  };

  const handleMouseDown = (e: any) => {
    if (!isDrawer) return;
    const pos = getPos(e);
    setIsDrawing(true);
    lastPointRef.current = pos;
    currentStrokeIdRef.current = Math.random().toString(36).substring(7);
  };

  const handleMouseMove = async (e: any) => {
    if (!isDrawing || !isDrawer || !lastPointRef.current) return;
    
    const currentPoint = getPos(e);
    const dist = Math.hypot(currentPoint.x - lastPointRef.current.x, currentPoint.y - lastPointRef.current.y);
    
    // Only record points if they've moved enough to matter (optimization)
    if (dist > 2) {
      const prevPoint = lastPointRef.current;
      lastPointRef.current = currentPoint;

      // Real-time sync: Add the new point to Firestore immediately
      // To keep it simple and performant, we create a small stroke for every segment
      // In a production app, we might update a single document's points array, but that can hit size limits.
      await addDoc(collection(db, `rooms/${roomId}/strokes`), {
        points: [prevPoint, currentPoint],
        color,
        width: brushSize,
        timestamp: Date.now()
      });
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    lastPointRef.current = null;
    currentStrokeIdRef.current = null;
  };

  const clearCanvas = async () => {
    if (!isDrawer) return;
    try {
      const snap = await getDocs(collection(db, `rooms/${roomId}/strokes`));
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.error("Failed to clear canvas:", err);
    }
  };

  return (
    <div className="relative w-full h-full bg-white rounded-xl overflow-hidden">
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
          className="absolute bottom-6 right-6 bg-red-500 hover:bg-red-600 text-white w-12 h-12 rounded-2xl shadow-lg transition-all flex items-center justify-center group"
          title="Clear Canvas"
        >
          <i className="fas fa-trash-alt group-hover:rotate-12 transition-transform"></i>
        </button>
      )}
    </div>
  );
};

export default Canvas;