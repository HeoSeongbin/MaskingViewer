import { describe, it, expect, beforeEach } from 'vitest';
import {
  moveMask,
  resizeMask,
  validateMask,
  opaqueColor,
} from '../core/masking/MaskEngine';
import { apply } from '../core/geometry/transformMatrix';
import {
  displayGeometry,
  sourcePoint,
} from '../core/geometry/coordinateTransform';
import { normalizedRectangle } from '../core/geometry/rectangleUtils';
import { DEFAULT_EDIT, useEditStore } from '../stores/editStore';
const bounds = { width: 300, height: 200 };
const mask = {
  id: 'region',
  pageId: 'doc:0',
  x: 40,
  y: 30,
  width: 100,
  height: 60,
  fill: '#000000',
};
describe('original coordinate mask operations', () => {
  it('clamps moving, handles crossing corners and rejects unsafe properties', () => {
    expect(moveMask(mask, { x: 999, y: -999 }, bounds)).toMatchObject({
      x: 200,
      y: 0,
      width: 100,
      height: 60,
    });
    expect(resizeMask(mask, 'nw', { x: 180, y: 120 }, bounds)).toMatchObject({
      x: 140,
      y: 90,
      width: 40,
      height: 30,
    });
    expect(resizeMask(mask, 'se', { x: 500, y: 500 }, bounds)).toMatchObject({
      x: 40,
      y: 30,
      width: 260,
      height: 170,
    });
    expect(() => validateMask({ ...mask, width: 0 }, bounds)).toThrow();
    expect(() => validateMask({ ...mask, x: NaN }, bounds)).toThrow();
    for (const color of ['transparent', '#00000000', 'rgba(0,0,0,.5)', '#123'])
      expect(() => opaqueColor(color)).toThrow();
    expect(opaqueColor('#ABCDEF')).toBe('#abcdef');
  });
  for (const rotation of [0, 90, 180, 270] as const)
    for (const zoom of [0.5, 1, 2, 4])
      for (const flip of [false, true]) {
        it(`keeps drag/move/resize in original units at ${rotation}/${zoom}/${flip}`, () => {
          const display = displayGeometry(
            bounds,
            { rotation, flipX: flip, flipY: !flip },
            { mode: 'manual', zoom, pan: { x: 20, y: -30 } },
            { width: 320, height: 250 },
          );
          const fromScreen = (point: { x: number; y: number }) =>
            sourcePoint(display.matrix, apply(display.matrix, point));
          const a = fromScreen({ x: 140, y: 90 }),
            b = fromScreen({ x: 40, y: 30 });
          const region = normalizedRectangle(a, b, bounds);
          expect(region.x).toBeCloseTo(mask.x);
          expect(region.y).toBeCloseTo(mask.y);
          expect(region.width).toBeCloseTo(mask.width);
          expect(region.height).toBeCloseTo(mask.height);
          const move = fromScreen({ x: 65, y: 50 });
          expect(
            moveMask(mask, { x: move.x - 40, y: move.y - 30 }, bounds).x,
          ).toBeCloseTo(65);
          const resized = resizeMask(
            mask,
            'se',
            fromScreen({ x: 150, y: 100 }),
            bounds,
          );
          expect(resized.width).toBeCloseTo(110);
          expect(resized.height).toBeCloseTo(70);
        });
      }
});
beforeEach(() =>
  useEditStore.setState({
    pages: {},
    history: {},
    selection: {},
    hidden: {},
    views: {},
  }),
);
it('shares mask and geometry history with isolated page state and cleans UI state', () => {
  const state = useEditStore.getState();
  state.update('doc:0', { masks: [mask] });
  state.update('doc:0', { rotation: 90 });
  state.update('doc:0', { masks: [{ ...mask, fill: '#ffffff' }] });
  state.toggleMasks('doc:0');
  state.selectMask('doc:0', 'region');
  state.undo('doc:0');
  expect(useEditStore.getState().pages['doc:0']?.masks[0]?.fill).toBe(
    '#000000',
  );
  state.undo('doc:0');
  expect(useEditStore.getState().pages['doc:0']?.rotation).toBe(0);
  state.undo('doc:0');
  expect(useEditStore.getState().pages['doc:0']).toEqual(DEFAULT_EDIT);
  state.redo('doc:0');
  expect(useEditStore.getState().pages['doc:0']?.masks).toEqual([mask]);
  expect(useEditStore.getState().pages['doc:1']).toBeUndefined();
  state.removeDocument('doc');
  expect(useEditStore.getState().selection).toEqual({});
  expect(useEditStore.getState().hidden).toEqual({});
});
