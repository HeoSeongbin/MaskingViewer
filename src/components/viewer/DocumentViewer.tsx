import { useEffect, useRef, useState } from 'react';
import {
  Stage,
  Layer,
  Group,
  Rect,
  Circle,
  Image as KonvaImage,
} from 'react-konva';
import { useMaskGesture } from '../../hooks/useMaskGesture';
import { maskCorners } from '../../core/masking/MaskEngine';
import { useRenderedPage } from '../../hooks/useRenderedPage';
import { useColorPreview } from '../../hooks/useColorPreview';
import type { DocumentModel } from '../../core/document/DocumentModel';
import { DEFAULT_EDIT, pageKey, useEditStore } from '../../stores/editStore';
import {
  DEFAULT_VIEW,
  displayGeometry,
  zoomAt,
  screenToStage,
  sourcePoint,
  constrainPan,
} from '../../core/geometry/coordinateTransform';
import type { Point } from '../../core/geometry/transformMatrix';
import { EditToolbar } from '../toolbar/EditToolbar';
export function DocumentViewer({ document }: { document: DocumentModel }) {
  const { page, error } = useRenderedPage(
    document.id,
    document.currentPage,
    1800,
  );
  const key = pageKey(document.id, document.currentPage);
  const edit = useEditStore((state) => state.pages[key] ?? DEFAULT_EDIT);
  const view = useEditStore((state) => state.views[key] ?? DEFAULT_VIEW);
  const tool = useEditStore((state) => state.tool);
  const preview = useColorPreview(page?.canvas, edit);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; point: Point; pan: Point } | null>(
    null,
  );
  const [size, setSize] = useState({ width: 400, height: 500 });
  const [pointer, setPointer] = useState<Point | null>(null);
  const source = page?.metadata ?? { width: 1, height: 1 };
  const display = displayGeometry(source, edit, view, size);
  const masking = useMaskGesture(
    key,
    source,
    size,
    display.matrix,
    Boolean(preview.canvas && !error),
  );
  useEffect(() => {
    if (page) useEditStore.getState().reportZoom(key, display.zoom);
  }, [key, display.zoom, page]);
  const setView = (next: typeof view) =>
    useEditStore.getState().setView(key, next);
  const panTo = (pan: Point) =>
    setView({
      ...view,
      pan: constrainPan(
        pan,
        {
          width: display.width * display.zoom,
          height: display.height * display.zoom,
        },
        size,
      ),
    });
  const zoom = (
    value: number,
    point: Point = { x: size.width / 2, y: size.height / 2 },
  ) => setView(zoomAt(source, edit, view, size, point, value));
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
  useEffect(() => {
    const element = ref.current;
    if (!element || !page) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (masking.active()) return;
      const factor =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1;
      if (event.ctrlKey)
        zoom(
          display.zoom *
            Math.exp(
              -Math.max(-100, Math.min(100, event.deltaY * factor)) * 0.002,
            ),
          screenToStage(
            { x: event.clientX, y: event.clientY },
            element.getBoundingClientRect(),
            size,
          ),
        );
      else
        panTo({
          x:
            display.pan.x -
            event.deltaX * factor -
            (event.shiftKey ? event.deltaY * factor : 0),
          y: display.pan.y - (event.shiftKey ? 0 : event.deltaY * factor),
        });
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  });
  const matrix = display.matrix;
  const geometryPoint = pointer ? sourcePoint(matrix, pointer) : null;
  const errorMessage = error ?? preview.error;
  return (
    <>
      {page && (
        <EditToolbar
          pageId={key}
          zoom={display.zoom}
          onZoom={(value) => zoom(value)}
        />
      )}
      <div
        ref={ref}
        className={`document-stage tool-${tool}`}
        role="img"
        aria-label={`${document.name} ${document.currentPage + 1}페이지 미리보기`}
        aria-busy={!errorMessage && (!page || preview.pending)}
        tabIndex={0}
        onPointerDown={(event) => {
          if (masking.down(event)) return;
          if (tool !== 'hand' || !page || event.button !== 0) return;
          const point = screenToStage(
            { x: event.clientX, y: event.clientY },
            event.currentTarget.getBoundingClientRect(),
            size,
          );
          drag.current = {
            pointerId: event.pointerId,
            point,
            pan: display.pan,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          const point = screenToStage(
            { x: event.clientX, y: event.clientY },
            event.currentTarget.getBoundingClientRect(),
            size,
          );
          setPointer(point);
          masking.move(event);
          const start = drag.current;
          if (start && start.pointerId === event.pointerId)
            panTo({
              x: start.pan.x + point.x - start.point.x,
              y: start.pan.y + point.y - start.point.y,
            });
        }}
        onPointerUp={(event) => {
          masking.up(event);
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          masking.cancel();
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          masking.cancel();
          drag.current = null;
        }}
        onPointerLeave={() => setPointer(null)}
        onKeyDown={(event) => {
          const steps: Record<string, Point> = {
            ArrowLeft: { x: 40, y: 0 },
            ArrowRight: { x: -40, y: 0 },
            ArrowUp: { x: 0, y: 40 },
            ArrowDown: { x: 0, y: -40 },
          };
          const step = steps[event.key];
          if (step && page) {
            event.preventDefault();
            panTo({ x: display.pan.x + step.x, y: display.pan.y + step.y });
          }
        }}
        data-zoom={display.zoom}
        data-pan-x={display.pan.x}
        data-pan-y={display.pan.y}
        data-rotation={edit.rotation}
      >
        {errorMessage ? (
          <p role="alert" className="render-error">
            {errorMessage}
          </p>
        ) : !page || !preview.canvas ? (
          <p className="render-status" role="status">
            {page ? '색상 처리 중…' : '페이지 렌더링 중…'}
          </p>
        ) : (
          <Stage width={size.width} height={size.height}>
            <Layer listening={false}>
              <Group
                x={matrix[4]}
                y={matrix[5]}
                rotation={edit.rotation}
                scaleX={
                  display.zoom *
                  ((edit.rotation % 180 ? edit.flipY : edit.flipX) ? -1 : 1)
                }
                scaleY={
                  display.zoom *
                  ((edit.rotation % 180 ? edit.flipX : edit.flipY) ? -1 : 1)
                }
              >
                <KonvaImage
                  image={preview.canvas}
                  width={source.width}
                  height={source.height}
                />
                {!masking.hidden &&
                  masking.masks.map((mask) => (
                    <Group key={mask.id}>
                      <Rect
                        x={mask.x}
                        y={mask.y}
                        width={mask.width}
                        height={mask.height}
                        fill={mask.fill}
                      />
                      {tool === 'select' && mask.id === masking.selectedId && (
                        <>
                          <Rect
                            x={mask.x}
                            y={mask.y}
                            width={mask.width}
                            height={mask.height}
                            stroke="#00b8ff"
                            strokeWidth={2 / display.zoom}
                          />
                          {Object.entries(maskCorners(mask)).map(
                            ([corner, point]) => (
                              <Circle
                                key={corner}
                                x={point.x}
                                y={point.y}
                                radius={5 / display.zoom}
                                fill="#ffffff"
                                stroke="#007db3"
                                strokeWidth={1 / display.zoom}
                              />
                            ),
                          )}
                        </>
                      )}
                    </Group>
                  ))}
              </Group>
            </Layer>
          </Stage>
        )}
        {page && (
          <span className="page-dimensions">
            {Math.round(page.metadata.width)} ×{' '}
            {Math.round(page.metadata.height)} {page.metadata.unit} · 편집{' '}
            {Math.round(display.width)} × {Math.round(display.height)} ·{' '}
            <span data-testid="zoom-status">
              {Math.round(display.zoom * 100)}%
            </span>
            {page.metadata.unit === 'pt' ? ' (1pt = 1px 기준)' : ''}
            {geometryPoint
              ? ` · 원본 좌표 ${geometryPoint.x.toFixed(1)}, ${geometryPoint.y.toFixed(1)}`
              : ''}
          </span>
        )}
        {masking.error && (
          <p role="alert" className="mask-error">
            {masking.error}
          </p>
        )}
      </div>
    </>
  );
}
