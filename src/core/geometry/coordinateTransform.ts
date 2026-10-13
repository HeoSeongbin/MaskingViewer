import { apply, inverse, multiply, scale, translate } from './transformMatrix';
import type { Matrix, Point, Size } from './transformMatrix';
export interface GeometryEdit {
  rotation: 0 | 90 | 180 | 270;
  flipX: boolean;
  flipY: boolean;
}
export interface Viewport {
  mode: 'fit' | 'width' | 'manual';
  zoom: number;
  pan: Point;
}
export const DEFAULT_VIEW: Viewport = {
  mode: 'fit',
  zoom: 1,
  pan: { x: 0, y: 0 },
};
export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 8;
export const clampZoom = (value: number) =>
  Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number.isFinite(value) ? value : 1));
export function editGeometry(size: Size, edit: GeometryEdit) {
  const rotations: Record<GeometryEdit['rotation'], Matrix> = {
    0: [1, 0, 0, 1, 0, 0],
    90: [0, 1, -1, 0, 0, 0],
    180: [-1, 0, 0, -1, 0, 0],
    270: [0, -1, 1, 0, 0, 0],
  };
  const raw = multiply(
    scale(edit.flipX ? -1 : 1, edit.flipY ? -1 : 1),
    rotations[edit.rotation],
  );
  const corners = [
    { x: 0, y: 0 },
    { x: size.width, y: 0 },
    { x: 0, y: size.height },
    { x: size.width, y: size.height },
  ].map((p) => apply(raw, p));
  const x = Math.min(...corners.map((p) => p.x)),
    y = Math.min(...corners.map((p) => p.y));
  return {
    matrix: multiply(translate(-x, -y), raw),
    width: Math.max(...corners.map((p) => p.x)) - x,
    height: Math.max(...corners.map((p) => p.y)) - y,
  };
}
export function constrainPan(pan: Point, content: Size, stage: Size): Point {
  const limit = (length: number, available: number) =>
    Math.max(0, (length - available) / 2 + Math.min(40, length / 2));
  const x = limit(content.width, stage.width),
    y = limit(content.height, stage.height);
  return {
    x: Math.max(-x, Math.min(x, pan.x)),
    y: Math.max(-y, Math.min(y, pan.y)),
  };
}
export function displayGeometry(
  source: Size,
  edit: GeometryEdit,
  view: Viewport,
  stage: Size,
) {
  const geometry = editGeometry(source, edit);
  const widthFit = Math.max(1, stage.width - 40) / geometry.width;
  const zoom = clampZoom(
    view.mode === 'fit'
      ? Math.min(widthFit, Math.max(1, stage.height - 40) / geometry.height, 1)
      : view.mode === 'width'
        ? widthFit
        : view.zoom,
  );
  const content = {
    width: geometry.width * zoom,
    height: geometry.height * zoom,
  };
  const pan = constrainPan(view.pan, content, stage);
  const placement = multiply(
    translate(
      (stage.width - content.width) / 2 + pan.x,
      (stage.height - content.height) / 2 + pan.y,
    ),
    scale(zoom),
  );
  return {
    ...geometry,
    zoom,
    pan,
    matrix: multiply(placement, geometry.matrix),
    placement,
  };
}
export function zoomAt(
  source: Size,
  edit: GeometryEdit,
  view: Viewport,
  stage: Size,
  pointer: Point,
  requested: number,
): Viewport {
  const current = displayGeometry(source, edit, view, stage);
  const original = apply(inverse(current.matrix), pointer);
  const zoom = clampZoom(requested);
  const next = displayGeometry(
    source,
    edit,
    { mode: 'manual', zoom, pan: { x: 0, y: 0 } },
    stage,
  );
  const projected = apply(next.matrix, original);
  return {
    mode: 'manual',
    zoom,
    pan: constrainPan(
      { x: pointer.x - projected.x, y: pointer.y - projected.y },
      { width: next.width * zoom, height: next.height * zoom },
      stage,
    ),
  };
}
export function screenToStage(
  point: Point,
  rect: { left: number; top: number; width: number; height: number },
  stage: Size,
): Point {
  return {
    x: ((point.x - rect.left) * stage.width) / rect.width,
    y: ((point.y - rect.top) * stage.height) / rect.height,
  };
}
export function sourcePoint(matrix: Matrix, point: Point): Point {
  return apply(inverse(matrix), point);
}
