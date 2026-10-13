import { useEffect, useRef } from 'react';
import { useEditStore, DEFAULT_EDIT } from '../../stores/editStore';
import type { PageEdit } from '../../stores/editStore';
import {
  DEFAULT_VIEW,
  MAX_ZOOM,
  MIN_ZOOM,
} from '../../core/geometry/coordinateTransform';
import type { Viewport } from '../../core/geometry/coordinateTransform';
function ColorSlider({
  pageId,
  field,
  label,
}: {
  pageId: string;
  field: 'brightness' | 'contrast';
  label: string;
}) {
  const edit = useEditStore((state) => state.pages[pageId] ?? DEFAULT_EDIT);
  const before = useRef<PageEdit | null>(null);
  const commit = () => {
    if (before.current) {
      useEditStore.getState().commit(pageId, before.current);
      before.current = null;
    }
  };
  return (
    <label className="color-slider">
      {label} <output>{edit[field]}</output>
      <input
        type="range"
        min="-100"
        max="100"
        value={edit[field]}
        aria-label={label}
        onChange={(event) => {
          before.current ??= edit;
          useEditStore
            .getState()
            .update(pageId, { [field]: Number(event.target.value) }, false);
        }}
        onPointerUp={commit}
        onPointerCancel={commit}
        onBlur={commit}
        onKeyUp={commit}
      />
    </label>
  );
}
export function EditToolbar({
  pageId,
  zoom,
  onZoom,
}: {
  pageId: string;
  zoom: number;
  onZoom: (value: number) => void;
}) {
  const edit = useEditStore((state) => state.pages[pageId] ?? DEFAULT_EDIT);
  const history = useEditStore((state) => state.history[pageId]);
  const tool = useEditStore((state) => state.tool);
  const update = (patch: Partial<PageEdit>) =>
    useEditStore.getState().update(pageId, patch);
  const fit = (mode: Viewport['mode']) =>
    useEditStore.getState().setView(pageId, { ...DEFAULT_VIEW, mode });
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input,select,textarea,[contenteditable="true"]')
      )
        return;
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')
      ) {
        event.preventDefault();
        const action =
          event.key.toLowerCase() === 'y' || event.shiftKey ? 'redo' : 'undo';
        useEditStore.getState()[action](pageId);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [pageId]);
  return (
    <>
      <div className="edit-toolbar" role="toolbar" aria-label="문서 편집 도구">
        <div className="tool-group">
          <button
            aria-pressed={tool === 'inspect'}
            onClick={() => useEditStore.getState().setTool('inspect')}
            title="원본 좌표 확인"
          >
            좌표 확인
          </button>
          <button
            aria-pressed={tool === 'hand'}
            onClick={() => useEditStore.getState().setTool('hand')}
            title="드래그로 화면 이동"
          >
            손 도구
          </button>
        </div>
        <div className="tool-group">
          <button aria-label="축소" onClick={() => onZoom(zoom / 1.25)}>
            −
          </button>
          <label>
            배율{' '}
            <input
              key={Math.round(zoom * 10000)}
              aria-label="확대 비율"
              type="number"
              min={MIN_ZOOM * 100}
              max={MAX_ZOOM * 100}
              step="1"
              defaultValue={Math.round(zoom * 100)}
              onBlur={(event) => {
                if (event.target.value && event.target.validity.valid)
                  onZoom(Number(event.target.value) / 100);
                else event.target.value = String(Math.round(zoom * 100));
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
              }}
            />
            %
          </label>
          <button aria-label="확대" onClick={() => onZoom(zoom * 1.25)}>
            +
          </button>
          <button onClick={() => onZoom(1)}>100%</button>
          <button onClick={() => fit('fit')}>화면 맞춤</button>
          <button onClick={() => fit('width')}>너비 맞춤</button>
        </div>
        <div className="tool-group">
          <button
            onClick={() =>
              update({
                rotation: ((edit.rotation + 270) % 360) as PageEdit['rotation'],
              })
            }
          >
            왼쪽 90°
          </button>
          <button
            onClick={() =>
              update({
                rotation: ((edit.rotation + 90) % 360) as PageEdit['rotation'],
              })
            }
          >
            오른쪽 90°
          </button>
          <button
            onClick={() =>
              update({
                rotation: ((edit.rotation + 180) % 360) as PageEdit['rotation'],
              })
            }
          >
            180° 회전
          </button>
          <button onClick={() => update({ rotation: 0 })}>각도 복원</button>
          <button
            aria-pressed={edit.flipX}
            onClick={() => update({ flipX: !edit.flipX })}
          >
            좌우 반전
          </button>
          <button
            aria-pressed={edit.flipY}
            onClick={() => update({ flipY: !edit.flipY })}
          >
            상하 반전
          </button>
        </div>
        {Boolean(history?.past.length) && (
          <button onClick={() => useEditStore.getState().undo(pageId)}>
            실행 취소
          </button>
        )}
        {Boolean(history?.future.length) && (
          <button onClick={() => useEditStore.getState().redo(pageId)}>
            다시 실행
          </button>
        )}
      </div>
      <div className="color-toolbar" aria-label="이미지 색상 처리">
        <button
          aria-pressed={edit.invert}
          onClick={() => update({ invert: !edit.invert })}
        >
          색상 반전
        </button>
        <label>
          색상 모드{' '}
          <select
            aria-label="색상 모드"
            value={edit.tone}
            onChange={(event) =>
              update({ tone: event.target.value as PageEdit['tone'] })
            }
          >
            <option value="original">원본 색상</option>
            <option value="grayscale">Grayscale</option>
            <option value="binary">흑백 (임계값 128)</option>
          </select>
        </label>
        <ColorSlider
          key={`${pageId}:brightness`}
          pageId={pageId}
          field="brightness"
          label="밝기"
        />
        <ColorSlider
          key={`${pageId}:contrast`}
          pageId={pageId}
          field="contrast"
          label="대비"
        />
        <button
          onClick={() =>
            update({
              invert: false,
              tone: 'original',
              brightness: 0,
              contrast: 0,
            })
          }
        >
          색상 복원
        </button>
        <button onClick={() => update(DEFAULT_EDIT)}>전체 편집 복원</button>
      </div>
    </>
  );
}
