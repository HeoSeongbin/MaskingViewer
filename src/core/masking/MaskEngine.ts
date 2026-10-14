import type { Point, Size } from '../geometry/transformMatrix';
import { normalizedRectangle } from '../geometry/rectangleUtils';
export interface MaskRegion {
  id: string;
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
}
export const MAX_MASKS = 1000;
export type Corner = 'nw' | 'ne' | 'sw' | 'se';
export function opaqueColor(value: string) {
  if (!/^#[\da-f]{6}$/i.test(value))
    throw new Error('마스킹 색상은 불투명 6자리 HEX 색상이어야 합니다.');
  return value.toLowerCase();
}
export function contains(mask: MaskRegion, point: Point) {
  return (
    point.x >= mask.x &&
    point.x <= mask.x + mask.width &&
    point.y >= mask.y &&
    point.y <= mask.y + mask.height
  );
}
export function maskCorners(mask: MaskRegion): Record<Corner, Point> {
  return {
    nw: { x: mask.x, y: mask.y },
    ne: { x: mask.x + mask.width, y: mask.y },
    sw: { x: mask.x, y: mask.y + mask.height },
    se: { x: mask.x + mask.width, y: mask.y + mask.height },
  };
}
export function moveMask(
  mask: MaskRegion,
  delta: Point,
  bounds: Size,
): MaskRegion {
  return {
    ...mask,
    x: Math.max(0, Math.min(bounds.width - mask.width, mask.x + delta.x)),
    y: Math.max(0, Math.min(bounds.height - mask.height, mask.y + delta.y)),
  };
}
export function resizeMask(
  mask: MaskRegion,
  corner: Corner,
  point: Point,
  bounds: Size,
): MaskRegion {
  const opposite: Record<Corner, Corner> = {
    nw: 'se',
    ne: 'sw',
    sw: 'ne',
    se: 'nw',
  };
  return {
    ...mask,
    ...normalizedRectangle(maskCorners(mask)[opposite[corner]], point, bounds),
  };
}
export function validateMask(mask: MaskRegion, bounds: Size): MaskRegion {
  if (
    ![mask.x, mask.y, mask.width, mask.height].every(Number.isFinite) ||
    mask.x < 0 ||
    mask.y < 0 ||
    mask.width < 1 ||
    mask.height < 1 ||
    mask.x + mask.width > bounds.width + 1e-8 ||
    mask.y + mask.height > bounds.height + 1e-8
  )
    throw new Error(
      '영역은 페이지 안에 있어야 하고 가로·세로는 1 이상이어야 합니다.',
    );
  return { ...mask, fill: opaqueColor(mask.fill) };
}
