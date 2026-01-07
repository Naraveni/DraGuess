
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, onSnapshot, addDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
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
  const [currentStrokePoints, setCurrentStrokePoints] = useState<Point[]>([]);

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke | { points: Point[], color: string, width: number }) => {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
  }, []);

  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    [...strokes].sort((a, b) => a.timestamp - b.timestamp).forEach(stroke => drawLine(ctx, stroke));
    if (currentStrokePoints.length > 1) drawLine(ctx, { points: currentStrokePoints, color, width: brushSize });
  }, [strokes, currentStrokePoints, color, brushSize, drawLine]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, `rooms/${roomId}/strokes`), (snap) => {
      const remoteStrokes: Stroke[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Stroke));
      setStrokes(remoteStrokes);
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => redrawAll(), [redrawAll]);

  const handleMouseDown = (e: any) => {
    if (!isDrawer) return;
    setIsDrawing(true);
    setCurrentStrokePoints([getPos(e)]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing || !isDrawer) return;
    setCurrentStrokePoints(prev => [...prev, getPos(e)]);
  };

  const handleMouseUp = async () => {
    if (!isDrawing || !isDrawer) return;
    setIsDrawing(false);
    if (currentStrokePoints.length > 1) {
      await addDoc(collection(db, `rooms/${roomId}/strokes`), {
        points: currentStrokePoints,
        color,
        width: brushSize,
        timestamp: Date.now()
      });
    }
    setCurrentStrokePoints([]);
  };

  const getPos = (e: any): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const clearCanvas = async () => {
    if (!isDrawer) return;
    const snap = await getDocs(collection(db, `rooms/${roomId}/strokes`));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  };

  return (
    <div className="relative w-full aspect-video bg-white rounded-xl shadow-inner border-2 border-slate-200 overflow-hidden">
      <canvas
        ref={canvasRef} width={800} height={450}
        className={`w-full h-full block ${isDrawer ? 'canvas-cursor-brush' : 'cursor-default'}`}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown} onTouchMove={handleMouseMove} onTouchEnd={handleMouseUp}
      />
      {isDrawer && (
        <button onClick={clearCanvas} className="absolute bottom-4 right-4 bg-red-100 text-red-600 px-4 py-2 rounded-lg font-bold text-sm">Clear</button>
      )}
    </div>
  );
};

export default Canvas;
