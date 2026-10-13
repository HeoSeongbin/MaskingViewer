import { describe, it, expect } from 'vitest';
import { inspectRasterDimensions } from '../adapters/raster/rasterDimensions';
describe('pre-decode raster limits', () => {
  it('blocks oversized PNG before a browser decoder allocates pixels', () => {
    const bytes = new Uint8Array(24);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 20000);
    view.setUint32(20, 10000);
    expect(() => inspectRasterDimensions(bytes, 'png')).toThrow('한도');
    view.setUint32(16, 240);
    view.setUint32(20, 160);
    expect(inspectRasterDimensions(bytes, 'png')).toEqual({
      width: 240,
      height: 160,
    });
  });
  it('rejects truncated dimensions and JPEG without a SOF', () => {
    expect(() => inspectRasterDimensions(new Uint8Array(3), 'gif')).toThrow(
      '손상',
    );
    expect(() =>
      inspectRasterDimensions(new Uint8Array([255, 216, 255, 217]), 'jpeg'),
    ).toThrow('크기');
  });
});
