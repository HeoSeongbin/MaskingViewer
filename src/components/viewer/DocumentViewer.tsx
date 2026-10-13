import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage } from 'react-konva';
import { useRenderedPage } from '../../hooks/useRenderedPage';
import type { DocumentModel } from '../../core/document/DocumentModel';

export function DocumentViewer({ document }: { document: DocumentModel }) {
  const { page, error } = useRenderedPage(
    document.id,
    document.currentPage,
    1800,
  );
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 400, height: 500 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: Math.max(1, entry.contentRect.width),
          height: Math.max(1, entry.contentRect.height),
        });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const scale = page
    ? Math.min(
        (size.width - 40) / page.canvas.width,
        (size.height - 40) / page.canvas.height,
        1,
      )
    : 1;
  const width = page ? page.canvas.width * Math.max(0.01, scale) : 0;
  const height = page ? page.canvas.height * Math.max(0.01, scale) : 0;
  return (
    <div
      ref={ref}
      className="document-stage"
      role="img"
      aria-label={`${document.name} ${document.currentPage + 1}페이지 미리보기`}
      aria-busy={!page && !error}
    >
      {error ? (
        <p role="alert" className="render-error">
          {error}
        </p>
      ) : !page ? (
        <p className="render-status" role="status">
          페이지 렌더링 중…
        </p>
      ) : (
        <Stage width={size.width} height={size.height}>
          <Layer listening={false}>
            <KonvaImage
              image={page.canvas}
              x={(size.width - width) / 2}
              y={(size.height - height) / 2}
              width={width}
              height={height}
            />
          </Layer>
        </Stage>
      )}
      {page && (
        <span className="page-dimensions">
          {Math.round(page.metadata.width)} × {Math.round(page.metadata.height)}{' '}
          {page.metadata.unit} · 화면 미리보기
        </span>
      )}
    </div>
  );
}
