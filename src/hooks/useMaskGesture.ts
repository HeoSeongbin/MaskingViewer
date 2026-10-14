import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { DEFAULT_EDIT, useEditStore } from '../stores/editStore';
import type { Matrix, Point, Size } from '../core/geometry/transformMatrix';
import { apply } from '../core/geometry/transformMatrix';
import {
  sourcePoint,
  screenToStage,
} from '../core/geometry/coordinateTransform';
import { normalizedRectangle } from '../core/geometry/rectangleUtils';
import {
  contains,
  maskCorners,
  MAX_MASKS,
  moveMask,
  resizeMask,
} from '../core/masking/MaskEngine';
import type { Corner, MaskRegion } from '../core/masking/MaskEngine';
interface Gesture {
  pointerId: number;
  start: Point;
  mask: MaskRegion;
  mode: 'create' | 'move' | Corner;
  matrix: Matrix;
}
export function useMaskGesture(
  key: string,
  bounds: Size,
  stage: Size,
  matrix: Matrix,
  ready: boolean,
) {
  const edit = useEditStore((state) => state.pages[key] ?? DEFAULT_EDIT);
  const selectedId = useEditStore((state) => state.selection[key]);
  const hidden = useEditStore((state) => state.hidden[key] ?? false);
  const tool = useEditStore((state) => state.tool);
  const gesture = useRef<Gesture | null>(null);
  const draftRef = useRef<MaskRegion | null>(null);
  const [draft, setDraft] = useState<MaskRegion | null>(null);
  const [error, setError] = useState('');
  const selected = edit.masks.find((mask) => mask.id === selectedId);
  const cancel = () => {
    gesture.current = null;
    draftRef.current = null;
    setDraft(null);
  };
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input,select,textarea,[contenteditable="true"]')
      )
        return;
      if (event.key === 'Escape') {
        cancel();
        useEditStore.getState().selectMask(key, null);
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        ['z', 'y'].includes(event.key.toLowerCase())
      )
        cancel();
      if (event.key === 'Delete' && selected) {
        event.preventDefault();
        cancel();
        useEditStore.getState().update(key, {
          masks: edit.masks.filter((mask) => mask.id !== selected.id),
        });
        useEditStore.getState().selectMask(key, null);
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  }, [key, edit.masks, selected]);
  const point = (event: ReactPointerEvent<HTMLDivElement>) =>
    screenToStage(
      { x: event.clientX, y: event.clientY },
      event.currentTarget.getBoundingClientRect(),
      stage,
    );
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tool !== 'mask' && tool !== 'select') return false;
    if (!ready || event.button !== 0) return true;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    setError('');
    const screen = point(event),
      original = sourcePoint(matrix, screen);
    const state = useEditStore.getState();
    if (hidden) {
      setError('마스킹 표시를 켠 뒤 편집하세요.');
      return true;
    }
    let mask: MaskRegion | undefined,
      mode: Gesture['mode'] = 'create';
    if (tool === 'mask') {
      if (
        !contains(
          { id: '', pageId: key, x: 0, y: 0, ...bounds, fill: '#000000' },
          original,
        )
      )
        return true;
      if (edit.masks.length >= MAX_MASKS) {
        setError(`페이지당 마스킹은 ${MAX_MASKS}개까지입니다.`);
        return true;
      }
      mask = {
        id: crypto.randomUUID(),
        pageId: key,
        x: original.x,
        y: original.y,
        width: 0,
        height: 0,
        fill: state.maskFill,
      };
    } else {
      if (selected)
        for (const [corner, position] of Object.entries(
          maskCorners(selected),
        )) {
          const screenCorner = apply(matrix, position);
          if (
            Math.hypot(screenCorner.x - screen.x, screenCorner.y - screen.y) <=
            10
          ) {
            mask = selected;
            mode = corner as Corner;
            break;
          }
        }
      if (!mask) {
        mask = [...edit.masks]
          .reverse()
          .find((candidate) => contains(candidate, original));
        mode = 'move';
      }
      state.selectMask(key, mask?.id ?? null);
    }
    if (mask) {
      gesture.current = {
        pointerId: event.pointerId,
        start: original,
        mask,
        mode,
        matrix,
      };
      draftRef.current = mask;
      setDraft(mask);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    return true;
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const original = sourcePoint(current.matrix, point(event));
    const next =
      current.mode === 'create'
        ? {
            ...current.mask,
            ...normalizedRectangle(current.start, original, bounds),
          }
        : current.mode === 'move'
          ? moveMask(
              current.mask,
              {
                x: original.x - current.start.x,
                y: original.y - current.start.y,
              },
              bounds,
            )
          : resizeMask(current.mask, current.mode, original, bounds);
    draftRef.current = next;
    setDraft(next);
  };
  const up = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (current && current.pointerId !== event.pointerId) return;
    if (current) move(event);
    const finished = draftRef.current;
    if (
      current &&
      current.pointerId === event.pointerId &&
      finished &&
      finished.width >= 1 &&
      finished.height >= 1
    ) {
      const state = useEditStore.getState(),
        masks = (state.pages[key] ?? DEFAULT_EDIT).masks;
      state.update(key, {
        masks:
          current.mode === 'create'
            ? [...masks, finished]
            : masks.map((mask) => (mask.id === finished.id ? finished : mask)),
      });
      state.selectMask(key, finished.id);
      if (current.mode === 'create') state.setTool('select');
    }
    cancel();
  };
  const masks = draft
    ? edit.masks.some((mask) => mask.id === draft.id)
      ? edit.masks.map((mask) => (mask.id === draft.id ? draft : mask))
      : [...edit.masks, draft]
    : edit.masks;
  return {
    down,
    move,
    up,
    cancel,
    active: () => gesture.current !== null,
    masks,
    selectedId,
    hidden,
    error,
  };
}
