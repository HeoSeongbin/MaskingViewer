# 개발 진행 상태

최종 갱신: 2026-10-13 (Asia/Seoul). 기준 문서: PROJECT.md / AGENTS.md.

## 시작 상태 및 이번 범위

- 기준 문서 2개와 빈 docs 디렉터리만 존재했다. 기존 구현, 테스트 결과, Git 저장소 또는 remote는 없었다.
- 기준 문서를 전체 읽고 의존성/보안/메모리 제약 및 전체 계층 설계를 DECISIONS.md에 기록했다.
- 이번 작업은 Phase 1만 구현했다. Phase 2 이후 기능 구현은 시작하지 않았다.
- PROJECT.md와 AGENTS.md는 수정하지 않았다. Git main 저장소를 초기화했고 커밋/remote/배포는 수행하지 않았다.

## Phase 1 — 완료

- [x] Vite + React + TypeScript 초기화
- [x] strict 및 추가 경계 검사(noUncheckedIndexedAccess 등)
- [x] app/components/features/core/adapters/stores/hooks/workers/utils/types/tests 폴더 구조
- [x] Tailwind CSS Vite plugin, semantic 디자인 토큰
- [x] ESLint / Prettier 설정과 npm scripts
- [x] Zustand 기반 UI 상태 및 실제 테마 전환
- [x] 헤더, 좌측 문서 패널, 중앙 뷰어, 우측 속성 패널, 하단 상태 표시줄
- [x] 한국어 UI, 반응형 light/dark 화면, 접근성 landmark/skip link/focus
- [x] Git 초기화 및 생성물 제외 설정
- [x] Vite base 경로와 GitHub Pages 배포 workflow 구성
- [x] Vitest/jsdom/Testing Library 환경과 UI 테스트
- [x] GitHub Actions의 typecheck/lint/format/test/build와 성공 후 main 배포 설정
- [x] 정적 빌드 및 실제 브라우저 기본 화면 확인

업로드/편집/다운로드는 개발 예정 안내만 표시한다. 가짜 실행, 다운로드, 비활성 기능 버튼은 없다. 기능별 예정 단계는 화면에서 명시한다. 완료 기준의 기본 화면 및 정적 빌드는 검증했으며, 실제 GitHub 호스팅 배포는 별도 미검증이다.

## Phase 2 — 미착수 (다음 우선순위)

- [ ] 파일 판별/검증, 파일 선택, Drag & Drop, 여러 파일 업로드
- [ ] 일반 이미지 어댑터 및 손상/미지원 형식 오류
- [ ] PDF.js 어댑터, worker, 암호 처리
- [ ] TIFF 다중 페이지 어댑터와 코덱 fixture 검증
- [ ] 공통 DocumentModel/Loader/PageRenderer 및 리소스 소유권 구현
- [ ] 파일 목록, 페이지 썸네일, 페이지 탐색, 로딩 상태
- [ ] 지연 렌더링/취소/캐시와 문서 닫기 자원 해제
- [ ] 로컬 및 배포 서브경로에서 문서/worker 리소스 검증

## Phase 3 — 미착수

- [ ] Konva 기반 뷰어, 확대/축소, pointer 중심 zoom, 화면 이동
- [ ] 회전, 좌우/상하 반전, 색상 반전/흑백/grayscale/밝기/대비
- [ ] 독립 affine 좌표 엔진, PDF 초기 회전, HiDPI, 경계/음수 드래그 처리
- [ ] 배율/회전/반전/이동 조합 및 원본 좌표 왕복 테스트

## Phase 4 — 미착수

- [ ] 마스킹 생성, 선택/이동/크기/삭제, 색상 및 영역 목록
- [ ] 미리보기 숨김, 페이지별 마스킹 상태, 단축키
- [ ] Undo/Redo 및 드래그 transaction
- [ ] 회전/반전 후 마스킹 위치 회귀 검사

## Phase 5 — 미착수

- [ ] 새 픽셀 버퍼에 실제 영구 마스킹 합성
- [ ] PNG/JPEG, PDF, 페이지 이미지 ZIP 출력
- [ ] 단일/다중 TIFF 인코더 검증 및 구현 (불가 확인 시 근거/대안 문서화)
- [ ] 현재/전체 페이지 선택, 출력 형식/페이지 수/진행률/파일명
- [ ] 재디코딩 픽셀 검사 및 PDF 텍스트/구조/추출 이미지 보안 검증

## Phase 6 — 미착수

- [ ] 대용량 메모리/Canvas 제한, worker/OffscreenCanvas 및 fallback
- [ ] 성능/자원 해제/요청 취소 및 오류 처리 강화
- [ ] 핵심 단위/통합/E2E/접근성 테스트와 재현 fixture

## Phase 7 — 미착수

- [ ] 실제 기능 기준 README/포트폴리오/스크린샷 완성
- [ ] 좌표/영구 마스킹/다중 페이지/성능 문제 해결 및 검증 결과 문서화
- [ ] 원격 저장소 연결, Pages 설정 및 실제 배포
- [ ] 배포 환경에서 파일 열기/편집/다운로드/재개방 검증

Phase 1에서 README 초안, 기본 화면 스크린샷, workflow만 준비했다. Phase 7 전체를 완료 처리하지 않는다.

## 가장 최근 검증 결과

환경: Windows, Node 24.12.0, npm 11.6.2.

| 검사                                     | 결과                            |
| ---------------------------------------- | ------------------------------- |
| 의존성 설치 및 npm ls                    | 성공, peer dependency 충돌 없음 |
| npm 보안 검사(최종 설치)                 | 0 vulnerabilities               |
| TypeScript typecheck                     | 통과                            |
| ESLint (max-warnings 0)                  | 통과                            |
| Prettier format:check                    | 통과                            |
| Vitest                                   | 1 파일, 2 테스트 통과           |
| Production build (`/`)                   | 통과                            |
| Production build (`/MaskingViewer/`)     | 통과, JS/CSS에 서브경로 적용    |
| 브라우저 기본 화면/다크 테마             | 확인                            |
| 모바일 390px                             | 확인, 가로 넘침 없음            |
| Production 서브경로 브라우저 확인        | 정상 표시, 오류 로그 없음       |
| GitHub Actions 원격 실행/실제 Pages 배포 | 미실행                          |
| 문서 처리/편집/마스킹 보안               | 미구현, 미검증                  |

자동 테스트는 작업 영역 landmark, 미구현 기능 안내, 실제 테마 왕복 전환을 검사한다. 브라우저 확인은 수동 도구 검증이며 E2E 자동화 완료를 뜻하지 않는다. 스크린샷: screenshots/phase-1.png.

## 발견한 문제와 해결

- npm 레지스트리 DNS 조회가 제한 환경에서 실패했다. 네트워크 권한을 통해 설치했다.
- 제한 환경에서 Vite/Vitest가 realpath EPERM으로 실패했다. 권한을 갖춘 환경에서 실제 재실행 후 통과했다. 최초 실패를 테스트 성공으로 계산하지 않았다.
- 최초 Vitest 3 계열 audit에서 3개 취약점이 확인됐다. 호환 버전 갱신 및 이번 작업 생성 의존성 재설치로 0건이 됐다.
- ESLint 9 지원 종료 경고는 ESLint 10 및 호환 플러그인 갱신으로 해결했다.
- jsdom의 간접 의존성 whatwg-encoding deprecated 안내는 남아 있다. 실행 실패 또는 audit 취약점은 아니다.

## 알려진 제한과 진행 작업

현재 진행 작업: 없음. 다음 작업은 Phase 2 계약 및 일반 이미지 로딩부터 시작한다.

테마는 새로고침 시 라이트로 초기화한다. TIFF 코덱/인코더, PDF 출력 DPI, 브라우저 Canvas/메모리 한도 및 worker fallback은 후속 구현 전에 검증해야 한다. 실제 마스킹 결과를 생성하지 않으므로 보안 완료를 주장하지 않는다. remote/배포 주소는 아직 없다.
