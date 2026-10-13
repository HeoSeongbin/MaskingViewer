import type { DocumentModel } from '../../core/document/DocumentModel';
import { useRenderedPage } from '../../hooks/useRenderedPage';
import { DEFAULT_EDIT, pageKey, useEditStore } from '../../stores/editStore';
import { editGeometry } from '../../core/geometry/coordinateTransform';
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
  const edit = useEditStore((state) =>
    document
      ? (state.pages[pageKey(document.id, document.currentPage)] ??
        DEFAULT_EDIT)
      : DEFAULT_EDIT,
  );
  const geometry = page ? editGeometry(page.metadata, edit) : undefined;
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
        <h3>페이지 편집</h3>
        {document && (
          <dl>
            <div>
              <dt>사용자 회전</dt>
              <dd>{edit.rotation}°</dd>
            </div>
            <div>
              <dt>기하 반전</dt>
              <dd>
                {edit.flipX ? '좌우 ' : ''}
                {edit.flipY ? '상하' : ''}
                {!edit.flipX && !edit.flipY ? '없음' : ''}
              </dd>
            </div>
            <div>
              <dt>변환 후 크기</dt>
              <dd>
                {geometry
                  ? `${Math.round(geometry.width)} × ${Math.round(geometry.height)} ${page?.metadata.unit}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>색상 모드</dt>
              <dd>
                {edit.tone === 'original'
                  ? '원본'
                  : edit.tone === 'binary'
                    ? '흑백'
                    : 'Grayscale'}
                {edit.invert ? ' · 반전' : ''}
              </dd>
            </div>
            <div>
              <dt>밝기 / 대비</dt>
              <dd>
                {edit.brightness} / {edit.contrast}
              </dd>
            </div>
          </dl>
        )}
        <p className="muted">
          Ctrl+휠로 포인터 중심 확대, 손 도구로 드래그, 휠·방향키로 이동합니다.
          Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y로 현재 페이지의 편집을 되돌립니다.
        </p>
        <p className="muted">
          영구 마스킹은 Phase 4–5, 결과 다운로드는 Phase 5에서 제공됩니다. 현재
          편집은 브라우저 세션 안에서만 유지됩니다.
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
