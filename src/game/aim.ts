export interface AimTarget {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export interface WeaponMount {
  x: number;
  y: number;
  angle: number;
}

// Adding a barrel never moves barrel zero off the original firing line.
export function adjacentSlot(index: number): number {
  return index === 0 ? 0 : Math.ceil(index / 2) * (index % 2 ? 1 : -1);
}

export function aimAngle(x: number, y: number, target: AimTarget, speed = 0): number {
  const dx = target.x - x;
  const dy = target.y - y;
  const vx = target.vx || 0;
  const vy = target.vy || 0;
  let time = 0;
  if (speed > 0) {
    const a = vx * vx + vy * vy - speed * speed;
    const b = 2 * (dx * vx + dy * vy);
    const c = dx * dx + dy * dy;
    const discriminant = b * b - 4 * a * c;
    if (Math.abs(a) < 0.001) {
      if (b < 0) time = -c / b;
    } else if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      const t1 = (-b - root) / (2 * a);
      const t2 = (-b + root) / (2 * a);
      time = Math.min(t1 > 0 ? t1 : Infinity, t2 > 0 ? t2 : Infinity);
    }
    time = Number.isFinite(time) ? Math.min(1.25, Math.max(0, time)) : 0;
  }
  return Math.atan2(dy + vy * time, dx + vx * time);
}

export function adjacentMount(
  x: number, y: number, radius: number, facing: number,
  weaponIndex: number, barrelIndex: number, barrelCount: number,
  target: AimTarget, speed = 0,
): WeaponMount {
  const mainSpan = Math.ceil((barrelCount - 1) / 2) * 7;
  const side = weaponIndex === 0
    ? adjacentSlot(barrelIndex) * 7
    : (mainSpan + 11 + Math.floor((weaponIndex - 1) / 2) * 9) * (weaponIndex % 2 ? 1 : -1);
  const forward = radius + 5 - Math.min(9, Math.abs(side) * 0.2);
  const mx = x + Math.cos(facing) * forward - Math.sin(facing) * side;
  const my = y + Math.sin(facing) * forward + Math.cos(facing) * side;
  return { x: mx, y: my, angle: aimAngle(mx, my, target, speed) };
}

export function segmentDistanceSq(
  px: number, py: number, x1: number, y1: number, x2: number, y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSq)) : 0;
  return (px - x1 - t * dx) ** 2 + (py - y1 - t * dy) ** 2;
}