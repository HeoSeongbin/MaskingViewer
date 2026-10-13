import { inspectFile } from './fileFormat';
import { checkAbort } from './DocumentModel';
import type { DocumentAdapter, DocumentFormat } from './DocumentModel';
export async function loadDocument(
  file: File,
  signal: AbortSignal,
): Promise<{ adapter: DocumentAdapter; format: DocumentFormat }> {
  const format = await inspectFile(file, signal);
  let adapter: DocumentAdapter;
  if (format === 'pdf') {
    const { openPdf } = await import('../../adapters/pdf/PdfAdapter');
    adapter = await openPdf(file, signal);
  } else if (format === 'tiff') {
    const { openTiff } = await import('../../adapters/tiff/TiffAdapter');
    adapter = await openTiff(file, signal);
  } else {
    const { openRaster } = await import('../../adapters/raster/RasterAdapter');
    adapter = await openRaster(file, format, signal);
  }
  try {
    checkAbort(signal);
    return { adapter, format };
  } catch (error) {
    await adapter.dispose();
    throw error;
  }
}
