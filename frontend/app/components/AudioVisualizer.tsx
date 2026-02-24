"use client";

import { useEffect, useRef } from "react";

interface AudioVisualizerProps {
  stream: MediaStream | null;
}

const BAR_COUNT = 24;
const BAR_WIDTH = 2;
const BAR_GAP = 2;
const MIN_HEIGHT = 3;
const MAX_HEIGHT = 24;
const CANVAS_HEIGHT = 28;

export default function AudioVisualizer({ stream }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const barsRef = useRef<number[]>(new Array(BAR_COUNT).fill(MIN_HEIGHT));

  useEffect(() => {
    if (!stream) return;

    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;

    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const totalWidth = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP;
    canvas.width = totalWidth * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;
    ctx.scale(dpr, dpr);

    function draw() {
      animFrameRef.current = requestAnimationFrame(draw);
      if (!analyserRef.current || !ctx) return;

      analyserRef.current.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, totalWidth, CANVAS_HEIGHT);

      const step = Math.max(1, Math.floor(dataArray.length / BAR_COUNT));

      for (let i = 0; i < BAR_COUNT; i++) {
        // Mirror: bars grow from center outward
        const freqIndex = Math.abs(i - BAR_COUNT / 2) * step;
        const val = (dataArray[Math.min(freqIndex, dataArray.length - 1)] || 0) / 255;

        const target = MIN_HEIGHT + val * (MAX_HEIGHT - MIN_HEIGHT);
        // Smooth interpolation: fast rise, slower fall
        const current = barsRef.current[i];
        barsRef.current[i] = target > current
          ? current + (target - current) * 0.4
          : current + (target - current) * 0.15;

        const height = barsRef.current[i];
        const x = i * (BAR_WIDTH + BAR_GAP);
        const y = (CANVAS_HEIGHT - height) / 2;

        ctx.fillStyle = "#71717a"; // zinc-500
        ctx.beginPath();
        ctx.roundRect(x, y, BAR_WIDTH, height, 1);
        ctx.fill();
      }
    }

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      source.disconnect();
      audioCtx.close();
      analyserRef.current = null;
    };
  }, [stream]);

  const totalWidth = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP;

  return (
    <canvas
      ref={canvasRef}
      style={{ width: totalWidth, height: CANVAS_HEIGHT }}
      className="block"
    />
  );
}
