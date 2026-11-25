'use client';

import React from 'react';
import { Cormorant_Garamond } from 'next/font/google';
import { Volume2, VolumeX } from 'lucide-react';
import { TelemetrySnapshot, TwoHorizonsScene } from './BlackHoleCanvas';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '600'],
});

export function TelemetryHud({
  scene,
  telemetry,
  soundOn,
  onToggleSound,
  onSelectScene,
}: {
  scene: TwoHorizonsScene;
  telemetry: TelemetrySnapshot;
  soundOn: boolean;
  onToggleSound: () => void;
  onSelectScene: (next: TwoHorizonsScene) => void;
}) {
  const accentText = scene === 'aurum' ? 'text-amber-300' : 'text-violet-300';
  const accentBorder = scene === 'aurum' ? 'border-amber-300/60' : 'border-violet-300/60';
  const altNormalized = Math.min(100, Math.max(0, ((telemetry.altMeters - 1) / 9) * 100));

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none text-white/85">
      {/* Subtle Corner Crosshairs */}
      <div className="hidden sm:block absolute top-5 left-5 w-4 h-4 border-t border-l border-white/25" />
      <div className="hidden sm:block absolute top-5 right-5 w-4 h-4 border-t border-r border-white/25" />
      <div className="hidden sm:block absolute bottom-5 left-5 w-4 h-4 border-b border-l border-white/25" />
      <div className="hidden sm:block absolute bottom-5 right-5 w-4 h-4 border-b border-r border-white/25" />

      {/* Center Minimal Reticle */}
      <div className="hidden md:flex fixed inset-0 items-center justify-center opacity-20">
        <div className="relative w-12 h-12">
          <div className="absolute inset-x-0 top-1/2 h-px bg-white/60" />
          <div className="absolute inset-y-0 left-1/2 w-px bg-white/60" />
        </div>
      </div>

      {/* Top Left Title */}
      <div className="absolute top-4 left-4 sm:top-7 sm:left-8">
        <h2
          className={`${cormorant.className} text-base sm:text-2xl tracking-[0.28em] uppercase font-normal text-white/95`}
        >
          TWO HORIZONS
        </h2>
        <div className={`font-mono text-[10px] sm:text-[11px] tracking-[0.18em] mt-0.5 ${accentText}`}>
          {scene === 'aurum' ? 'HORIZON 01 // AURUM · GARGANTUA' : 'HORIZON 02 // VIOLA · EVENT FIELD'}
        </div>
      </div>

      {/* Top Right Sound Toggle & Timecode/FPS */}
      <div className="absolute top-4 right-4 sm:top-7 sm:right-8 flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] tracking-widest text-white/65">
          <span>TC {telemetry.timecode}</span>
          <span>{telemetry.fps} FPS</span>
        </div>
        <button
          type="button"
          onClick={onToggleSound}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/50 hover:bg-black/75 border border-white/20 backdrop-blur-sm font-mono text-[10px] sm:text-[11px] tracking-wider text-white transition"
        >
          {soundOn ? (
            <Volume2 className={`w-3.5 h-3.5 ${accentText}`} />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-white/60" />
          )}
          <span>SOUND: {soundOn ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Left Telemetry Column (hidden on <= 640px mobile so form stays clean) */}
      <div className="hidden sm:flex flex-col gap-1.5 absolute left-8 top-1/2 -translate-y-1/2 font-mono text-[11px] tracking-widest text-white/60">
        <div>
          ALT <span className="text-white/90">{telemetry.altMeters.toFixed(2)}m</span>
        </div>
        <div>
          TILT <span className="text-white/90">+{telemetry.tiltDeg.toFixed(1)}°</span>
        </div>
        <div>
          GRAV <span className={accentText}>1.004 G</span>
        </div>
      </div>

      {/* Right Vertical Altitude Ruler (hidden on <= 640px mobile) */}
      <div className="hidden sm:flex flex-col items-end gap-1 absolute right-8 top-1/2 -translate-y-1/2">
        <span className="font-mono text-[9px] tracking-widest text-white/50">10m</span>
        <div className="relative w-4 h-36 border-r border-white/25 flex flex-col justify-between py-1">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="w-2 h-px bg-white/30 self-end" />
          ))}
          <div
            className={`absolute right-0 w-3.5 h-0.5 transition-all duration-150 ${
              scene === 'aurum' ? 'bg-amber-400' : 'bg-violet-400'
            }`}
            style={{ bottom: `${altNormalized}%` }}
          />
        </div>
        <span className="font-mono text-[9px] tracking-widest text-white/50">1m</span>
      </div>

      {/* Bottom Center Scene Selector Tabs */}
      <div className="pointer-events-auto absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 bg-black/55 backdrop-blur-md border border-white/15 rounded-full p-1.5 shadow-xl">
        <button
          type="button"
          onClick={() => onSelectScene('aurum')}
          className={`px-3.5 sm:px-5 py-1.5 rounded-full font-mono text-xs tracking-wider transition ${
            scene === 'aurum'
              ? `bg-amber-500/25 text-amber-200 border ${accentBorder}`
              : 'text-white/65 hover:text-white'
          }`}
        >
          :: Aurum
        </button>
        <button
          type="button"
          onClick={() => onSelectScene('viola')}
          className={`px-3.5 sm:px-5 py-1.5 rounded-full font-mono text-xs tracking-wider transition ${
            scene === 'viola'
              ? `bg-violet-500/25 text-violet-200 border ${accentBorder}`
              : 'text-white/65 hover:text-white'
          }`}
        >
          :: Viola
        </button>
      </div>
    </div>
  );
}
