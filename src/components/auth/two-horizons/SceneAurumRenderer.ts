export interface SceneShaderPalette {
  bhCenterX: number;
  bhCenterY: number;
  bhRadius: number;
  diskTilt: number;
  bgColor: [number, number, number];
  diskInner: [number, number, number];
  diskOuter: [number, number, number];
  haloColor: [number, number, number];
  dustDensity: number;
}

export const AURUM_PALETTE: SceneShaderPalette = {
  bhCenterX: 0.5,
  bhCenterY: 0.58,
  bhRadius: 0.255, // Dominant supermassive singularity (>70% sky presence with lensing halo)
  diskTilt: 0.22,
  bgColor: [0.025, 0.015, 0.008],
  diskInner: [1.0, 0.86, 0.45],
  diskOuter: [0.85, 0.34, 0.05],
  haloColor: [0.95, 0.58, 0.14],
  dustDensity: 1.05,
};

/**
 * Renders Scene 1 (:: Aurum / Gold) foreground:
 * American 2-story wooden farmhouse with glowing warm windows, vintage pickup truck,
 * dry prairie grass swaying in the wind, and a dog sitting quietly on the porch.
 * Camera slowly pushes in toward the farmhouse.
 */
export function renderAurumForeground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedSec: number,
  parallaxX: number,
  parallaxY: number
) {
  const zoomLoop = (elapsedSec * 0.018) % 1;
  const scale = 1 + zoomLoop * 0.14;
  const horizonY = height * 0.72 + parallaxY * 12;

  ctx.save();
  ctx.translate(width * 0.5 + parallaxX * 18, horizonY);
  ctx.scale(scale, scale);
  ctx.translate(-width * 0.5, -horizonY);

  // Subtle warm atmospheric haze above prairie horizon
  const hazeGrad = ctx.createLinearGradient(0, horizonY - height * 0.22, 0, horizonY + height * 0.15);
  hazeGrad.addColorStop(0, 'rgba(245, 158, 11, 0)');
  hazeGrad.addColorStop(0.6, 'rgba(217, 119, 6, 0.18)');
  hazeGrad.addColorStop(1, 'rgba(18, 10, 4, 0.96)');
  ctx.fillStyle = hazeGrad;
  ctx.fillRect(-width * 0.2, horizonY - height * 0.25, width * 1.4, height * 0.45);

  // Rolling distant prairie ridge
  ctx.fillStyle = '#0c0704';
  ctx.beginPath();
  ctx.moveTo(-width * 0.2, height * 1.2);
  ctx.lineTo(-width * 0.2, horizonY + 8);
  ctx.quadraticCurveTo(width * 0.25, horizonY - 12, width * 0.55, horizonY + 4);
  ctx.quadraticCurveTo(width * 0.82, horizonY + 14, width * 1.2, horizonY - 6);
  ctx.lineTo(width * 1.2, height * 1.2);
  ctx.closePath();
  ctx.fill();

  // Farmhouse anchor on right-center
  const fhX = width * 0.63;
  const fhY = horizonY + 4;
  const fhScale = Math.max(0.65, Math.min(1.15, width / 1100));

  ctx.save();
  ctx.translate(fhX, fhY);
  ctx.scale(fhScale, fhScale);

  // Ground shadow
  ctx.fillStyle = '#070402';
  ctx.fillRect(-260, 0, 520, 260);

  // Main 2-story farmhouse silhouette
  ctx.fillStyle = '#0b0705';
  // Left porch wing
  ctx.fillRect(-95, -46, 56, 46);
  // Porch roof slope
  ctx.beginPath();
  ctx.moveTo(-104, -46);
  ctx.lineTo(-40, -64);
  ctx.lineTo(-35, -46);
  ctx.closePath();
  ctx.fill();
  // Porch pillars
  ctx.fillRect(-90, -46, 4, 46);
  ctx.fillRect(-66, -46, 4, 46);

  // Two-story main house body
  ctx.fillRect(-42, -96, 104, 96);
  // Gabled roof
  ctx.beginPath();
  ctx.moveTo(-54, -95);
  ctx.lineTo(10, -134);
  ctx.lineTo(74, -95);
  ctx.closePath();
  ctx.fill();
  // Chimney
  ctx.fillRect(34, -132, 12, 32);

  // Warm glowing farmhouse windows with soft amber bloom
  const windows = [
    { x: -24, y: -82, w: 18, h: 22 },
    { x: 22, y: -82, w: 18, h: 22 },
    { x: -24, y: -38, w: 20, h: 24 },
    { x: 20, y: -38, w: 22, h: 26 },
  ];
  for (const win of windows) {
    const cx = win.x + win.w / 2;
    const cy = win.y + win.h / 2;
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 38);
    glow.addColorStop(0, 'rgba(255, 224, 130, 0.72)');
    glow.addColorStop(0.5, 'rgba(245, 158, 11, 0.22)');
    glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 40, cy - 40, 80, 80);

    ctx.fillStyle = '#fcd34d';
    ctx.fillRect(win.x, win.y, win.w, win.h);
    // Window mullion cross
    ctx.fillStyle = '#0b0705';
    ctx.fillRect(cx - 1, win.y, 2, win.h);
    ctx.fillRect(win.x, cy - 1, win.w, 2);
  }

  // Porch lantern glow + dog silhouette sitting on porch
  const lanternGlow = ctx.createRadialGradient(-72, -36, 1, -72, -36, 26);
  lanternGlow.addColorStop(0, 'rgba(253, 224, 71, 0.75)');
  lanternGlow.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = lanternGlow;
  ctx.fillRect(-100, -64, 56, 56);

  // Dog sitting quietly on porch
  ctx.fillStyle = '#090604';
  ctx.beginPath();
  ctx.ellipse(-74, -8, 6, 9, -0.15, 0, Math.PI * 2); // body
  ctx.arc(-72, -19, 4.2, 0, Math.PI * 2); // head
  ctx.moveTo(-74, -22);
  ctx.lineTo(-76, -27);
  ctx.lineTo(-71, -23); // ear
  ctx.moveTo(-79, -4);
  ctx.quadraticCurveTo(-87, -8, -84, -14); // tail
  ctx.fill();

  ctx.restore();

  // Vintage pickup truck silhouette parked on the left prairie
  const trX = width * 0.24;
  const trY = horizonY + 10;
  ctx.save();
  ctx.translate(trX, trY);
  ctx.scale(fhScale * 0.95, fhScale * 0.95);
  ctx.fillStyle = '#0b0705';
  // Truck bed + hood + cab
  ctx.fillRect(-70, -24, 56, 18); // rear bed
  ctx.beginPath();
  ctx.moveTo(-14, -24);
  ctx.lineTo(-6, -44);
  ctx.lineTo(28, -44);
  ctx.lineTo(36, -24);
  ctx.lineTo(66, -22);
  ctx.lineTo(68, -6);
  ctx.lineTo(-70, -6);
  ctx.closePath();
  ctx.fill();
  // Cabin window glint reflecting gold horizon
  ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
  ctx.beginPath();
  ctx.moveTo(-2, -26);
  ctx.lineTo(3, -40);
  ctx.lineTo(25, -40);
  ctx.lineTo(30, -26);
  ctx.closePath();
  ctx.fill();
  // Wheels
  ctx.fillStyle = '#070402';
  ctx.beginPath();
  ctx.arc(-42, -5, 11, 0, Math.PI * 2);
  ctx.arc(44, -5, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Swaying foreground dry prairie grass blades
  ctx.strokeStyle = '#080503';
  const bladeCount = width < 640 ? 90 : 180;
  for (let i = 0; i < bladeCount; i++) {
    const bx = (i / bladeCount) * width * 1.15 - width * 0.08;
    const sway = Math.sin(elapsedSec * 1.4 + i * 0.37) * 8;
    const h = 22 + (i % 7) * 9;
    ctx.lineWidth = i % 3 === 0 ? 2 : 1.2;
    ctx.beginPath();
    ctx.moveTo(bx, horizonY + 26 + (i % 5) * 6);
    ctx.quadraticCurveTo(bx + sway * 0.5, horizonY + 12, bx + sway, horizonY + 22 - h);
    ctx.stroke();
  }

  ctx.restore();
}
