import { it, expect } from 'vitest';
import { DEFAULT_COLOR, transformPixels } from '../core/image/colorTransform';
it('preserves source buffer and alpha, distinguishes invert, grayscale, and binary', () => {
  const original = new Uint8ClampedArray([255, 0, 0, 80, 0, 255, 0, 255]);
  expect(Array.from(transformPixels(original.slice(), DEFAULT_COLOR))).toEqual(
    Array.from(original),
  );
  expect(
    Array.from(
      transformPixels(original.slice(), { ...DEFAULT_COLOR, invert: true }),
    ),
  ).toEqual([0, 255, 255, 80, 255, 0, 255, 255]);
  expect(
    Array.from(
      transformPixels(original.slice(), {
        ...DEFAULT_COLOR,
        tone: 'grayscale',
      }),
    ),
  ).toEqual([54, 54, 54, 80, 182, 182, 182, 255]);
  expect(
    Array.from(
      transformPixels(original.slice(), { ...DEFAULT_COLOR, tone: 'binary' }),
    ),
  ).toEqual([0, 0, 0, 80, 255, 255, 255, 255]);
  expect(Array.from(original)).toEqual([255, 0, 0, 80, 0, 255, 0, 255]);
});
it('clamps brightness, contrast and output channels', () => {
  expect(
    Array.from(
      transformPixels(new Uint8ClampedArray([255, 0, 0, 255]), {
        ...DEFAULT_COLOR,
        tone: 'binary',
        brightness: 40,
      }),
    ),
  ).toEqual([255, 255, 255, 255]);
  expect(
    Array.from(
      transformPixels(new Uint8ClampedArray([50, 100, 200, 255]), {
        ...DEFAULT_COLOR,
        brightness: 100,
      }),
    ),
  ).toEqual([255, 255, 255, 255]);
  expect(
    Array.from(
      transformPixels(new Uint8ClampedArray([50, 128, 200, 255]), {
        ...DEFAULT_COLOR,
        contrast: -100,
      }),
    ),
  ).toEqual([128, 128, 128, 255]);
});
