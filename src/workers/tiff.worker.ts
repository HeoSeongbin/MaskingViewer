import pako from 'pako';
import { validateTiff } from '../adapters/tiff/tiffValidation';
import type { TiffPage } from '../adapters/tiff/tiffValidation';

let source: ArrayBuffer | null = null;
let pages: TiffPage[] = [];
self.onmessage = async (
  event: MessageEvent<{ id: number; buffer?: ArrayBuffer; index?: number }>,
) => {
  const { id, buffer, index } = event.data;
  try {
    if (buffer) {
      pages = validateTiff(buffer);
      source = buffer;
      self.postMessage({ id, pages });
      return;
    }
    if (!source || index === undefined || !pages[index])
      throw new Error('TIFF 페이지를 찾을 수 없습니다.');
    // UTIF's browser build reads self.pako; a Worker has no window/global script.
    (self as unknown as { pako: typeof pako }).pako = pako;
    const { default: UTIF } = await import('utif');
    const ifds = UTIF.decode(source);
    const ifd = ifds[index];
    if (!ifd) throw new Error('TIFF 디렉터리를 디코딩할 수 없습니다.');
    UTIF.decodeImage(source, ifd);
    const rgba = UTIF.toRGBA8(ifd);
    const page = pages[index]!;
    if (rgba.length !== page.width * page.height * 4)
      throw new Error('TIFF 픽셀 수가 페이지 크기와 일치하지 않습니다.');
    const pixels = new Uint8Array(rgba).buffer;
    self.postMessage({ id, pixels }, { transfer: [pixels] });
  } catch (error) {
    self.postMessage({
      id,
      error:
        error instanceof Error ? error.message : 'TIFF 디코딩에 실패했습니다.',
    });
  }
};
