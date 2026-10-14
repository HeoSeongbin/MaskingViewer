import { useEffect, useId, useRef, useState } from 'react';
import type { DocumentModel } from '../../core/document/DocumentModel';
import type { ExportFormat } from '../../core/export/ExportPipeline';
import { useEditStore } from '../../stores/editStore';
export function ExportPanel({ document }: { document: DocumentModel }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>(
    document.format === 'pdf'
      ? 'pdf'
      : document.format === 'tiff'
        ? 'tiff'
        : document.format === 'jpeg'
          ? 'jpeg'
          : 'png',
  );
  const [all, setAll] = useState(false);
  const [dpi, setDpi] = useState<150 | 300>(150);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const panelId = useId();
  useEffect(() => {
    if (open)
      panel.current?.querySelector<HTMLSelectElement>('select')?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => () => controller.current?.abort(), []);
  const run = async () => {
    if (controller.current) return;
    const cancel = new AbortController();
    controller.current = cancel;
    setBusy(true);
    setError('');
    setStatus('출력 준비 중');
    try {
      const edits = structuredClone(
        Object.fromEntries(
          Object.entries(useEditStore.getState().pages).filter(([key]) =>
            key.startsWith(`${document.id}:`),
          ),
        ),
      );
      const { exportDocument } =
        await import('../../core/export/ExportPipeline');
      const result = await exportDocument(
        document,
        edits,
        { format, all, dpi },
        cancel.signal,
        (message) => {
          if (!cancel.signal.aborted) setStatus(message);
        },
      );
      if (cancel.signal.aborted) return;
      const url = URL.createObjectURL(result.blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = result.name;
      window.document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus(`${result.name} 생성 및 검증 완료`);
    } catch (reason) {
      if (cancel.signal.aborted) setStatus('출력을 취소했습니다.');
      else {
        setError(reason instanceof Error ? reason.message : '출력 실패');
        setStatus('');
      }
    } finally {
      controller.current = null;
      setBusy(false);
    }
  };
  return (
    <div className="export-control">
      <button
        className="primary-button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        ref={trigger}
      >
        다운로드
      </button>
      {open && (
        <section
          id={panelId}
          ref={panel}
          className="export-panel"
          aria-label="결과 다운로드"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              if (busy) controller.current?.abort();
              else close();
            }
          }}
        >
          <h2>결과 다운로드</h2>
          <p>{document.name}</p>
          <label>
            출력 형식
            <select
              aria-label="출력 형식"
              disabled={busy}
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as ExportFormat)
              }
            >
              <option value="png">PNG (무손실)</option>
              <option value="jpeg">JPEG (손실 압축)</option>
              <option value="pdf">PDF (이미지 기반)</option>
              <option value="tiff">TIFF (무압축 RGB)</option>
            </select>
          </label>
          <label>
            페이지 범위
            <select
              aria-label="출력 페이지 범위"
              disabled={busy}
              value={all ? 'all' : 'current'}
              onChange={(event) => setAll(event.target.value === 'all')}
            >
              <option value="current">
                현재 페이지 ({document.currentPage + 1})
              </option>
              <option value="all">전체 페이지 ({document.pageCount})</option>
            </select>
          </label>
          <label>
            PDF 입력 렌더링 / PDF 출력 인쇄 DPI
            <select
              aria-label="출력 DPI"
              disabled={busy}
              value={dpi}
              onChange={(event) =>
                setDpi(Number(event.target.value) as 150 | 300)
              }
            >
              <option value="150">150 DPI</option>
              <option value="300">300 DPI</option>
            </select>
          </label>
          <p>
            {all ? document.pageCount : 1}페이지 ·{' '}
            {all &&
            document.pageCount > 1 &&
            (format === 'png' || format === 'jpeg')
              ? '페이지 이미지 ZIP'
              : format.toUpperCase()}{' '}
            출력
          </p>
          <p className="muted">
            숨긴 영역도 모두 적용합니다. 투명 배경은 흰색으로 합성하며 마스킹
            경계는 1픽셀 확장합니다. 원본 파일명 뒤에 _masked를 붙입니다.
          </p>
          {format === 'pdf' && (
            <p className="document-notice">
              새 이미지 기반 PDF에는 원본 텍스트
              검색·복사·링크·벡터·주석·첨부파일이 유지되지 않습니다.
            </p>
          )}
          {format === 'jpeg' && (
            <p className="document-notice">
              JPEG는 제거된 새 픽셀만 압축하지만 경계와 색상이 변할 수 있습니다.
              정확한 단색 픽셀이 필요하면 PNG/PDF/TIFF를 선택하세요.
            </p>
          )}
          <p className="muted">
            페이지당 1,600만 픽셀, 출력 작업 예산 128MiB, 최대 200페이지. 실제
            브라우저 전체 메모리 상한을 보장하지 않습니다. 검증 실패 시
            다운로드를 차단합니다. Worker 미지원 환경은 페이지당 100만 픽셀·누적
            중간 결과 8MiB로 제한합니다.
          </p>
          {status && <p role="status">{status}</p>}
          {error && <p role="alert">{error}</p>}
          {busy ? (
            <button onClick={() => controller.current?.abort()}>
              출력 취소
            </button>
          ) : (
            <button className="primary-button" onClick={() => void run()}>
              검증 후 다운로드
            </button>
          )}
          <button disabled={busy} onClick={close}>
            닫기
          </button>
        </section>
      )}
    </div>
  );
}
