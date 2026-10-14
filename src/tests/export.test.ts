import { describe, expect, it } from 'vitest';
import UTIF from 'utif';
import { DEFAULT_EDIT } from '../stores/editStore';
import { composePixels, equalPixels } from '../core/export/pixels';
import { encodeTiff } from '../core/export/TiffExporter';

import { outputName } from '../core/export/ExportPipeline';
import { editGeometry } from '../core/geometry/coordinateTransform';
import { apply } from '../core/geometry/transformMatrix';
const source = {
  width: 8,
  height: 6,
  data: new Uint8ClampedArray(
    Array.from({ length: 48 }, (_, i) => [i + 1, 70, 90, 255]).flat(),
  ),
};
describe('new export pixels', () => {
  for (const rotation of [0, 90, 180, 270] as const)
    for (const flipX of [false, true])
      for (const flipY of [false, true]) {
        it(`removes sensitive pixels under ${rotation}/${flipX}/${flipY} and preserves source`, () => {
          const original = source.data.slice();
          const edit = {
            ...DEFAULT_EDIT,
            rotation,
            flipX,
            flipY,
            invert: true,
            masks: [
              {
                id: 'm',
                pageId: 'p',
                x: 2.2,
                y: 2.1,
                width: 1.1,
                height: 1.2,
                fill: '#123456',
              },
            ],
          };
          const output = composePixels(source, source, edit);
          const geometry = editGeometry(source, edit);
          for (let y = 1; y < 5; y++)
            for (let x = 1; x < 5; x++) {
              const p = apply(geometry.matrix, { x: x + 0.5, y: y + 0.5 });
              const offset =
                (Math.floor(p.y) * output.width + Math.floor(p.x)) * 4;
              expect([...output.data.slice(offset, offset + 4)]).toEqual([
                18, 52, 86, 255,
              ]);
            }
          expect(source.data).toEqual(original);
        });
      }
  it('removes hidden RGB in transparent pixels', () => {
    expect([
      ...composePixels(
        { width: 1, height: 1, data: new Uint8ClampedArray([42, 53, 64, 0]) },
        { width: 1, height: 1 },
        DEFAULT_EDIT,
      ).data,
    ]).toEqual([255, 255, 255, 255]);
  });
  it('scales PDF source coordinates and refuses invalid masks', () => {
    const result = composePixels(
      source,
      { width: 4, height: 3 },
      {
        ...DEFAULT_EDIT,
        masks: [
          {
            id: 'm',
            pageId: 'p',
            x: 1,
            y: 1,
            width: 1,
            height: 1,
            fill: '#ffffff',
          },
        ],
      },
    );
    expect([
      ...result.data.slice((2 * 8 + 2) * 4, (2 * 8 + 2) * 4 + 4),
    ]).toEqual([255, 255, 255, 255]);
    expect(() =>
      composePixels(source, source, {
        ...DEFAULT_EDIT,
        masks: [
          {
            id: 'm',
            pageId: 'p',
            x: -1,
            y: 0,
            width: 1,
            height: 1,
            fill: '#ffffff',
          },
        ],
      }),
    ).toThrow();
    expect(() => equalPixels(source, { ...source, width: 1 })).toThrow();
  });
});
it('reopens RGB TIFF with independent UTIF decoder, mixed dimensions and ordered pages', () => {
  const second = composePixels(source, source, {
    ...DEFAULT_EDIT,
    rotation: 90,
  });
  const bytes = encodeTiff([source, second]);
  const buffer = bytes.buffer;
  const pages = UTIF.decode(buffer);
  expect(pages).toHaveLength(2);
  pages.forEach((page, i) => {
    UTIF.decodeImage(buffer, page);
    equalPixels(
      {
        width: page.width,
        height: page.height,
        data: new Uint8ClampedArray(UTIF.toRGBA8(page)),
      },
      [source, second][i]!,
    );
    expect(page.t259).toEqual([1]);
  });
});
it('names multi-image outputs ZIP and never uses original extension', () => {
  expect(
    outputName('secret.pdf', { format: 'png', all: true, dpi: 150 }, 3),
  ).toBe('secret_masked.zip');
  expect(
    outputName('secret.pdf', { format: 'tiff', all: false, dpi: 150 }, 1),
  ).toBe('secret_masked.tif');
});
