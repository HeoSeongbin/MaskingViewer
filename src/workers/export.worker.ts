import { composePixels } from '../core/export/pixels';
import type { OutputPixels } from '../core/export/pixels';
import type { Size } from '../core/geometry/transformMatrix';
import type { PageEdit } from '../stores/editStore';
import type { ComposedPage } from '../core/export/ExportWorker';
import type { ExportPage, ExportFile } from '../core/export/FinalizeExport';
self.onmessage = async (
  event: MessageEvent<{
    operation: string;
    source: OutputPixels;
    bounds: Size;
    edit: PageEdit;
    format: 'png' | 'jpeg' | 'tiff' | 'pdf';
    pages: ExportPage[];
    files: ExportFile[];
  }>,
) => {
  try {
    if (event.data.operation === 'finalize') {
      const { finalizeExport } = await import('../core/export/FinalizeExport');
      const result = await finalizeExport(
        event.data.pages,
        event.data.files,
        event.data.format,
        new AbortController().signal,
      );
      self.postMessage({ result }, { transfer: [result.bytes.buffer] });
      return;
    }
    const { source, bounds, edit, format } = event.data;
    const pixels = composePixels(source, bounds, edit);
    const result: ComposedPage = { pixels };
    if (format !== 'tiff' && typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(pixels.width, pixels.height);
      try {
        const context = canvas.getContext('2d');
        if (context && typeof canvas.convertToBlob === 'function') {
          context.putImageData(
            new ImageData(
              new Uint8ClampedArray(pixels.data),
              pixels.width,
              pixels.height,
            ),
            0,
            0,
          );
          result.blob = await canvas.convertToBlob({
            type: `image/${format}`,
            quality: 0.98,
          });
        }
      } finally {
        canvas.width = canvas.height = 0;
      }
    }
    self.postMessage({ result }, { transfer: [pixels.data.buffer] });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : '출력 Worker 처리 실패',
    });
  }
};
