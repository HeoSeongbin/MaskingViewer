import { abortError, checkAbort } from './DocumentModel';
import type { DocumentAdapter, PageMetadata } from './DocumentModel';

export interface RenderedPage {
  canvas: HTMLCanvasElement;
  metadata: PageMetadata;
}
export class PageRenderer {
  private adapters = new Map<string, DocumentAdapter>();
  private cache = new Map<string, RenderedPage>();
  private tail: Promise<unknown> = Promise.resolve();
  private bytes = 0;
  constructor(private budget = 48 * 1024 * 1024) {}
  register(id: string, adapter: DocumentAdapter) {
    this.adapters.set(id, adapter);
  }
  async render(
    id: string,
    index: number,
    maxEdge: number,
    signal: AbortSignal,
  ): Promise<RenderedPage> {
    // One decode at a time bounds full-resolution intermediates. Cancelled queue entries skip work.
    const result = this.tail
      .catch(() => undefined)
      .then(async () => {
        checkAbort(signal);
        const adapter = this.adapters.get(id);
        if (!adapter) throw abortError();
        const key = `${id}:${index}:${maxEdge}`;
        const cached = this.cache.get(key);
        if (cached) {
          this.cache.delete(key);
          this.cache.set(key, cached);
          return cached;
        }
        const metadata = await adapter.getPageMetadata(index, signal);
        const canvas = await adapter.renderPage(index, maxEdge, signal);
        if (signal.aborted || this.adapters.get(id) !== adapter) {
          canvas.width = 0;
          canvas.height = 0;
          throw abortError();
        }
        const page = { canvas, metadata };
        const cost = canvas.width * canvas.height * 4;
        while (this.bytes + cost > this.budget && this.cache.size) {
          const oldest = this.cache.entries().next().value;
          if (!oldest) break;
          this.bytes -= oldest[1].canvas.width * oldest[1].canvas.height * 4;
          this.cache.delete(oldest[0]); // UI may still reference a canvas; release by GC after unmount.
        }
        if (cost <= this.budget) {
          this.cache.set(key, page);
          this.bytes += cost;
        }
        return page;
      });
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
  async close(id: string) {
    const adapter = this.adapters.get(id);
    this.adapters.delete(id);
    for (const [key, page] of this.cache)
      if (key.startsWith(`${id}:`)) {
        this.bytes -= page.canvas.width * page.canvas.height * 4;
        this.cache.delete(key);
      }
    await adapter?.dispose();
  }
  async renderExport(
    id: string,
    index: number,
    dpi: number,
    signal: AbortSignal,
    pixelBudget = 16_000_000,
  ): Promise<RenderedPage> {
    const result = this.tail
      .catch(() => undefined)
      .then(async () => {
        checkAbort(signal);
        const adapter = this.adapters.get(id);
        if (!adapter) throw abortError();
        const metadata = await adapter.getPageMetadata(index, signal);
        const factor = metadata.unit === 'pt' ? dpi / 72 : 1;
        if (
          Math.ceil(metadata.width * factor) *
            Math.ceil(metadata.height * factor) >
          pixelBudget
        )
          throw new Error(
            '출력 메모리 예산을 초과합니다. 현재 페이지만 또는 낮은 PDF DPI로 출력하세요.',
          );
        const canvas = await adapter.renderPage(index, 16384, signal, dpi);
        if (signal.aborted || this.adapters.get(id) !== adapter) {
          canvas.width = canvas.height = 0;
          throw abortError();
        }
        return { canvas, metadata };
      });
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
export const pageRenderer = new PageRenderer();
