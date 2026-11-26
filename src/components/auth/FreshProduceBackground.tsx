'use client';

import React, { useEffect, useRef } from 'react';

export type ProduceSceneVariant = 'customer' | 'admin';

interface DewParticle {
  x: number;
  y: number;
  r: number;
  vy: number;
  vx: number;
  alpha: number;
  phase: number;
  kind: 'dew' | 'pollen' | 'glint';
}

interface PaletteConfig {
  skyGradient: string;
  sunGlow: string;
  sunCore: string;
  rayColor: string;
  farHill: string;
  midHill: string;
  terraceBack: string;
  terraceMid: string;
  terraceFront: string;
  leafDark: string;
  leafMid: string;
  leafLight: string;
  leafHighlight: string;
  mistColor: string;
}

const PALETTES: Record<ProduceSceneVariant, PaletteConfig> = {
  customer: {
    skyGradient:
      'linear-gradient(165deg, #f0fdf4 0%, #dcfce7 24%, #bbf7d0 52%, #6ee7b7 78%, #10b981 100%)',
    sunGlow:
      'radial-gradient(circle at 82% 14%, rgba(254, 249, 195, 0.92) 0%, rgba(253, 230, 138, 0.45) 22%, rgba(167, 243, 208, 0.12) 52%, transparent 74%)',
    sunCore: 'rgba(255, 251, 235, 0.85)',
    rayColor: 'rgba(254, 249, 195, 0.28)',
    farHill: '#86efac',
    midHill: '#4ade80',
    terraceBack: '#22c55e',
    terraceMid: '#16a34a',
    terraceFront: '#15803d',
    leafDark: '#166534',
    leafMid: '#16a34a',
    leafLight: '#4ade80',
    leafHighlight: '#bef264',
    mistColor: 'rgba(236, 253, 245, 0.55)',
  },
  admin: {
    skyGradient:
      'linear-gradient(165deg, #ecfdf5 0%, #a7f3d0 22%, #6ee7b7 48%, #10b981 74%, #065f46 100%)',
    sunGlow:
      'radial-gradient(circle at 18% 14%, rgba(254, 243, 199, 0.78) 0%, rgba(167, 243, 208, 0.35) 26%, rgba(16, 185, 129, 0.1) 54%, transparent 75%)',
    sunCore: 'rgba(254, 249, 195, 0.72)',
    rayColor: 'rgba(236, 253, 245, 0.22)',
    farHill: '#6ee7b7',
    midHill: '#34d399',
    terraceBack: '#10b981',
    terraceMid: '#059669',
    terraceFront: '#047857',
    leafDark: '#064e3b',
    leafMid: '#047857',
    leafLight: '#10b981',
    leafHighlight: '#a3e635',
    mistColor: 'rgba(209, 250, 229, 0.42)',
  },
};

/**
 * Multi-layered fresh green produce & morning dew nature background.
 * Pure code-rendered (Canvas + layered SVG + CSS animations), pointer-events-none,
 * with DPR optimization for smooth mobile & desktop performance.
 */
export function FreshProduceBackground({
  variant = 'customer',
  children,
}: {
  variant?: ProduceSceneVariant;
  children: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const palette = PALETTES[variant];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let animId = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const isMobile = () => width < 640;

    const createParticles = (): DewParticle[] => {
      const count = isMobile() ? 28 : 54;
      const items: DewParticle[] = [];
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        const kind: DewParticle['kind'] =
          roll < 0.5 ? 'dew' : roll < 0.82 ? 'pollen' : 'glint';
        items.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r:
            kind === 'dew'
              ? 1.8 + Math.random() * 3.2
              : kind === 'glint'
                ? 2.2 + Math.random() * 3.6
                : 1.0 + Math.random() * 1.8,
          vy: -(0.12 + Math.random() * 0.28),
          vx: (Math.random() - 0.5) * 0.22,
          alpha: 0.25 + Math.random() * 0.55,
          phase: Math.random() * Math.PI * 2,
          kind,
        });
      }
      return items;
    };

    let particles = createParticles();

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      // Cap DPR at 1.5 on small screens and 2 on desktop for crispness + 60fps
      dpr = Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = createParticles();
    };

    resize();
    window.addEventListener('resize', resize);

    let lastTime = performance.now();

    const drawFrame = (now: number) => {
      const dt = Math.min((now - lastTime) / 16.67, 2.5);
      lastTime = now;
      const t = now * 0.001;

      ctx.clearRect(0, 0, width, height);

      for (const p of particles) {
        if (!prefersReducedMotion) {
          p.y += p.vy * dt;
          p.x += (p.vx + Math.sin(t * 0.9 + p.phase) * 0.14) * dt;

          if (p.y < -12) {
            p.y = height + 12;
            p.x = Math.random() * width;
          }
          if (p.x < -12) p.x = width + 12;
          if (p.x > width + 12) p.x = -12;
        }

        const pulse = 0.65 + 0.35 * Math.sin(t * 2.1 + p.phase);
        const alpha = p.alpha * pulse;

        if (p.kind === 'dew') {
          // Luminous morning dew droplet
          const grad = ctx.createRadialGradient(
            p.x - p.r * 0.3,
            p.y - p.r * 0.3,
            0.2,
            p.x,
            p.y,
            p.r * 2.1
          );
          grad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(alpha * 1.2, 0.95)})`);
          grad.addColorStop(0.45, `rgba(209, 250, 229, ${alpha * 0.75})`);
          grad.addColorStop(1, 'rgba(110, 231, 183, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 2.1, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'glint') {
          // Soft sun-kissed sparkle
          const size = p.r * (0.9 + 0.3 * pulse);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.fillStyle = `rgba(254, 249, 195, ${alpha * 0.75})`;
          ctx.beginPath();
          ctx.arc(0, 0, size * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.65})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(-size * 1.5, 0);
          ctx.lineTo(size * 1.5, 0);
          ctx.moveTo(0, -size * 1.5);
          ctx.lineTo(0, size * 1.5);
          ctx.stroke();
          ctx.restore();
        } else {
          // Gentle botanical pollen / fresh mist mote
          ctx.fillStyle = `rgba(236, 253, 245, ${alpha * 0.65})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!prefersReducedMotion) {
        animId = requestAnimationFrame(drawFrame);
      }
    };

    animId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [variant]);

  const sunOnRight = variant === 'customer';

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      {/* Fixed Nature Backdrop (Layer 0, pointer-events-none) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none"
        style={{ background: palette.skyGradient }}
      >
        {/* Warm Morning Sunlight Halo */}
        <div
          className="absolute inset-0"
          style={{ background: palette.sunGlow }}
        />

        {/* Diagonal Sunbeams Through Canopy */}
        <div
          className={`absolute -top-24 ${sunOnRight ? '-right-16 rotate-[24deg]' : '-left-16 -rotate-[24deg]'} w-[520px] h-[130%] opacity-60 animate-produce-ray`}
          style={{
            background: `linear-gradient(180deg, ${palette.rayColor} 0%, rgba(255,255,255,0.06) 55%, transparent 90%)`,
            filter: 'blur(18px)',
          }}
        />
        <div
          className={`hidden sm:block absolute -top-32 ${sunOnRight ? 'right-24 rotate-[34deg]' : 'left-24 -rotate-[34deg]'} w-[300px] h-[125%] opacity-45 animate-produce-ray-slow`}
          style={{
            background: `linear-gradient(180deg, ${palette.rayColor} 0%, rgba(255,255,255,0.04) 50%, transparent 85%)`,
            filter: 'blur(22px)',
          }}
        />

        {/* Soft Morning Mist Band */}
        <div
          className="absolute inset-x-0 bottom-[26%] h-40 opacity-70"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${palette.mistColor} 50%, transparent 100%)`,
          }}
        />

        {/* Layered Rolling Vegetable Terraces & Produce Rows (SVG) */}
        <svg
          viewBox="0 0 1440 720"
          preserveAspectRatio="xMidYMax slice"
          className="absolute inset-x-0 bottom-0 w-full h-[78vh] min-h-[460px]"
        >
          <defs>
            <linearGradient id={`hillFar-${variant}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.farHill} stopOpacity="0.65" />
              <stop offset="100%" stopColor={palette.midHill} stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id={`hillMid-${variant}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.terraceBack} stopOpacity="0.88" />
              <stop offset="100%" stopColor={palette.terraceMid} stopOpacity="0.98" />
            </linearGradient>
            <linearGradient id={`terraceFront-${variant}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.terraceMid} />
              <stop offset="100%" stopColor={palette.terraceFront} />
            </linearGradient>
            <radialGradient id={`dewShine-${variant}`} cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="55%" stopColor="#d1fae5" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.15" />
            </radialGradient>
          </defs>

          {/* Far Highland / Farm Ridge */}
          <path
            d="M0,390 C220,310 420,330 680,385 C960,445 1190,320 1440,360 L1440,720 L0,720 Z"
            fill={`url(#hillFar-${variant})`}
          />

          {/* Mid Rolling Produce Hills */}
          <path
            d="M0,455 C260,395 490,475 760,430 C1020,385 1230,440 1440,405 L1440,720 L0,720 Z"
            fill={`url(#hillMid-${variant})`}
          />

          {/* Cultivated Vegetable Bed Ridges (Luống rau xanh mướt) */}
          <path
            d="M0,510 C280,470 540,545 840,495 C1110,450 1290,505 1440,485 L1440,720 L0,720 Z"
            fill={palette.terraceMid}
            opacity="0.92"
          />
          <path
            d="M0,555 C320,520 620,590 940,540 C1160,505 1310,545 1440,530 L1440,720 L0,720 Z"
            fill={`url(#terraceFront-${variant})`}
          />
          {/* Subtle crop row highlights */}
          <path
            d="M0,562 C320,527 620,597 940,547 C1160,512 1310,552 1440,537"
            fill="none"
            stroke={palette.leafHighlight}
            strokeWidth="2.5"
            strokeOpacity="0.35"
          />
          <path
            d="M0,618 C340,585 680,645 1020,598 C1220,572 1350,602 1440,590"
            fill="none"
            stroke={palette.leafHighlight}
            strokeWidth="2.5"
            strokeOpacity="0.28"
          />

          {/* Foreground Left: Fresh Lettuce & Bok Choy / Mustard Greens Cluster */}
          <g className="origin-bottom-left animate-produce-sway">
            {/* Outer broad mustard green leaves (Cải xanh) */}
            <path
              d="M-20,720 C-10,600 45,515 115,495 C140,565 118,655 75,720 Z"
              fill={palette.leafDark}
            />
            <path
              d="M25,720 C35,610 105,535 178,522 C192,592 162,670 112,720 Z"
              fill={palette.leafMid}
            />
            <path
              d="M78,720 C95,625 162,575 232,572 C238,632 204,685 158,720 Z"
              fill={palette.leafLight}
              opacity="0.92"
            />
            {/* Crisp leaf midribs / veins */}
            <path
              d="M32,715 C60,640 88,572 115,512"
              fill="none"
              stroke={palette.leafHighlight}
              strokeWidth="3"
              strokeLinecap="round"
              strokeOpacity="0.65"
            />
            <path
              d="M72,718 C102,648 134,588 168,536"
              fill="none"
              stroke="#ecfccb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeOpacity="0.6"
            />
            {/* Ruffled lettuce rosette (Xà lách tươi) */}
            <path
              d="M150,720 C145,650 185,615 235,618 C275,622 308,658 298,720 Z"
              fill={palette.leafMid}
            />
            <path
              d="M172,720 C170,665 205,638 242,642 C272,646 290,675 280,720 Z"
              fill={palette.leafHighlight}
              opacity="0.72"
            />
            {/* Sparkling dew droplets on left leaves */}
            <circle cx="118" cy="548" r="5.5" fill={`url(#dewShine-${variant})`} />
            <circle cx="168" cy="586" r="4" fill={`url(#dewShine-${variant})`} />
            <circle cx="222" cy="642" r="4.5" fill={`url(#dewShine-${variant})`} />
          </g>

          {/* Foreground Right: Lush Produce Bunch & Herbs */}
          <g className="origin-bottom-right animate-produce-sway-reverse">
            <path
              d="M1460,720 C1450,595 1385,510 1315,490 C1292,562 1316,652 1362,720 Z"
              fill={palette.leafDark}
            />
            <path
              d="M1412,720 C1398,608 1328,538 1255,526 C1242,596 1272,672 1322,720 Z"
              fill={palette.leafMid}
            />
            <path
              d="M1355,720 C1336,632 1272,582 1204,578 C1198,638 1230,688 1276,720 Z"
              fill={palette.leafLight}
              opacity="0.92"
            />
            {/* Crisp veins */}
            <path
              d="M1402,715 C1372,640 1344,572 1316,508"
              fill="none"
              stroke={palette.leafHighlight}
              strokeWidth="3"
              strokeLinecap="round"
              strokeOpacity="0.6"
            />
            <path
              d="M1358,718 C1328,648 1296,592 1262,542"
              fill="none"
              stroke="#ecfccb"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeOpacity="0.55"
            />
            {/* Fresh herb / sprout shoots */}
            <path
              d="M1215,720 C1208,665 1175,638 1142,646 C1138,676 1160,704 1185,720 Z"
              fill={palette.leafHighlight}
              opacity="0.75"
            />
            {/* Dewdrops on right leaves */}
            <circle cx="1312" cy="544" r="5" fill={`url(#dewShine-${variant})`} />
            <circle cx="1264" cy="588" r="4" fill={`url(#dewShine-${variant})`} />
            <circle cx="1182" cy="664" r="3.5" fill={`url(#dewShine-${variant})`} />
          </g>
        </svg>

        {/* Top Corner Canopy Leaves Framing */}
        <svg
          viewBox="0 0 360 220"
          className="hidden md:block absolute top-0 left-0 w-72 h-44 opacity-80 animate-produce-sway"
        >
          <path
            d="M0,0 L195,0 C175,52 125,92 62,102 C34,68 12,35 0,0 Z"
            fill={palette.leafDark}
            opacity="0.45"
          />
          <path
            d="M0,0 L132,0 C118,64 78,118 16,138 C5,94 0,46 0,0 Z"
            fill={palette.leafMid}
            opacity="0.55"
          />
          <path
            d="M18,12 C48,46 72,78 96,105"
            fill="none"
            stroke={palette.leafHighlight}
            strokeWidth="2"
            strokeOpacity="0.5"
          />
        </svg>

        {/* Dynamic Morning Dew & Breeze Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
      </div>

      {/* Foreground Auth Card Slot (Layer 20) */}
      <div className="relative z-20 min-h-screen flex items-center justify-center px-4 py-10 sm:py-14">
        {children}
      </div>
    </div>
  );
}
