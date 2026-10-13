import { lazy, Suspense, useRef, useState } from 'react';
import { Sun, Moon, ScanLine, FileUp, ShieldCheck } from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { useDocumentStore } from '../stores/documentStore';
import { DEFAULT_EDIT, pageKey, useEditStore } from '../stores/editStore';
import { DEFAULT_VIEW } from '../core/geometry/coordinateTransform';
import { WorkspaceLayout } from '../components/layout/WorkspaceLayout';
import { DocumentPanel } from '../components/sidebar/DocumentPanel';
import { PropertiesPanel } from '../components/sidebar/PropertiesPanel';
import { PageNavigation } from '../components/toolbar/PageNavigation';
import {
  uploadFiles,
  cancelUpload,
} from '../features/file-upload/documentActions';

const DocumentViewer = lazy(() =>
  import('../components/viewer/DocumentViewer').then((module) => ({
    default: module.DocumentViewer,
  })),
);

export function App() {
  const theme = useWorkspaceStore((state) => state.theme);
  const toggleTheme = useWorkspaceStore((state) => state.toggleTheme);
  const documents = useDocumentStore((state) => state.documents);
  const activeId = useDocumentStore((state) => state.activeId);
  const loading = useDocumentStore((state) => state.loading);
  const errors = useDocumentStore((state) => state.errors);
  const active = documents.find((doc) => doc.id === activeId);
  const currentKey = active ? pageKey(active.id, active.currentPage) : '';
  const edit = useEditStore((state) => state.pages[currentKey] ?? DEFAULT_EDIT);
  const view = useEditStore((state) => state.views[currentKey] ?? DEFAULT_VIEW);
  const displayZoom = useEditStore((state) => state.displayZoom[currentKey]);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const openFiles = () => input.current?.click();
  return (
    <div
      data-theme={theme}
      className={`app-root ${dragging ? 'dragging' : ''}`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void uploadFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <a className="skip-link" href="#main-content">
        문서 작업 영역으로 이동
      </a>
      <input
        className="sr-only"
        type="file"
        ref={input}
        multiple
        accept=".png,.jpg,.jpeg,.bmp,.gif,.webp,.pdf,.tif,.tiff"
        aria-label="문서 파일 선택"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          void uploadFiles(files);
        }}
      />
      <WorkspaceLayout
        header={
          <header className="header">
            <div className="brand">
              <span className="brand-icon">
                <ScanLine size={23} />
              </span>
              <div>
                <strong>
                  DocumentMask <span>Studio</span>
                </strong>
                <p>문서의 정보를 안전하게 다루는 작업 공간</p>
              </div>
            </div>
            <div className="header-actions">
              <span className="phase-badge">PHASE 03 · 문서 편집</span>
              <button className="primary-button" onClick={openFiles}>
                <FileUp size={17} />
                문서 열기
              </button>
              <button
                className="theme-button"
                onClick={toggleTheme}
                aria-label={
                  theme === 'light' ? '다크 모드로 변경' : '라이트 모드로 변경'
                }
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                <span>{theme === 'light' ? '다크 모드' : '라이트 모드'}</span>
              </button>
            </div>
          </header>
        }
        documents={<DocumentPanel />}
        viewer={
          <>
            <div className="viewer-toolbar">
              <span>{active?.name ?? '작업 공간'}</span>
              {active ? (
                <PageNavigation
                  key={`${active.id}:${active.currentPage}`}
                  document={active}
                />
              ) : (
                <span className="muted">
                  파일은 외부 서버로 전송되지 않습니다.
                </span>
              )}
            </div>
            {loading && (
              <div className="loading-bar" role="status" aria-live="polite">
                <span>{loading}</span>
                <button className="text-button" onClick={cancelUpload}>
                  불러오기 취소
                </button>
              </div>
            )}
            {errors.length > 0 && (
              <div className="error-banner" role="alert">
                <ul>
                  {errors.map((error, i) => (
                    <li key={`${i}:${error}`}>{error}</li>
                  ))}
                </ul>
                <button
                  className="text-button"
                  onClick={() => useDocumentStore.getState().clearErrors()}
                >
                  오류 안내 닫기
                </button>
              </div>
            )}
            {active ? (
              <Suspense fallback={<p role="status">뷰어 준비 중…</p>}>
                <DocumentViewer
                  key={`${active.id}:${active.currentPage}`}
                  document={active}
                />
              </Suspense>
            ) : (
              <div className="viewer-content">
                <div className="welcome">
                  <span className="eyebrow">
                    YOUR PRIVATE DOCUMENT WORKSPACE
                  </span>
                  <div className="welcome-icon">
                    <FileUp size={42} strokeWidth={1.3} />
                  </div>
                  <h1>
                    문서를 열고,
                    <br />
                    <span>페이지를 살펴보세요.</span>
                  </h1>
                  <p>
                    이미지와 다중 페이지 PDF·TIFF를 한 곳에서.
                    <br />
                    파일을 이곳에 놓거나 아래 버튼으로 선택하세요.
                  </p>
                  <button
                    className="primary-button upload-button"
                    onClick={openFiles}
                  >
                    파일 선택
                  </button>
                  <p>PNG · JPEG · BMP · GIF · WEBP · PDF · TIFF</p>
                  <div className="notice">
                    <ShieldCheck size={15} />
                    <span>파일당 100MB · 열린 파일 총 200MB</span>
                  </div>
                  <p className="future-note">
                    문서 편집을 지원합니다. 영구 마스킹·다운로드는 아직 구현되지
                    않았습니다.
                  </p>
                </div>
              </div>
            )}
            {dragging && (
              <div className="drop-overlay">파일을 놓아 문서 열기</div>
            )}
          </>
        }
        properties={<PropertiesPanel document={active} />}
        status={
          <footer className="status-bar" aria-label="작업 상태">
            <span>
              <span className="status-dot" />
              {loading
                ? '불러오는 중'
                : active
                  ? '문서 편집 준비됨'
                  : '문서 열기 대기'}
            </span>
            <span>
              {active?.name ?? '문서 없음'}{' '}
              <span className="status-divider">|</span> 페이지{' '}
              {active
                ? `${active.currentPage + 1} / ${active.pageCount}`
                : '— / —'}{' '}
              <span className="status-divider">|</span>{' '}
              {active
                ? `${displayZoom === undefined ? '—' : Math.round(displayZoom * 100)}%${view.mode === 'fit' ? ' 화면 맞춤' : view.mode === 'width' ? ' 너비 맞춤' : ''} · 회전 ${edit.rotation}°`
                : '화면 미리보기'}
            </span>
            <span className="status-version">DocumentMask Studio · v0.2.0</span>
          </footer>
        }
      />
    </div>
  );
}
