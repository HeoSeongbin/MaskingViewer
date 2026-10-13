import { describe, it, expect } from 'vitest';
import {
  apply,
  inverse,
  multiply,
  scale,
  translate,
} from '../core/geometry/transformMatrix';
import {
  editGeometry,
  displayGeometry,
  zoomAt,
  sourcePoint,
  screenToStage,
  constrainPan,
} from '../core/geometry/coordinateTransform';
import { normalizedRectangle } from '../core/geometry/rectangleUtils';
const source = { width: 960, height: 640 };
describe('affine coordinates in normalized original units', () => {
  for (const rotation of [0, 90, 180, 270] as const)
    for (const flipX of [false, true])
      for (const flipY of [false, true])
        for (const zoom of [0.5, 1, 2, 4]) {
          it(`round trip rotation ${rotation}, flips ${flipX}/${flipY}, zoom ${zoom}`, () => {
            const edit = { rotation, flipX, flipY };
            const geometry = editGeometry(source, edit);
            expect(geometry.width).toBe(rotation % 180 ? 640 : 960);
            expect(geometry.height).toBe(rotation % 180 ? 960 : 640);
            const display = displayGeometry(
              source,
              edit,
              { mode: 'manual', zoom, pan: { x: 73, y: -51 } },
              { width: 500, height: 400 },
            );
            for (const point of [
              { x: 0, y: 0 },
              { x: 960, y: 640 },
              { x: 12.75, y: 301.25 },
              { x: 480, y: 320 },
            ]) {
              const result = sourcePoint(
                display.matrix,
                apply(display.matrix, point),
              );
              expect(result.x).toBeCloseTo(point.x, 9);
              expect(result.y).toBeCloseTo(point.y, 9);
              const edited = apply(geometry.matrix, point);
              expect(edited.x).toBeGreaterThanOrEqual(0);
              expect(edited.y).toBeGreaterThanOrEqual(0);
              expect(edited.x).toBeLessThanOrEqual(geometry.width);
              expect(edited.y).toBeLessThanOrEqual(geometry.height);
            }
            const a = sourcePoint(
              display.matrix,
              apply(display.matrix, { x: 250, y: 200 }),
            );
            const b = sourcePoint(
              display.matrix,
              apply(display.matrix, { x: 100, y: 50 }),
            );
            const rect = normalizedRectangle(a, b, source);
            expect(rect.x).toBeCloseTo(100);
            expect(rect.y).toBeCloseTo(50);
            expect(rect.width).toBeCloseTo(150);
            expect(rect.height).toBeCloseTo(150);
          });
        }
  it('rotation maps asymmetric points in clockwise screen coordinates', () => {
    expect(
      apply(
        editGeometry(
          { width: 100, height: 60 },
          { rotation: 90, flipX: false, flipY: false },
        ).matrix,
        { x: 10, y: 20 },
      ),
    ).toEqual({ x: 40, y: 10 });
    expect(
      apply(
        editGeometry(
          { width: 100, height: 60 },
          { rotation: 90, flipX: true, flipY: false },
        ).matrix,
        { x: 10, y: 20 },
      ),
    ).toEqual({ x: 20, y: 10 });
  });
  it('keeps pointer source position when zoom has room, and limits zoom', () => {
    const edit = { rotation: 90 as const, flipX: true, flipY: true };
    const stage = { width: 500, height: 400 };
    const point = { x: 235, y: 175 };
    const view = { mode: 'manual' as const, zoom: 1, pan: { x: 0, y: 0 } };
    const before = sourcePoint(
      displayGeometry(source, edit, view, stage).matrix,
      point,
    );
    const next = zoomAt(source, edit, view, stage, point, 2);
    const after = sourcePoint(
      displayGeometry(source, edit, next, stage).matrix,
      point,
    );
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(zoomAt(source, edit, view, stage, point, 500).zoom).toBe(8);
    expect(zoomAt(source, edit, view, stage, point, 0).zoom).toBe(0.01);
  });
  it('clamps out-of-bounds negative drags and viewport movement', () => {
    expect(
      normalizedRectangle({ x: 1200, y: 800 }, { x: -20, y: -50 }, source),
    ).toEqual({ x: 0, y: 0, width: 960, height: 640 });
    expect(
      normalizedRectangle({ x: -30, y: -20 }, { x: -10, y: -5 }, source),
    ).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(
      constrainPan(
        { x: 1e6, y: -1e6 },
        { width: 1000, height: 800 },
        { width: 500, height: 400 },
      ),
    ).toEqual({ x: 290, y: -240 });
  });
  it('uses CSS coordinates independently of backing DPR and rejects singular matrices', () => {
    expect(
      screenToStage(
        { x: 300, y: 250 },
        { left: 100, top: 50, width: 400, height: 400 },
        { width: 800, height: 800 },
      ),
    ).toEqual({ x: 400, y: 400 });
    expect(() => inverse(scale(0))).toThrow();
    expect(
      apply(multiply(translate(10, 20), scale(2)), { x: 3, y: 4 }),
    ).toEqual({ x: 16, y: 28 });
  });
});
