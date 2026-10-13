import type { DocumentModel } from '../../core/document/DocumentModel';
import { useRenderedPage } from '../../hooks/useRenderedPage';
export function PropertiesPanel({
  document,
}: {
  document: DocumentModel | undefined;
}) {
  const { page } = useRenderedPage(
    document?.id,
    document?.currentPage ?? 0,
    1800,
  );
  return (
    <>
      <div className="panel-title">
        <h2>속성</h2>
        <span className="subtle-label">문서 정보</span>
      </div>
      <div className="property-section">
        <h3>선택한 페이지</h3>
        <dl>
          <div>
            <dt>파일 이름</dt>
            <dd className="filename-value">{document?.name ?? '—'}</dd>
          </div>
          <div>
            <dt>파일 크기</dt>
            <dd>
              {document ? `${(document.size / 1024).toFixed(1)} KB` : '—'}
            </dd>
          </div>
          <div>
            <dt>페이지</dt>
            <dd>
              {document
                ? `${document.currentPage + 1} / ${document.pageCount}`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>
              {page?.metadata.unit === 'pt' ? 'PDF 페이지 크기' : '원본 크기'}
            </dt>
            <dd>
              {page
                ? `${Math.round(page.metadata.width)} × ${Math.round(page.metadata.height)} ${page.metadata.unit}`
                : '—'}
            </dd>
          </div>
          {page && page.metadata.unit === 'pt' && (
            <div>
              <dt>PDF 초기 회전</dt>
              <dd>{page.metadata.rotation}°</dd>
            </div>
          )}
        </dl>
        {document?.notice && (
          <p className="document-notice">{document.notice}</p>
        )}
      </div>
      <div className="property-section">
        <h3>편집과 마스킹</h3>
        <p className="muted">
          문서 편집·마스킹은 Phase 3–4, 결과 다운로드는 Phase 5에서 제공됩니다.
        </p>
      </div>
      <div className="security-card">
        <h3>파일은 브라우저 안에</h3>
        <p>
          선택한 파일은 외부 서버에 전송하지 않습니다. 문서를 닫으면 처리
          리소스를 해제합니다.
        </p>
      </div>
    </>
  );
}
