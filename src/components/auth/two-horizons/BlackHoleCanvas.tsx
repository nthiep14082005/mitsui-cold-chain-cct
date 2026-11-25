'use client';

import React, { useEffect, useRef } from 'react';
import { AURUM_PALETTE, renderAurumForeground, SceneShaderPalette } from './SceneAurumRenderer';
import { getViolaAltitudeMeters, renderViolaForeground, VIOLA_PALETTE } from './SceneViolaRenderer';

export type TwoHorizonsScene = 'aurum' | 'viola';

export interface TelemetrySnapshot {
  altMeters: number;
  tiltDeg: number;
  fps: number;
  timecode: string;
}

const VERT_SRC = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG_SRC = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uTilt;
uniform vec3 uBgColor;
uniform vec3 uDiskInner;
uniform vec3 uDiskOuter;
uniform vec3 uHaloColor;
uniform float uDustDensity;
uniform vec2 uParallax;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.04;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  float aspect = uRes.x / max(1.0, uRes.y);
  vec2 center = uCenter + uParallax * 0.025;
  vec2 d = uv - center;
  d.x *= aspect;

  float r = length(d);
  float angle = atan(d.y, d.x);

  // Subtle starfield bent by Schwarzschild gravitational lensing
  vec2 starUv = uv * 90.0 + d * (0.12 / max(0.06, r));
  float starSeed = hash(floor(starUv));
  float star = step(0.9955, starSeed) * smoothstep(uRadius * 1.1, uRadius * 2.2, r);
  vec3 col = uBgColor + vec3(star * 0.75);

  // Gravitational lensing warp around event horizon
  float warp = (uRadius * uRadius) / max(0.004, r * r);
  float warpedY = d.y / max(0.08, uTilt + 0.16 * warp);
  float diskCoord = length(vec2(d.x, warpedY));

  // Swirl turbulent accretion disk + volumetric dust
  float swirl = angle + (1.4 / max(0.12, r)) - uTime * 0.38;
  float fil = fbm(vec2(diskCoord * 12.0, swirl * 2.2));
  float fil2 = fbm(vec2(r * 9.0 - uTime * 0.25, swirl * 3.0));

  float diskBand = exp(-pow((diskCoord - uRadius * 2.05) / (uRadius * 0.72), 2.0));
  float secondaryLensedArc = exp(-pow((r - uRadius * 1.18) / (uRadius * 0.19), 2.0)) * (0.45 + 0.55 * abs(sin(angle)));
  float photonRing = exp(-pow((r - uRadius * 1.035) / (uRadius * 0.032), 2.0));

  // Relativistic Doppler beaming (left side brighter)
  float doppler = 0.78 + 0.35 * cos(angle + 0.4);
  float diskIntensity = (diskBand * (0.55 + 0.75 * fil) + secondaryLensedArc * (0.55 + 0.5 * fil2)) * doppler;

  vec3 diskCol = mix(uDiskOuter, uDiskInner, clamp(fil * 1.15, 0.0, 1.0));
  col += diskCol * diskIntensity * 1.35;
  col += uDiskInner * photonRing * 1.45;

  // Volumetric infalling halo dust
  float halo = exp(-r * (2.6 / max(0.25, uRadius * 2.2))) * uDustDensity;
  col += uHaloColor * halo * (0.28 + 0.42 * fil2);

  // Event horizon pitch-black core
  float coreMask = smoothstep(uRadius * 0.96, uRadius * 1.03, r);
  col *= coreMask;

  // Vignette for cinematic contrast
  float vig = 1.0 - 0.38 * dot(uv - 0.5, uv - 0.5);
  col *= vig;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpVec3(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function BlackHoleCanvas({
  scene,
  onTelemetry,
}: {
  scene: TwoHorizonsScene;
  onTelemetry: (snap: TelemetrySnapshot) => void;
}) {
  const glCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<TwoHorizonsScene>(scene);
  sceneRef.current = scene;

  useEffect(() => {
    const glCanvas = glCanvasRef.current;
    const fgCanvas = fgCanvasRef.current;
    if (!glCanvas || !fgCanvas) return;

    const fgCtx = fgCanvas.getContext('2d');
    const gl = glCanvas.getContext('webgl', { antialias: false, alpha: false });

    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const uniforms: Record<string, WebGLUniformLocation | null> = {};

    if (gl) {
      const compile = (type: number, src: string) => {
        const sh = gl.createShader(type);
        if (!sh) return null;
        gl.shaderSource(sh, src);
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
          gl.deleteShader(sh);
          return null;
        }
        return sh;
      };
      const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
      const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
      if (vs && fs) {
        program = gl.createProgram();
        if (program) {
          gl.attachShader(program, vs);
          gl.attachShader(program, fs);
          gl.linkProgram(program);
          if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.useProgram(program);
            buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(
              gl.ARRAY_BUFFER,
              new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
              gl.STATIC_DRAW
            );
            const aPos = gl.getAttribLocation(program, 'aPos');
            gl.enableVertexAttribArray(aPos);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

            for (const name of [
              'uRes',
              'uTime',
              'uCenter',
              'uRadius',
              'uTilt',
              'uBgColor',
              'uDiskInner',
              'uDiskOuter',
              'uHaloColor',
              'uDustDensity',
              'uParallax',
            ]) {
              uniforms[name] = gl.getUniformLocation(program, name);
            }
          }
        }
      }
    }

    let cssW = window.innerWidth;
    let cssH = window.innerHeight;
    const resize = () => {
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      const isMobile = cssW <= 768;
      const dpr = isMobile ? Math.min(window.devicePixelRatio || 1, 1.5) : Math.min(window.devicePixelRatio || 1, 2);

      glCanvas.width = Math.floor(cssW * dpr);
      glCanvas.height = Math.floor(cssH * dpr);
      fgCanvas.width = Math.floor(cssW * dpr);
      fgCanvas.height = Math.floor(cssH * dpr);

      if (gl) {
        gl.viewport(0, 0, glCanvas.width, glCanvas.height);
      }
      if (fgCtx) {
        fgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    resize();

    let targetPx = 0;
    let targetPy = 0;
    let px = 0;
    let py = 0;
    const onPointerMove = (e: PointerEvent) => {
      targetPx = (e.clientX / Math.max(1, cssW) - 0.5) * 2;
      targetPy = (e.clientY / Math.max(1, cssH) - 0.5) * 2;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    let currentBlend = sceneRef.current === 'aurum' ? 0 : 1;
    let rafId = 0;
    const startMs = performance.now();
    let frameCount = 0;
    let lastFpsTime = startMs;
    let lastTelUpdate = 0;
    let measuredFps = 60;

    const frame = (nowMs: number) => {
      const elapsedSec = (nowMs - startMs) / 1000;
      const targetBlend = sceneRef.current === 'aurum' ? 0 : 1;
      currentBlend = lerp(currentBlend, targetBlend, 0.14);

      px = lerp(px, targetPx, 0.05);
      py = lerp(py, targetPy, 0.05);

      const pal: SceneShaderPalette = {
        bhCenterX: lerp(AURUM_PALETTE.bhCenterX, VIOLA_PALETTE.bhCenterX, currentBlend),
        bhCenterY: lerp(AURUM_PALETTE.bhCenterY, VIOLA_PALETTE.bhCenterY, currentBlend),
        bhRadius: lerp(AURUM_PALETTE.bhRadius, VIOLA_PALETTE.bhRadius, currentBlend),
        diskTilt: lerp(AURUM_PALETTE.diskTilt, VIOLA_PALETTE.diskTilt, currentBlend),
        bgColor: lerpVec3(AURUM_PALETTE.bgColor, VIOLA_PALETTE.bgColor, currentBlend),
        diskInner: lerpVec3(AURUM_PALETTE.diskInner, VIOLA_PALETTE.diskInner, currentBlend),
        diskOuter: lerpVec3(AURUM_PALETTE.diskOuter, VIOLA_PALETTE.diskOuter, currentBlend),
        haloColor: lerpVec3(AURUM_PALETTE.haloColor, VIOLA_PALETTE.haloColor, currentBlend),
        dustDensity: lerp(AURUM_PALETTE.dustDensity, VIOLA_PALETTE.dustDensity, currentBlend),
      };

      if (gl && program) {
        gl.uniform2f(uniforms.uRes, glCanvas.width, glCanvas.height);
        gl.uniform1f(uniforms.uTime, elapsedSec);
        gl.uniform2f(uniforms.uCenter, pal.bhCenterX, pal.bhCenterY);
        gl.uniform1f(uniforms.uRadius, pal.bhRadius);
        gl.uniform1f(uniforms.uTilt, pal.diskTilt);
        gl.uniform3fv(uniforms.uBgColor, pal.bgColor);
        gl.uniform3fv(uniforms.uDiskInner, pal.diskInner);
        gl.uniform3fv(uniforms.uDiskOuter, pal.diskOuter);
        gl.uniform3fv(uniforms.uHaloColor, pal.haloColor);
        gl.uniform1f(uniforms.uDustDensity, pal.dustDensity);
        gl.uniform2f(uniforms.uParallax, px, py);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }

      if (fgCtx) {
        fgCtx.clearRect(0, 0, cssW, cssH);

        // Pure Canvas2D fallback sky if WebGL unavailable
        if (!gl) {
          const g = fgCtx.createRadialGradient(
            cssW * pal.bhCenterX,
            cssH * (1 - pal.bhCenterY),
            cssH * pal.bhRadius * 0.6,
            cssW * pal.bhCenterX,
            cssH * (1 - pal.bhCenterY),
            cssW * 0.75
          );
          g.addColorStop(0, '#000000');
          g.addColorStop(0.25, sceneRef.current === 'aurum' ? '#d97706' : '#7c3aed');
          g.addColorStop(1, '#040308');
          fgCtx.fillStyle = g;
          fgCtx.fillRect(0, 0, cssW, cssH);
        }

        if (sceneRef.current === 'aurum') {
          renderAurumForeground(fgCtx, cssW, cssH, elapsedSec, px, py);
        } else {
          renderViolaForeground(fgCtx, cssW, cssH, elapsedSec, px, py);
        }
      }

      frameCount++;
      if (nowMs - lastFpsTime >= 600) {
        measuredFps = Math.round((frameCount * 1000) / (nowMs - lastFpsTime));
        frameCount = 0;
        lastFpsTime = nowMs;
      }

      if (nowMs - lastTelUpdate >= 100) {
        lastTelUpdate = nowMs;
        const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const secs = String(Math.floor(elapsedSec % 60)).padStart(2, '0');
        const ms = String(Math.floor((elapsedSec % 1) * 100)).padStart(2, '0');
        const altMeters =
          sceneRef.current === 'viola'
            ? getViolaAltitudeMeters(elapsedSec)
            : 2.4 - ((elapsedSec * 0.018) % 1) * 1.1;
        const tiltDeg =
          (sceneRef.current === 'aurum' ? 12.6 : 18.4) + py * 2.5;

        onTelemetry({
          altMeters,
          tiltDeg,
          fps: measuredFps,
          timecode: `00:${mins}:${secs}:${ms}`,
        });
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      if (gl) {
        if (program) gl.deleteProgram(program);
        if (buffer) gl.deleteBuffer(buffer);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
    };
  }, [onTelemetry]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-black pointer-events-none">
      <canvas ref={glCanvasRef} className="absolute inset-0 w-full h-full block" />
      <canvas ref={fgCanvasRef} className="absolute inset-0 w-full h-full block" />
    </div>
  );
}
