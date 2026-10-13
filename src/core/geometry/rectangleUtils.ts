import type { Point, Size } from './transformMatrix';
export function normalizedRectangle(start: Point, end: Point, bounds: Size) {
  const x = Math.max(0, Math.min(bounds.width, Math.min(start.x, end.x)));
  const y = Math.max(0, Math.min(bounds.height, Math.min(start.y, end.y)));
  const right = Math.max(0, Math.min(bounds.width, Math.max(start.x, end.x)));
  const bottom = Math.max(0, Math.min(bounds.height, Math.max(start.y, end.y)));
  return { x, y, width: right - x, height: bottom - y };
}
