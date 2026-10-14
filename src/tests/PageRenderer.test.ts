import { describe, it, expect, vi } from 'vitest';
import { PageRenderer } from '../core/document/PageRenderer';
import type { DocumentAdapter } from '../core/document/DocumentModel';
function adapter(): DocumentAdapter {
  return {
    pageCount: 2,
    getPageMetadata: vi.fn(async () => ({
      width: 10,
      height: 10,
      unit: 'px' as const,
      rotation: 0,
    })),
    renderPage: vi.fn(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 10;
      canvas.height = 10;
      return canvas;
    }),
    dispose: vi.fn(async () => {}),
  };
}
describe('render resource lifecycle', () => {
  it('keeps bounded cache accounting across repeated document lifecycles', async () => {
    const renderer = new PageRenderer(800);
    for (let cycle = 0; cycle < 20; cycle++) {
      renderer.register('a', adapter());
      for (let index = 0; index < 2; index++)
        await renderer.render('a', index, 160, new AbortController().signal);
      expect(renderer.diagnostics().cacheBytes).toBeLessThanOrEqual(800);
      await renderer.close('a');
      expect(renderer.diagnostics()).toEqual({
        documents: 0,
        cachedPages: 0,
        cacheBytes: 0,
        budgetBytes: 800,
      });
    }
  });
  it('exports without caching and checks output pixel budget before decode', async () => {
    const renderer = new PageRenderer();
    const source = adapter();
    renderer.register('a', source);
    const signal = new AbortController().signal;
    await expect(
      renderer.renderExport('a', 0, 150, signal, 99),
    ).rejects.toThrow('메모리 예산');
    expect(source.renderPage).not.toHaveBeenCalled();
    await renderer.renderExport('a', 0, 300, signal);
    await renderer.renderExport('a', 0, 300, signal);
    expect(source.renderPage).toHaveBeenCalledTimes(2);
    expect(source.renderPage).toHaveBeenLastCalledWith(0, 16384, signal, 300);
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      renderer.renderExport('a', 0, 150, cancelled.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('does not resurrect a page that completes after its document was closed', async () => {
    const renderer = new PageRenderer();
    const source = adapter();
    renderer.register('a', source);
    let finish: (canvas: HTMLCanvasElement) => void = () => {};
    const entered = new Promise<void>((resolve) => {
      vi.mocked(source.renderPage).mockImplementation(() => {
        resolve();
        return new Promise((done) => {
          finish = done;
        });
      });
    });
    const pending = renderer.render('a', 0, 160, new AbortController().signal);
    await entered;
    await renderer.close('a');
    const canvas = document.createElement('canvas');
    canvas.width = 10;
    canvas.height = 10;
    finish(canvas);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(canvas.width).toBe(0);
  });
  it('reuses cached results and evicts under the byte budget', async () => {
    const renderer = new PageRenderer(400);
    const source = adapter();
    renderer.register('a', source);
    const signal = new AbortController().signal;
    await renderer.render('a', 0, 160, signal);
    await renderer.render('a', 0, 160, signal);
    expect(source.renderPage).toHaveBeenCalledTimes(1);
    await renderer.render('a', 1, 160, signal);
    await renderer.render('a', 0, 160, signal);
    expect(source.renderPage).toHaveBeenCalledTimes(3);
    await renderer.close('a');
    expect(source.dispose).toHaveBeenCalledOnce();
    await expect(renderer.render('a', 0, 160, signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
  it('skips cancelled requests and recovers from a rendering error', async () => {
    const renderer = new PageRenderer();
    const source = adapter();
    renderer.register('a', source);
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      renderer.render('a', 0, 160, cancelled.signal),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(source.renderPage).not.toHaveBeenCalled();
    vi.mocked(source.renderPage).mockRejectedValueOnce(new Error('bad page'));
    await expect(
      renderer.render('a', 0, 160, new AbortController().signal),
    ).rejects.toThrow('bad page');
    await expect(
      renderer.render('a', 1, 160, new AbortController().signal),
    ).resolves.toHaveProperty('canvas');
  });
});
