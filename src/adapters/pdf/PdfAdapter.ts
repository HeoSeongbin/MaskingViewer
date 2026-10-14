import {
  assertPage,
  checkAbort,
  context2d,
  makeCanvas,
  previewSize,
  abortError,
  MAX_PAGES,
} from '../../core/document/DocumentModel';
import type { DocumentAdapter } from '../../core/document/DocumentModel';

export async function openPdf(
  file: File,
  signal: AbortSignal,
): Promise<DocumentAdapter> {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } =
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  checkAbort(signal);
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const base = `${import.meta.env.BASE_URL}pdfjs/`;
  const data = new Uint8Array(await file.arrayBuffer());
  checkAbort(signal);
  const task = pdfjs.getDocument({
    data,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
    iccUrl: `${base}iccs/`,
  });
  let passwordRequired = false;
  task.onPassword = () => {
    passwordRequired = true;
    void task.destroy();
  };
  const abort = () => {
    void task.destroy();
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const pdf = await task.promise;
    checkAbort(signal);
    if (pdf.numPages > MAX_PAGES)
      throw new Error(`문서는 최대 ${MAX_PAGES}페이지까지 열 수 있습니다.`);
    let disposed = false;
    return {
      pageCount: pdf.numPages,
      async getPageMetadata(index, cancel) {
        checkAbort(cancel);
        assertPage(index, pdf.numPages);
        if (disposed) throw abortError();
        const page = await pdf.getPage(index + 1);
        checkAbort(cancel);
        const viewport = page.getViewport({ scale: 1 });
        return {
          width: viewport.width,
          height: viewport.height,
          rotation: page.rotate,
          unit: 'pt',
        };
      },
      async renderPage(index, maxEdge, cancel, dpi) {
        assertPage(index, pdf.numPages);
        checkAbort(cancel);
        if (disposed) throw abortError();
        const page = await pdf.getPage(index + 1);
        checkAbort(cancel);
        const natural = page.getViewport({ scale: 1 });
        // PDF has no intrinsic pixel resolution. Preview uses at most 2 px/pt.
        const size = dpi
          ? {
              width: Math.ceil((natural.width * dpi) / 72),
              height: Math.ceil((natural.height * dpi) / 72),
            }
          : previewSize(
              Math.ceil(natural.width * 2),
              Math.ceil(natural.height * 2),
              maxEdge,
            );
        const viewport = page.getViewport({
          scale: dpi ? dpi / 72 : size.width / natural.width,
        });
        const canvas = makeCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        const rendering = page.render({
          canvas,
          canvasContext: context2d(canvas),
          viewport,
        });
        const stop = () => rendering.cancel();
        cancel.addEventListener('abort', stop, { once: true });
        try {
          await rendering.promise;
          checkAbort(cancel);
          return canvas;
        } finally {
          cancel.removeEventListener('abort', stop);
          page.cleanup();
        }
      },
      async dispose() {
        disposed = true;
        await task.destroy();
      },
    };
  } catch (error) {
    await task.destroy();
    if (signal.aborted) throw abortError();
    if (passwordRequired)
      throw new Error(
        '암호로 보호된 PDF입니다. 암호를 해제한 사본을 선택하세요. 현재 암호 입력은 지원하지 않습니다.',
        { cause: error },
      );
    throw error;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
