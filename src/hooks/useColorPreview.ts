import { useEffect, useState } from 'react';
import type { PageEdit } from '../stores/editStore';
import { context2d, makeCanvas } from '../core/document/DocumentModel';
import { transformPixels } from '../core/image/colorTransform';
export function useColorPreview(
  canvas: HTMLCanvasElement | undefined,
  edit: PageEdit,
) {
  const { invert, tone, brightness, contrast } = edit;
  const signature = JSON.stringify([invert, tone, brightness, contrast]);
  const [result, setResult] = useState<{
    source: HTMLCanvasElement;
    signature: string;
    canvas?: HTMLCanvasElement;
    error?: string;
  }>();
  const identity =
    !invert && tone === 'original' && brightness === 0 && contrast === 0;
  useEffect(() => {
    if (!canvas || identity) return;
    let cancelled = false;
    let worker: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const output = makeCanvas(canvas.width, canvas.height);
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const context = context2d(output);
        context.drawImage(canvas, 0, 0);
        const image = context.getImageData(0, 0, output.width, output.height);
        const finish = (data: Uint8ClampedArray) => {
          if (cancelled) return;
          image.data.set(data);
          context.putImageData(image, 0, 0);
          setResult({ source: canvas, signature, canvas: output });
        };
        if (typeof Worker === 'undefined')
          finish(
            transformPixels(image.data, { invert, tone, brightness, contrast }),
          );
        else {
          worker = new Worker(
            new URL('../workers/color.worker.ts', import.meta.url),
            { type: 'module' },
          );
          worker.onmessage = (event: MessageEvent<{ buffer: ArrayBuffer }>) => {
            clearTimeout(timeout);
            finish(new Uint8ClampedArray(event.data.buffer));
            worker?.terminate();
          };
          worker.onerror = () => {
            clearTimeout(timeout);
            if (!cancelled)
              setResult({
                source: canvas,
                signature,
                error:
                  '색상 처리에 실패했습니다. 원본 색상으로 복원한 뒤 다시 시도하세요.',
              });
            worker?.terminate();
          };
          timeout = setTimeout(() => {
            worker?.terminate();
            if (!cancelled)
              setResult({
                source: canvas,
                signature,
                error:
                  '색상 처리 시간이 초과되었습니다. 원본 색상으로 복원하세요.',
              });
          }, 10000);
          // Transfer a copy: ImageData remains usable for putImageData after response.
          const buffer = image.data.slice().buffer;
          worker.postMessage(
            { buffer, edit: { invert, tone, brightness, contrast } },
            [buffer],
          );
        }
      } catch (error) {
        setResult({
          source: canvas,
          signature,
          error: error instanceof Error ? error.message : '색상 처리 오류',
        });
      }
    });
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      worker?.terminate();
      output.width = 0;
      output.height = 0;
    };
  }, [canvas, identity, signature, invert, tone, brightness, contrast]);
  if (identity) return { canvas, pending: false };
  return result && result.source === canvas && result.signature === signature
    ? { canvas: result.canvas, error: result.error, pending: false }
    : { canvas: undefined, pending: true };
}
