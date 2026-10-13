import { MAX_PAGES, assertDimensions } from '../../core/document/DocumentModel';
export interface TiffPage {
  width: number;
  height: number;
  orientation: number;
  compression: number;
}

// Walk bounded classic IFDs before invoking the decoder; reject cyclic/out-of-range structures.
export function validateTiff(buffer: ArrayBuffer): TiffPage[] {
  const view = new DataView(buffer);
  if (buffer.byteLength < 8) throw new Error('TIFF 헤더가 손상되었습니다.');
  const little = view.getUint16(0) === 0x4949;
  if (
    (!little && view.getUint16(0) !== 0x4d4d) ||
    view.getUint16(2, little) !== 42
  )
    throw new Error('Classic TIFF만 지원합니다. BigTIFF는 지원하지 않습니다.');
  const u16 = (offset: number) => view.getUint16(offset, little);
  const u32 = (offset: number) => view.getUint32(offset, little);
  const seen = new Set<number>();
  const pages: TiffPage[] = [];
  let offset = u32(4);
  while (offset) {
    if (
      seen.has(offset) ||
      offset + 2 > buffer.byteLength ||
      pages.length >= MAX_PAGES
    )
      throw new Error(
        'TIFF 페이지 연결 정보가 손상되었거나 페이지 수 한도를 초과했습니다.',
      );
    seen.add(offset);
    const count = u16(offset);
    if (count > 256 || offset + 2 + count * 12 + 4 > buffer.byteLength)
      throw new Error('TIFF 디렉터리가 손상되었습니다.');
    const tags = new Map<number, number[]>();
    for (let index = 0; index < count; index++) {
      const entry = offset + 2 + index * 12;
      const tag = u16(entry);
      const type = u16(entry + 2);
      const length = u32(entry + 4);
      const unit = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8][type];
      if (!unit || length > 1_000_000)
        throw new Error('지원하지 않거나 잘못된 TIFF 태그입니다.');
      const bytes = length * unit;
      const start = bytes <= 4 ? entry + 8 : u32(entry + 8);
      if (start + bytes > buffer.byteLength)
        throw new Error('TIFF 태그가 파일 범위를 벗어났습니다.');
      if (
        [
          256, 257, 258, 259, 262, 273, 274, 277, 279, 284, 322, 323, 324, 325,
        ].includes(tag)
      ) {
        if (![1, 3, 4].includes(type))
          throw new Error('TIFF 이미지 태그 형식이 잘못되었습니다.');
        const values = Array.from({ length }, (_, i) =>
          type === 3
            ? u16(start + i * 2)
            : type === 4
              ? u32(start + i * 4)
              : view.getUint8(start + i),
        );
        tags.set(tag, values);
      }
    }
    const width = tags.get(256)?.[0] ?? 0;
    const height = tags.get(257)?.[0] ?? 0;
    assertDimensions(width, height);
    const compression = tags.get(259)?.[0] ?? 1;
    if (![1, 3, 4, 5, 8, 32773].includes(compression))
      throw new Error(
        `지원하지 않는 TIFF 압축 방식입니다 (${compression}). JPEG/구형 JPEG 등의 코덱은 아직 지원하지 않습니다.`,
      );
    const bits = tags.get(258) ?? [1];
    const samples = tags.get(277)?.[0] ?? 1;
    const photometric = tags.get(262)?.[0] ?? 1;
    if (
      !Number.isInteger(samples) ||
      samples < 1 ||
      samples > 4 ||
      bits.length > 4 ||
      (photometric === 2 && (samples < 3 || bits.some((bit) => bit !== 8))) ||
      ([3, 4].includes(compression) &&
        (samples !== 1 || bits.some((bit) => bit !== 1)))
    )
      throw new Error(
        'TIFF 채널 또는 압축과 비트 깊이 조합을 지원하지 않습니다.',
      );
    if (
      !bits.every((bit) => bit === 1 || bit === 8) ||
      (tags.get(284)?.[0] ?? 1) !== 1 ||
      ![0, 1, 2, 3].includes(tags.get(262)?.[0] ?? 1)
    )
      throw new Error(
        '이 TIFF의 색상/비트 깊이/planar 구성은 아직 지원하지 않습니다.',
      );
    if (tags.has(324) || tags.has(322))
      throw new Error(
        '타일 기반 TIFF는 아직 지원하지 않습니다. Strip 기반 TIFF를 선택하세요.',
      );
    const starts = tags.get(273);
    const lengths = tags.get(279);
    if (
      !starts ||
      !lengths ||
      starts.length !== lengths.length ||
      !starts.length ||
      starts.some(
        (start, i) =>
          start + (lengths[i] ?? 0) > buffer.byteLength || !lengths[i],
      )
    )
      throw new Error('TIFF 픽셀 데이터가 손상되었습니다.');
    const orientation = tags.get(274)?.[0] ?? 1;
    if (orientation < 1 || orientation > 8)
      throw new Error('TIFF 방향 정보가 잘못되었습니다.');
    pages.push({ width, height, orientation, compression });
    offset = u32(offset + 2 + count * 12);
  }
  if (!pages.length) throw new Error('TIFF에 이미지 페이지가 없습니다.');
  return pages;
}
