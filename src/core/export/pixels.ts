import { assertDimensions } from '../document/DocumentModel';
import { editGeometry } from '../geometry/coordinateTransform';
import { apply } from '../geometry/transformMatrix';
import { transformPixels } from '../image/colorTransform';
import { validateMask } from '../masking/MaskEngine';
import type { PageEdit } from '../../stores/editStore';
import type { Size } from '../geometry/transformMatrix';

export interface OutputPixels extends Size {
  data: Uint8ClampedArray;
}
// Work on a new buffer. Every intersecting source pixel is overwritten before rotation.
export function composePixels(
  source: OutputPixels,
  bounds: Size,
  edit: PageEdit,
): OutputPixels {
  assertDimensions(source.width, source.height);
  if (source.data.length !== source.width * source.height * 4)
    throw new Error('잘못된 픽셀 버퍼입니다.');
  const data = transformPixels(new Uint8ClampedArray(source.data), edit);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]! / 255;
    for (let c = 0; c < 3; c++)
      data[i + c] = data[i + c]! * alpha + 255 * (1 - alpha);
    data[i + 3] = 255;
  }
  for (const region of edit.masks) {
    const mask = validateMask(region, bounds);
    const sx = source.width / bounds.width,
      sy = source.height / bounds.height;
    const x0 = Math.max(0, Math.floor(mask.x * sx) - 1),
      y0 = Math.max(0, Math.floor(mask.y * sy) - 1);
    const x1 = Math.min(
      source.width,
      Math.ceil((mask.x + mask.width) * sx) + 1,
    );
    const y1 = Math.min(
      source.height,
      Math.ceil((mask.y + mask.height) * sy) + 1,
    );
    const rgb = [1, 3, 5].map((offset) =>
      parseInt(mask.fill.slice(offset, offset + 2), 16),
    );
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * source.width + x) * 4;
        data[i] = rgb[0]!;
        data[i + 1] = rgb[1]!;
        data[i + 2] = rgb[2]!;
        data[i + 3] = 255;
      }
  }
  const geometry = editGeometry(source, edit);
  const output = new Uint8ClampedArray(data.length);
  for (let y = 0; y < source.height; y++) {
    const point = apply(geometry.matrix, { x: 0.5, y: y + 0.5 });
    for (let x = 0; x < source.width; x++) {
      const target =
        (Math.floor(point.y) * geometry.width + Math.floor(point.x)) * 4;
      const offset = (y * source.width + x) * 4;
      output[target] = data[offset]!;
      output[target + 1] = data[offset + 1]!;
      output[target + 2] = data[offset + 2]!;
      output[target + 3] = 255;
      point.x += geometry.matrix[0];
      point.y += geometry.matrix[1];
    }
  }
  return { width: geometry.width, height: geometry.height, data: output };
}
export function equalPixels(actual: OutputPixels, expected: OutputPixels) {
  if (
    actual.width !== expected.width ||
    actual.height !== expected.height ||
    actual.data.length !== expected.data.length ||
    actual.data.some((value, i) => value !== expected.data[i])
  )
    throw new Error('출력 픽셀 검증에 실패하여 다운로드를 차단했습니다.');
}
export function rgbPixels(page: OutputPixels) {
  const rgb = new Uint8Array(page.width * page.height * 3);
  for (let i = 0, j = 0; i < page.data.length; i += 4, j += 3) {
    rgb[j] = page.data[i]!;
    rgb[j + 1] = page.data[i + 1]!;
    rgb[j + 2] = page.data[i + 2]!;
  }
  return rgb;
}
