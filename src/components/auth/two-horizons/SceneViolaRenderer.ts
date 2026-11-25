import { SceneShaderPalette } from './SceneAurumRenderer';

export const VIOLA_PALETTE: SceneShaderPalette = {
  bhCenterX: 0.5,
  bhCenterY: 0.42,
  bhRadius: 0.165, // Horizon singularity with silver-violet lensed arc
  diskTilt: 0.16,
  bgColor: [0.02, 0.015, 0.055],
  diskInner: [0.92, 0.9, 1.0],
  diskOuter: [0.55, 0.32, 0.88],
  haloColor: [0.64, 0.45, 0.96],
  dustDensity: 0.82,
};

/**
 * Computes camera altitude (1.0m -> 10.0m slow pull-back) for :: Viola telemetry & perspective.
 */
export function getViolaAltitudeMeters(elapsedSec: number): number {
  const cycle = (elapsedSec * 0.022) % 1;
  return 1.0 + cycle * 9.0;
}

/**
 * Renders Scene 2 (:: Viola / Violet) foreground:
 * Endless field of glowing violet tulips & lavender swaying gently, drifting mist,
 * floating luminous firefly particles, and a dark-suited astronaut sitting from behind.
 */
export function renderViolaForeground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedSec: number,
  parallaxX: number,
  parallaxY: number
) {
  const alt = getViolaAltitudeMeters(elapsedSec);
  const pullBackScale = 1.08 - ((alt - 1.0) / 9.0) * 0.22;
  const horizonY = height * 0.58 + parallaxY * 14;

  ctx.save();
  ctx.translate(width * 0.5 + parallaxX * 16, horizonY);
  ctx.scale(pullBackScale, pullBackScale);
  ctx.translate(-width * 0.5, -horizonY);

  // Cool indigo/lavender field base gradient
  const fieldGrad = ctx.createLinearGradient(0, horizonY - 20, 0, height * 1.25);
  fieldGrad.addColorStop(0, 'rgba(30, 27, 75, 0.35)');
  fieldGrad.addColorStop(0.25, '#130c2e');
  fieldGrad.addColorStop(1, '#050310');
  ctx.fillStyle = fieldGrad;
  ctx.fillRect(-width * 0.3, horizonY - 12, width * 1.6, height * 0.9);

  // Soft drifting mist ribbons across the flower field
  for (let m = 0; m < 3; m++) {
    const driftX = Math.sin(elapsedSec * 0.22 + m * 2.1) * 60;
    const my = horizonY + 35 + m * 46;
    const mist = ctx.createLinearGradient(0, my - 25, 0, my + 25);
    mist.addColorStop(0, 'rgba(167, 139, 250, 0)');
    mist.addColorStop(0.5, 'rgba(167, 139, 250, 0.10)');
    mist.addColorStop(1, 'rgba(167, 139, 250, 0)');
    ctx.fillStyle = mist;
    ctx.fillRect(-width * 0.2 + driftX, my - 25, width * 1.4, 50);
  }

  // Perspective rows of glowing violet tulips & lavender
  const rows = width < 640 ? 9 : 13;
  for (let r = 0; r < rows; r++) {
    const depth = (r + 1) / rows;
    const y = horizonY + Math.pow(depth, 1.55) * (height * 0.48);
    const cols = Math.floor((width < 640 ? 16 : 28) * (0.7 + depth * 0.5));
    const flowerSize = 2.5 + depth * 6.5;

    for (let c = 0; c < cols; c++) {
      const seed = r * 97 + c * 31;
      const jitterX = ((seed % 19) - 9) * 2.2;
      const x = ((c + 0.5) / cols) * width * 1.25 - width * 0.12 + jitterX;
      const sway = Math.sin(elapsedSec * 1.3 + seed * 0.2) * (2 + depth * 4);

      // Stem
      ctx.strokeStyle = `rgba(49, 46, 129, ${0.35 + depth * 0.5})`;
      ctx.lineWidth = 1 + depth * 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y + flowerSize * 1.9);
      ctx.lineTo(x + sway, y);
      ctx.stroke();

      // Luminous tulip/lavender head
      const isLavender = seed % 3 === 0;
      ctx.fillStyle = isLavender
        ? `rgba(196, 181, 253, ${0.42 + depth * 0.45})`
        : `rgba(168, 85, 247, ${0.4 + depth * 0.5})`;
      ctx.beginPath();
      if (isLavender) {
        ctx.ellipse(x + sway, y - flowerSize * 0.4, flowerSize * 0.35, flowerSize * 0.85, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(x + sway, y, flowerSize * 0.55, 0, Math.PI, false);
        ctx.lineTo(x + sway - flowerSize * 0.45, y - flowerSize * 0.55);
        ctx.lineTo(x + sway, y - flowerSize * 0.25);
        ctx.lineTo(x + sway + flowerSize * 0.45, y - flowerSize * 0.55);
      }
      ctx.fill();
    }
  }

  // Dark-suited astronaut sitting from behind gazing at the horizon
  const astroX = width * 0.36;
  const astroY = horizonY + height * 0.19;
  const astroScale = Math.max(0.62, Math.min(1.05, width / 1100));
  ctx.save();
  ctx.translate(astroX, astroY);
  ctx.scale(astroScale, astroScale);

  // Subtle rim light from violet accretion disk
  const rimGrad = ctx.createRadialGradient(0, -32, 6, 0, -24, 52);
  rimGrad.addColorStop(0, 'rgba(196, 181, 253, 0.28)');
  rimGrad.addColorStop(1, 'rgba(196, 181, 253, 0)');
  ctx.fillStyle = rimGrad;
  ctx.fillRect(-60, -80, 120, 110);

  ctx.fillStyle = '#090714';
  ctx.strokeStyle = 'rgba(196, 181, 253, 0.38)';
  ctx.lineWidth = 1.4;
  // Torso + life-support backpack
  ctx.beginPath();
  ctx.roundRect(-20, -36, 40, 42, 10);
  ctx.fill();
  ctx.stroke();
  // Legs tucked sitting on flowers
  ctx.beginPath();
  ctx.roundRect(-26, 2, 24, 14, 6);
  ctx.roundRect(2, 2, 24, 14, 6);
  ctx.fill();
  // Helmet
  ctx.beginPath();
  ctx.arc(0, -50, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Bioluminescent firefly particles floating upward
  const fireflyCount = width < 640 ? 22 : 42;
  for (let f = 0; f < fireflyCount; f++) {
    const fx = ((f * 173) % width) + Math.sin(elapsedSec * 0.9 + f) * 18;
    const fy =
      horizonY -
      20 +
      ((f * 89 + elapsedSec * 14) % Math.max(120, height * 0.42)) -
      elapsedSec * 0;
    const wrappedY = horizonY - 25 + (((f * 61 - elapsedSec * 16) % 240 + 240) % 240);
    const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(elapsedSec * 2.4 + f * 1.7));
    ctx.fillStyle = f % 2 === 0 ? `rgba(221, 214, 254, ${alpha})` : `rgba(192, 132, 252, ${alpha})`;
    ctx.beginPath();
    ctx.arc(fx, Math.min(height, Math.max(horizonY - 40, wrappedY || fy)), 1.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
