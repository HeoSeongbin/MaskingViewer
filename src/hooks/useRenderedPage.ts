import { useEffect, useState } from 'react';
import { pageRenderer } from '../core/document/PageRenderer';
import type { RenderedPage } from '../core/document/PageRenderer';
import { documentSignal } from '../features/file-upload/documentActions';

export function useRenderedPage(
  id: string | undefined,
  index: number,
  maxEdge: number,
) {
  const [result, setResult] = useState<{
    key: string;
    page?: RenderedPage;
    error?: string;
  }>({ key: '' });
  const key = `${id}:${index}:${maxEdge}`;
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    const lifetime = documentSignal(id);
    const close = () => controller.abort();
    lifetime?.addEventListener('abort', close, { once: true });
    if (lifetime?.aborted) controller.abort();
    void pageRenderer
      .render(id, index, maxEdge, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setResult({ key, page });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            key,
            error:
              error instanceof Error
                ? error.message
                : '페이지 렌더링에 실패했습니다.',
          });
      });
    return () => {
      controller.abort();
      lifetime?.removeEventListener('abort', close);
    };
  }, [id, index, maxEdge, key]);
  return result.key === key ? result : { key };
}
