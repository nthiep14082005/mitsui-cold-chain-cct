'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AmbientAudioEngine } from './AmbientAudioEngine';
import { BlackHoleCanvas, TelemetrySnapshot, TwoHorizonsScene } from './BlackHoleCanvas';
import { TelemetryHud } from './TelemetryHud';

export function TwoHorizonsBackground({
  defaultScene = 'aurum',
  children,
}: {
  defaultScene?: TwoHorizonsScene;
  children: React.ReactNode;
}) {
  const [scene, setScene] = useState<TwoHorizonsScene>(defaultScene);
  const [flashActive, setFlashActive] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    altMeters: defaultScene === 'viola' ? 1.0 : 2.4,
    tiltDeg: defaultScene === 'aurum' ? 12.6 : 18.4,
    fps: 60,
    timecode: '00:00:00:00',
  });

  const audioRef = useRef<AmbientAudioEngine | null>(null);

  useEffect(() => {
    audioRef.current = new AmbientAudioEngine();
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  const handleSelectScene = useCallback(
    (next: TwoHorizonsScene) => {
      if (next === scene) return;
      audioRef.current?.playSwitchSound();
      setFlashActive(true);
      setTimeout(() => {
        setScene(next);
      }, 70);
      setTimeout(() => {
        setFlashActive(false);
      }, 170);
    },
    [scene]
  );

  const handleToggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      audioRef.current?.playSwitchSound();
      audioRef.current?.setAmbientEnabled(next);
      return next;
    });
  }, []);

  const handleTelemetry = useCallback((snap: TelemetrySnapshot) => {
    setTelemetry(snap);
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-black">
      {/* Layer 0: WebGL Black Hole & Foreground Silhouette Canvas */}
      <BlackHoleCanvas scene={scene} onTelemetry={handleTelemetry} />

      {/* ~150ms Cinematic Black Transition Flash */}
      <div
        className={`fixed inset-0 z-15 bg-black pointer-events-none transition-opacity duration-150 ${
          flashActive ? 'opacity-90' : 'opacity-0'
        }`}
      />

      {/* Layer 10: Sci-Fi HUD & Scene Tabs */}
      <TelemetryHud
        scene={scene}
        telemetry={telemetry}
        soundOn={soundOn}
        onToggleSound={handleToggleSound}
        onSelectScene={handleSelectScene}
      />

      {/* Layer 20: Glassmorphism Auth Card Slot */}
      <div className="relative z-20 min-h-screen flex items-center justify-center px-4 pt-20 pb-24">
        {children}
      </div>
    </div>
  );
}
