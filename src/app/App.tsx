import {
  FileStack,
  ShieldCheck,
  Sun,
  Moon,
  ScanLine,
  Layers,
  ArrowRight,
  Circle,
} from 'lucide-react';
import { useWorkspaceStore } from '../stores/workspaceStore';
import { WorkspaceLayout } from '../components/layout/WorkspaceLayout';

export function App() {
  const theme = useWorkspaceStore((state) => state.theme);
  const toggleTheme = useWorkspaceStore((state) => state.toggleTheme);
  return (
    <div data-theme={theme} className="app-root">
      <a className="skip-link" href="#main-content">
        문서 작업 영역으로 이동
      </a>
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
              <span className="phase-badge">PHASE 01 · 기반 구축</span>
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
        documents={
          <>
            <div className="panel-title">
              <h2>문서</h2>
              <span className="count">0</span>
            </div>
            <div className="document-empty">
              <FileStack size={30} strokeWidth={1.4} />
              <h3>아직 문서가 없습니다</h3>
              <p>
                파일 열기와 페이지 탐색은
                <br />
                Phase 2에서 제공됩니다.
              </p>
            </div>
            <div className="panel-note">
              <ShieldCheck size={17} />
              <p>브라우저 내부 파일 처리를 기준으로 설계합니다.</p>
            </div>
          </>
        }
        viewer={
          <>
            <div className="viewer-toolbar">
              <span>작업 공간</span>
              <span className="muted">문서 편집 도구 · Phase 3–4 예정</span>
            </div>
            <div className="viewer-content">
              <div className="welcome">
                <span className="eyebrow">YOUR PRIVATE DOCUMENT WORKSPACE</span>
                <div className="welcome-icon">
                  <Layers size={42} strokeWidth={1.3} />
                </div>
                <h1>
                  문서 편집의 시작,
                  <br />
                  <span>안전한 마스킹의 기반.</span>
                </h1>
                <p>
                  이미지와 다중 페이지 문서를 한 곳에서.
                  <br />
                  DocumentMask Studio의 작업 공간을 준비했습니다.
                </p>
                <div className="notice">
                  <Circle size={9} fill="currentColor" />
                  <span>
                    현재는 기본 화면과 테마 전환을 사용할 수 있습니다.
                  </span>
                </div>
                <div className="roadmap">
                  <div>
                    <span className="step">02</span>
                    <strong>문서 불러오기</strong>
                    <small>이미지 · PDF · TIFF</small>
                  </div>
                  <ArrowRight size={16} />
                  <div>
                    <span className="step">03–04</span>
                    <strong>편집과 마스킹</strong>
                    <small>변환 · 영역 편집</small>
                  </div>
                  <ArrowRight size={16} />
                  <div>
                    <span className="step">05</span>
                    <strong>결과 다운로드</strong>
                    <small>새 픽셀 기반 출력</small>
                  </div>
                </div>
                <p className="future-note">
                  파일 업로드, 편집, 영구 마스킹 및 다운로드는 아직 구현되지
                  않았습니다.
                </p>
              </div>
            </div>
          </>
        }
        properties={
          <>
            <div className="panel-title">
              <h2>속성</h2>
              <span className="subtle-label">문서 정보</span>
            </div>
            <div className="property-section">
              <h3>선택한 페이지</h3>
              <p className="muted">문서를 열면 페이지 정보를 표시합니다.</p>
              <dl>
                <div>
                  <dt>파일 이름</dt>
                  <dd>—</dd>
                </div>
                <div>
                  <dt>페이지</dt>
                  <dd>—</dd>
                </div>
                <div>
                  <dt>원본 크기</dt>
                  <dd>—</dd>
                </div>
              </dl>
            </div>
            <div className="property-section">
              <h3>마스킹 영역</h3>
              <p className="muted">
                영역 선택과 좌표 편집은 Phase 4에서 제공됩니다.
              </p>
            </div>
            <div className="security-card">
              <ShieldCheck size={21} />
              <h3>영구 마스킹 설계</h3>
              <p>
                출력 시 새 픽셀로 영역을 덮고, PDF는 처리된 이미지만으로 새로
                생성할 예정입니다.
              </p>
              <span>출력 보안 검증 · Phase 5 예정</span>
            </div>
          </>
        }
        status={
          <footer className="status-bar" aria-label="작업 상태">
            <span>
              <span className="status-dot" />
              기반 화면 준비됨
            </span>
            <span>
              문서 없음 <span className="status-divider">|</span> 페이지 — / —{' '}
              <span className="status-divider">|</span> 배율 —
            </span>
            <span className="status-version">DocumentMask Studio · v0.1.0</span>
          </footer>
        }
      />
    </div>
  );
}
