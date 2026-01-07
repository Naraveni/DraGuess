
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { db } from '../firebaseConfig';
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

  // Local drawing logic
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
    strokes.sort((a, b) => a.timestamp - b.timestamp).forEach(stroke => {
      drawLine(ctx, stroke);
    });

    if (currentStrokePoints.length > 1) {
      drawLine(ctx, { points: currentStrokePoints, color, width: brushSize });
    }
  }, [strokes, currentStrokePoints, color, brushSize, drawLine]);

  // Sync with Firestore
  useEffect(() => {
    const unsubscribe = db.collection(`rooms/${roomId}/strokes`).onSnapshot((snapshot: any) => {
      const remoteStrokes: Stroke[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      setStrokes(remoteStrokes);
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    redrawAll();
  }, [redrawAll]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawer) return;
    setIsDrawing(true);
    const pos = getPos(e);
    setCurrentStrokePoints([pos]);
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !isDrawer) return;
    const pos = getPos(e);
    setCurrentStrokePoints(prev => [...prev, pos]);
  };

  const handleMouseUp = async () => {
    if (!isDrawing || !isDrawer) return;
    setIsDrawing(false);
    
    if (currentStrokePoints.length > 1) {
      const newStroke: Omit<Stroke, 'id'> = {
        points: currentStrokePoints,
        color,
        width: brushSize,
        timestamp: Date.now()
      };
      await db.collection(`rooms/${roomId}/strokes`).add(newStroke);
    }
    setCurrentStrokePoints([]);
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const clearCanvas = async () => {
    if (!isDrawer) return;
    const snapshot = await db.collection(`rooms/${roomId}/strokes`).get();
    const batch = snapshot.docs.map((doc: any) => doc.id);
    // In actual firestore you'd use writeBatch
    for (const id of batch) {
       await db.collection(`rooms/${roomId}/strokes`).doc(id).delete();
    }
  };

  return (
    <div className="relative w-full aspect-video bg-white rounded-xl shadow-inner border-2 border-slate-200 overflow-hidden group">
      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        className={`w-full h-full block ${isDrawer ? 'canvas-cursor-brush' : 'cursor-default'}`}
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
          className="absolute bottom-4 right-4 bg-red-100 hover:bg-red-200 text-red-600 px-4 py-2 rounded-lg font-bold text-sm transition-all"
        >
          <i className="fas fa-trash-alt mr-2"></i> Clear
        </button>
      )}
    </div>
  );
};

export default Canvas;
