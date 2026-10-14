import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { composePage, workerJob } from '../core/export/ExportWorker';
import {
  composePixels,
  composePixelsAsync,
  equalPixelsAsync,
} from '../core/export/pixels';
import { DEFAULT_EDIT } from '../stores/editStore';
import { exportDocument } from '../core/export/ExportPipeline';
import { pageRenderer } from '../core/document/PageRenderer';
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
}
beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('output Worker lifecycle', () => {
  it('rejects simultaneous exports and releases the lock after cancelled rendering', async () => {
    let rejectRender: (reason: Error) => void = () => {};
    const render = vi.spyOn(pageRenderer, 'renderExport').mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectRender = reject;
        }),
    );
    const document = {
      id: 'd',
      name: 'a.png',
      pageCount: 1,
      currentPage: 0,
      format: 'png' as const,
      size: 1,
    };
    const cancel = new AbortController();
    const options = { format: 'png' as const, all: false, dpi: 150 as const };
    const first = exportDocument(
      document,
      {},
      options,
      cancel.signal,
      () => {},
    );
    await expect(
      exportDocument(
        document,
        {},
        options,
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow('다른 출력 작업');
    cancel.abort();
    rejectRender(new DOMException('cancelled', 'AbortError'));
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    render.mockRejectedValueOnce(new Error('new rendering failure'));
    await expect(
      exportDocument(
        document,
        {},
        options,
        new AbortController().signal,
        () => {},
      ),
    ).rejects.toThrow('new rendering failure');
    expect(render).toHaveBeenCalledTimes(2);
  });
  it('transfers owned buffers and terminates after success', async () => {
    const buffer = new ArrayBuffer(4);
    const promise = workerJob<{ bytes: Uint8Array }>(
      { operation: 'test' },
      [buffer],
      new AbortController().signal,
    );
    const worker = FakeWorker.instances[0]!;
    expect(worker.postMessage).toHaveBeenCalledWith({ operation: 'test' }, [
      buffer,
    ]);
    worker.onmessage!({
      data: { result: { bytes: new Uint8Array([1]) } },
    } as MessageEvent);
    expect((await promise).bytes).toEqual(new Uint8Array([1]));
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(worker.onmessage).toBeNull();
  });
  for (const failure of [
    'error',
    'messageerror',
    'invalid',
    'reported',
  ] as const)
    it(`terminates on ${failure} and rejects`, async () => {
      const promise = workerJob({}, [], new AbortController().signal);
      const assertion = expect(promise).rejects.toThrow();
      const worker = FakeWorker.instances[0]!;
      if (failure === 'error') worker.onerror!();
      else if (failure === 'messageerror') worker.onmessageerror!();
      else
        worker.onmessage!({
          data: failure === 'invalid' ? {} : { error: 'bad output' },
        } as MessageEvent);
      await assertion;
      expect(worker.terminate).toHaveBeenCalledOnce();
    });
  it('terminates immediately on cancellation and ignores future messages', async () => {
    const cancel = new AbortController();
    const promise = workerJob({}, [], cancel.signal);
    const assertion = expect(promise).rejects.toMatchObject({
      name: 'AbortError',
    });
    cancel.abort();
    await assertion;
    expect(FakeWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    expect(FakeWorker.instances[0]!.onmessage).toBeNull();
  });
  it('rejects timed out jobs and clears their handlers', async () => {
    vi.useFakeTimers();
    const promise = workerJob({}, [], new AbortController().signal, 100);
    const assertion = expect(promise).rejects.toThrow('시간이 초과');
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(FakeWorker.instances[0]!.terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not construct a Worker for an already aborted request', () => {
    const cancel = new AbortController();
    cancel.abort();
    expect(() => workerJob({}, [], cancel.signal)).toThrow();
    expect(FakeWorker.instances).toHaveLength(0);
  });
  it('reports constructor and postMessage errors without retaining a worker', async () => {
    const pending = workerJob({}, [], new AbortController().signal);
    const worker = FakeWorker.instances[0]!;
    worker.onmessage!({ data: { error: 'cleanup' } } as MessageEvent);
    await expect(pending).rejects.toThrow('cleanup');
    vi.stubGlobal(
      'Worker',
      class {
        constructor() {
          throw new Error('cannot start');
        }
      },
    );
    await expect(
      workerJob({}, [], new AbortController().signal),
    ).rejects.toThrow('cannot start');
    vi.stubGlobal(
      'Worker',
      class extends FakeWorker {
        constructor() {
          super();
          this.postMessage.mockImplementation(() => {
            throw new Error('transfer failed');
          });
        }
      },
    );
    await expect(
      workerJob({}, [], new AbortController().signal),
    ).rejects.toThrow('transfer failed');
    expect(FakeWorker.instances.at(-1)!.terminate).toHaveBeenCalledOnce();
  });
});
describe('cooperative fallback', () => {
  it('matches synchronous composition for colors, masking, rotation and both flips', async () => {
    const source = {
      width: 20,
      height: 40,
      data: new Uint8ClampedArray(3200).fill(200),
    };
    const edit = {
      ...DEFAULT_EDIT,
      rotation: 90 as const,
      flipX: true,
      flipY: true,
      invert: true,
      masks: [
        {
          id: 'm',
          pageId: 'p',
          x: 2,
          y: 3,
          width: 5,
          height: 9,
          fill: '#336699',
        },
      ],
    };
    const actual = await composePixelsAsync(
      source,
      source,
      edit,
      new AbortController().signal,
    );
    expect(actual).toEqual(composePixels(source, source, edit));
    expect(source.data.every((v) => v === 200)).toBe(true);
  });
  it('cancels between chunks and pixel verification rejects corruption', async () => {
    const source = {
      width: 64,
      height: 64,
      data: new Uint8ClampedArray(16384),
    };
    const cancel = new AbortController();
    const pending = composePixelsAsync(
      source,
      source,
      DEFAULT_EDIT,
      cancel.signal,
    );
    cancel.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      equalPixelsAsync(
        source,
        { ...source, data: new Uint8ClampedArray(16384).fill(1) },
        new AbortController().signal,
      ),
    ).rejects.toThrow('픽셀 검증');
  });
  it('limits unsupported Worker environments before large composition', async () => {
    vi.stubGlobal('Worker', undefined);
    await expect(
      composePage(
        { width: 1001, height: 1000, data: new Uint8ClampedArray() },
        { width: 1001, height: 1000 },
        DEFAULT_EDIT,
        'png',
        new AbortController().signal,
      ),
    ).rejects.toThrow('100만 픽셀');
    const source = {
      width: 1,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 255]),
    };
    expect(
      (
        await composePage(
          source,
          source,
          DEFAULT_EDIT,
          'png',
          new AbortController().signal,
        )
      ).pixels.data,
    ).toEqual(source.data);
  });
});
