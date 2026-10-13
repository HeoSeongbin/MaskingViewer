import { useEffect, useRef } from 'react';
import { FileStack, X } from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';
import { closeDocument } from '../../features/file-upload/documentActions';
import { useRenderedPage } from '../../hooks/useRenderedPage';
import type { DocumentModel } from '../../core/document/DocumentModel';
import {
  DEFAULT_EDIT,
  isEdited,
  pageKey,
  useEditStore,
} from '../../stores/editStore';
import { editGeometry } from '../../core/geometry/coordinateTransform';
import { transformPixels } from '../../core/image/colorTransform';

function Thumbnail({
  document,
  index,
}: {
  document: DocumentModel;
  index: number;
}) {
  const { page, error } = useRenderedPage(document.id, index, 160);
  const edit = useEditStore(
    (state) => state.pages[pageKey(document.id, index)] ?? DEFAULT_EDIT,
  );
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (page && canvas) {
      const geometry = editGeometry(page.canvas, edit);
      canvas.width = geometry.width;
      canvas.height = geometry.height;
      const context = canvas.getContext('2d');
      if (context) {
        context.setTransform(...geometry.matrix);
        context.drawImage(page.canvas, 0, 0);
        context.resetTransform();
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
        transformPixels(pixels.data, edit);
        context.putImageData(pixels, 0, 0);
      }
    }
  }, [page, edit]);
  return (
    <button
      className={`thumbnail ${document.currentPage === index ? 'selected' : ''}`}
      onClick={() => useDocumentStore.getState().setPage(document.id, index)}
      aria-label={`${index + 1}페이지 선택`}
      aria-current={document.currentPage === index ? 'page' : undefined}
    >
      <div className="thumbnail-image">
        {page ? (
          <canvas ref={ref} />
        ) : (
          <span>{error ? '미리보기 오류' : '로딩…'}</span>
        )}
      </div>
      <span>
        {index + 1}페이지{' '}
        {isEdited(edit) && <small className="edited-badge">편집됨</small>}
      </span>
    </button>
  );
}
export function DocumentPanel() {
  const documents = useDocumentStore((state) => state.documents);
  const activeId = useDocumentStore((state) => state.activeId);
  const active = documents.find((doc) => doc.id === activeId);
  const { page: activePreview } = useRenderedPage(
    active?.id,
    active?.currentPage ?? 0,
    1800,
  );
  const start = active
    ? Math.max(0, Math.min(active.currentPage - 3, active.pageCount - 7))
    : 0;
  return (
    <>
      <div className="panel-title">
        <h2>문서</h2>
        <span className="count">{documents.length}</span>
      </div>
      {!documents.length && (
        <div className="document-empty">
          <FileStack size={30} />
          <h3>아직 문서가 없습니다</h3>
          <p>파일을 선택하거나 작업 공간에 놓으세요.</p>
        </div>
      )}
      <ul className="file-list">
        {documents.map((doc) => (
          <li key={doc.id}>
            <button
              className={`file-select ${activeId === doc.id ? 'selected' : ''}`}
              onClick={() => useDocumentStore.getState().select(doc.id)}
              aria-pressed={activeId === doc.id}
            >
              <strong>{doc.name}</strong>
              <small>
                {doc.format.toUpperCase()} · {doc.pageCount}페이지 ·{' '}
                {(doc.size / 1024).toFixed(1)} KB
              </small>
            </button>
            <button
              className="icon-button"
              onClick={() => void closeDocument(doc.id)}
              aria-label={`${doc.name} 닫기`}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
      {active && (
        <>
          <div className="panel-title thumbnail-title">
            <h2>페이지</h2>
            <span className="subtle-label">
              {start + 1}–{Math.min(start + 7, active.pageCount)} /{' '}
              {active.pageCount}
            </span>
          </div>
          <div className="thumbnail-list">
            {activePreview &&
              Array.from({ length: Math.min(7, active.pageCount) }, (_, i) => (
                <Thumbnail
                  key={`${active.id}:${start + i}`}
                  document={active}
                  index={start + i}
                />
              ))}
          </div>
          <p className="muted small-note">
            현재 페이지 주변의 썸네일만 불러옵니다.
          </p>
        </>
      )}
    </>
  );
}
