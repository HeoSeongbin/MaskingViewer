import {
  assertDimensions,
  assertPage,
  checkAbort,
  context2d,
  makeCanvas,
  previewSize,
  abortError,
} from '../../core/document/DocumentModel';
import type {
  DocumentAdapter,
  DocumentFormat,
} from '../../core/document/DocumentModel';

import { inspectRasterDimensions } from './rasterDimensions';

async function loadImage(file: File, signal: AbortSignal) {
  checkAbort(signal);
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        image.src = '';
        reject(abortError());
      };
      const cleanup = () => signal.removeEventListener('abort', abort);
      image.onload = () => {
        cleanup();
        resolve();
      };
      image.onerror = () => {
        cleanup();
        reject(
          new Error(
            '이미지를 디코딩할 수 없습니다. 손상 파일 또는 브라우저 미지원 코덱입니다.',
          ),
        );
      };
      signal.addEventListener('abort', abort, { once: true });
      image.src = url;
    });
    checkAbort(signal);
    assertDimensions(image.naturalWidth, image.naturalHeight);
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function openRaster(
  file: File,
  format: DocumentFormat,
  signal: AbortSignal,
): Promise<DocumentAdapter> {
  inspectRasterDimensions(
    new Uint8Array(await file.slice(0, 1024 * 1024).arrayBuffer()),
    format,
  );
  checkAbort(signal);
  const first = await loadImage(file, signal);
  const metadata = {
    width: first.naturalWidth,
    height: first.naturalHeight,
    unit: 'px' as const,
    rotation: 0,
  };
  first.src = '';
  let disposed = false;
  return {
    pageCount: 1,
    ...(format === 'gif'
      ? {
          notice:
            'GIF는 첫 프레임만 표시합니다. 애니메이션 프레임 탐색은 아직 지원하지 않습니다.',
        }
      : {}),
    async getPageMetadata(index, abort) {
      checkAbort(abort);
      assertPage(index, 1);
      if (disposed) throw abortError();
      return metadata;
    },
    async renderPage(index, maxEdge, abort) {
      assertPage(index, 1);
      if (disposed) throw abortError();
      const image = await loadImage(file, abort);
      try {
        checkAbort(abort);
        const size = previewSize(metadata.width, metadata.height, maxEdge);
        const canvas = makeCanvas(size.width, size.height);
        context2d(canvas).drawImage(image, 0, 0, size.width, size.height);
        return canvas;
      } finally {
        image.src = '';
      }
    },
    async dispose() {
      disposed = true;
    },
  };
}
