import { useState } from 'react';
import { DEFAULT_EDIT, useEditStore } from '../../stores/editStore';
import type { Size } from '../../core/geometry/transformMatrix';
import {
  opaqueColor,
  validateMask,
  MAX_MASKS,
} from '../../core/masking/MaskEngine';
export function MaskPanel({
  pageId,
  bounds,
}: {
  pageId: string;
  bounds: Size | undefined;
}) {
  const edit = useEditStore((state) => state.pages[pageId] ?? DEFAULT_EDIT);
  const selectedId = useEditStore((state) => state.selection[pageId]);
  const hidden = useEditStore((state) => state.hidden[pageId] ?? false);
  const fill = useEditStore((state) => state.maskFill);
  const [error, setError] = useState('');
  const selected = edit.masks.find((mask) => mask.id === selectedId);
  const color = (value: string) => {
    const next = opaqueColor(value);
    setError('');
    const state = useEditStore.getState();
    state.setMaskFill(next);
    if (selected)
      state.update(pageId, {
        masks: edit.masks.map((mask) =>
          mask.id === selected.id ? { ...mask, fill: next } : mask,
        ),
      });
  };
  return (
    <section className="property-section mask-panel" aria-label="마스킹 속성">
      <h3>
        마스킹 영역 · {edit.masks.length} / {MAX_MASKS}
      </h3>
      <p className="document-notice">
        편집 미리보기입니다. 영구 마스킹 합성과 안전한 다운로드는 아직 제공하지
        않습니다.
      </p>
      <div className="mask-actions">
        <label>
          HEX{' '}
          <input
            key={selected?.fill ?? fill}
            aria-label="마스킹 HEX"
            type="text"
            maxLength={7}
            defaultValue={selected?.fill ?? fill}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            onBlur={(event) => {
              try {
                color(event.target.value);
              } catch (reason) {
                setError(
                  reason instanceof Error ? reason.message : '색상 오류',
                );
                event.target.value = selected?.fill ?? fill;
              }
            }}
          />
        </label>
        <label>
          마스킹 색상{' '}
          <input
            type="color"
            aria-label="마스킹 색상"
            value={selected?.fill ?? fill}
            onChange={(event) => color(event.target.value)}
          />
        </label>
        <button onClick={() => color('#000000')}>검은색</button>
        <button onClick={() => color('#ffffff')}>흰색</button>
        <button
          aria-pressed={!hidden}
          onClick={() => useEditStore.getState().toggleMasks(pageId)}
        >
          {hidden ? '마스킹 표시' : '마스킹 숨기기'}
        </button>
      </div>
      {hidden && (
        <p className="muted">
          마스킹을 숨긴 미리보기입니다. 영역 데이터는 유지됩니다.
        </p>
      )}
      {selected && (
        <>
          <h4>선택한 영역 (원본 좌표)</h4>
          <div className="mask-fields">
            {(['x', 'y', 'width', 'height'] as const).map((field) => (
              <label key={field}>
                {{ x: 'X', y: 'Y', width: '가로', height: '세로' }[field]}
                <input
                  key={`${selected.id}:${selected[field]}`}
                  type="number"
                  step="any"
                  min={field === 'x' || field === 'y' ? 0 : 1}
                  aria-label={`마스킹 ${field}`}
                  defaultValue={selected[field]}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                  onBlur={(event) => {
                    if (!bounds) return;
                    try {
                      if (!event.target.value)
                        throw new Error('좌표 값을 입력하세요.');
                      const next = validateMask(
                        { ...selected, [field]: Number(event.target.value) },
                        bounds,
                      );
                      useEditStore.getState().update(pageId, {
                        masks: edit.masks.map((mask) =>
                          mask.id === next.id ? next : mask,
                        ),
                      });
                      setError('');
                    } catch (reason) {
                      setError(
                        reason instanceof Error
                          ? reason.message
                          : '영역 값 오류',
                      );
                      event.target.value = String(selected[field]);
                    }
                  }}
                />
              </label>
            ))}
          </div>
          <button
            className="text-button"
            onClick={() => {
              const state = useEditStore.getState();
              state.update(pageId, {
                masks: edit.masks.filter((mask) => mask.id !== selected.id),
              });
              state.selectMask(pageId, null);
            }}
          >
            선택한 마스킹 삭제
          </button>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <ul className="mask-list">
        {edit.masks.map((mask, index) => (
          <li key={mask.id}>
            <button
              aria-label={`마스킹 ${index + 1} 선택`}
              aria-pressed={mask.id === selectedId}
              onClick={() => {
                const state = useEditStore.getState();
                state.selectMask(pageId, mask.id);
                state.setTool('select');
              }}
            >
              <span style={{ background: mask.fill }} className="mask-swatch" />
              영역 {index + 1} · {mask.width.toFixed(1)} ×{' '}
              {mask.height.toFixed(1)}
            </button>
          </li>
        ))}
      </ul>
      {edit.masks.length > 0 && (
        <button
          className="text-button"
          onClick={() => {
            const state = useEditStore.getState();
            state.update(pageId, { masks: [] });
            state.selectMask(pageId, null);
          }}
        >
          현재 페이지 마스킹 전체 삭제
        </button>
      )}
      {!edit.masks.length && (
        <p className="muted">
          사각형 마스킹 도구로 문서 안에서 드래그하세요. 선택 도구에서는 영역
          이동과 모서리 크기 조절을 할 수 있습니다.
        </p>
      )}
    </section>
  );
}
