import { describe, it, expect } from 'vitest';
import { validateTiff } from '../adapters/tiff/tiffValidation';
// Independent minimal classic TIFF fixture; keeps malformed-structure tests local.
function fixture() {
  const buffer = new ArrayBuffer(100);
  const view = new DataView(buffer);
  view.setUint16(0, 0x4949);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, 5, true);
  [
    [256, 1],
    [257, 1],
    [259, 1],
    [273, 90],
    [279, 1],
  ].forEach(([tag, value], i) => {
    const offset = 10 + i * 12;
    view.setUint16(offset, tag!, true);
    view.setUint16(offset + 2, 4, true);
    view.setUint32(offset + 4, 1, true);
    view.setUint32(offset + 8, value!, true);
  });
  return buffer;
}
describe('bounded TIFF structure checks', () => {
  it('reads a valid page without decoding pixels', () =>
    expect(validateTiff(fixture())).toEqual([
      { width: 1, height: 1, compression: 1, orientation: 1 },
    ]));
  it('rejects cyclic IFDs, invalid strip pointers, huge dimensions, and unsupported codecs', () => {
    const cyclic = fixture();
    new DataView(cyclic).setUint32(70, 8, true);
    expect(() => validateTiff(cyclic)).toThrow('페이지');
    const strip = fixture();
    new DataView(strip).setUint32(54, 200, true);
    expect(() => validateTiff(strip)).toThrow('픽셀');
    const huge = fixture();
    new DataView(huge).setUint32(18, 100000, true);
    expect(() => validateTiff(huge)).toThrow('한도');
    const codec = fixture();
    new DataView(codec).setUint32(42, 7, true);
    expect(() => validateTiff(codec)).toThrow('압축');
    expect(() => validateTiff(new ArrayBuffer(2))).toThrow('헤더');
  });
});
