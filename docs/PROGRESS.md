# 개발 진행 상태

최종 갱신: 2026-10-13 (Asia/Seoul). 기준 문서: PROJECT.md / AGENTS.md.

## 프로젝트 시작 상태 및 현재 범위

- 기준 문서 2개와 빈 docs 디렉터리만 존재했다. 기존 구현, 테스트 결과, Git 저장소 또는 remote는 없었다.
- 기준 문서를 전체 읽고 의존성/보안/메모리 제약 및 전체 계층 설계를 DECISIONS.md에 기록했다.
- Phase 1 기반 작업에 이어 이번 작업은 Phase 2 문서 업로드/탐색을 구현했다. Phase 3의 사용자 편집/좌표 엔진과 Phase 4–5 마스킹/출력 기능은 구현하지 않았다.
- PROJECT.md와 AGENTS.md는 수정하지 않았다. Phase 1 커밋 `6a2c3d8`은 `origin/main`에 푸시되어 있다. 원격 주소: https://github.com/HeoSeongbin/MaskingViewer.git. Phase 2 구현, 테스트 및 문서를 함께 커밋/푸시하는 범위다.

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

Phase 1 완료 당시 미구현 기능은 안내만 표시했다. 현재 업로드/탐색은 실제 동작하고, 편집/마스킹/다운로드는 예정 단계로 표시한다. 실제 GitHub 호스팅 배포는 별도 미검증이다.

## Phase 2 — 완료 (명시한 지원 범위)

- [x] 파일 확장자/MIME/magic bytes 판별, 파일 선택, Drag & Drop, 여러 파일 순차 업로드
- [x] PNG/JPEG/BMP/GIF/WEBP 이미지 어댑터, 디코딩 전 크기 한도 검사, 손상/미지원 형식 오류
- [x] PDF.js 어댑터 및 로컬 worker/폰트/CMap/WASM/ICC 리소스, 암호 보호 안내
- [x] TIFF 다중 페이지 어댑터와 Worker 디코딩, IFD/strip/크기/코덱 검증
- [x] 공통 DocumentModel/Loader/PageRenderer와 UI 상태 분리
- [x] 파일 목록과 크기/페이지 수, 페이지 썸네일, 이전/다음 및 번호 직접 이동
- [x] 파일 간 전환 시 현재 페이지 유지, PDF 초기 회전 및 TIFF 방향 반영
- [x] 현재 페이지 우선 미리보기, 주변 최대 7개 썸네일, 48MiB 캐시, 디코딩 큐
- [x] 업로드/렌더 취소, 문서 닫기, PDF/Worker/Blob URL 및 참조 정리
- [x] production 서브경로에서 실제 이미지/PDF/TIFF/worker 로딩 검증

입력 한도: 파일당 100MiB, 열린 파일 총 200MiB, 최대 50문서/문서당 5,000페이지. raster/TIFF는 페이지당 1,600만 픽셀 및 한 변 16,384 제한. 썸네일은 최대 160px, 미리보기는 최대 1,800px이며 원본 크기를 상태와 분리했다. Canvas 캐시는 참조를 제거하고 실제 메모리 회수는 브라우저 GC가 담당한다. 이 한도는 전체 브라우저 heap 상한을 보장하지 않는다.

제한: GIF는 첫 프레임만 표시하며 프레임 탐색 미지원. PDF는 암호 보호 안내만 제공하고 암호 입력 미지원. TIFF는 classic/strip 기반, 1/8bit 일부 색상 구성과 무압축·CCITT G3/G4·LZW·Deflate·PackBits를 지원한다. BigTIFF, tile, 16bit, planar-separated, JPEG-in-TIFF 등은 명확히 거부한다. fixture 통과는 모든 TIFF 변형 호환을 보장하지 않는다. JPEG SOF 헤더가 첫 1MiB에 없는 파일은 안전한 크기 확인을 위해 거부한다. 확장 입력(SVG/HEIC/AVIF/ICO)은 아직 미지원이다.

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
- [x] 원격 저장소 연결 및 Phase 1 푸시
- [ ] Pages 설정 및 실제 배포
- [ ] 배포 환경에서 파일 열기/편집/다운로드/재개방 검증

README/스크린샷/workflow는 현재 단계 기준으로 갱신했다. Phase 7 전체를 완료 처리하지 않는다.

## 가장 최근 검증 결과

환경: Windows, Node 24.12.0, npm 11.6.2.

| 검사                                     | 결과                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 의존성 설치 및 npm ls                    | 성공, peer dependency 충돌 없음                                                                       |
| npm 보안 검사(최종 설치)                 | 0 vulnerabilities                                                                                     |
| TypeScript typecheck                     | 통과                                                                                                  |
| ESLint (max-warnings 0)                  | 통과                                                                                                  |
| Prettier format:check                    | 통과                                                                                                  |
| Vitest                                   | 7 파일, 23 테스트 통과                                                                                |
| Production build (`/`)                   | 통과                                                                                                  |
| Production build (`/MaskingViewer/`)     | 통과, JS/CSS에 서브경로 적용                                                                          |
| 브라우저 UI 회귀/테마 및 문서 로딩       | 확인                                                                                                  |
| 모바일 390px                             | 확인, 가로 넘침 없음                                                                                  |
| Production 서브경로 E2E                  | 10개 통과: 이미지 5종, PDF, TIFF 6코덱, 암호 안내, 오류, 파일 전환/닫기, 번호/썸네일 이동, DnD/모바일 |
| GitHub Actions 원격 실행/실제 Pages 배포 | 미실행                                                                                                |
| 문서 업로드/탐색                         | 자동 테스트 및 실제 화면 확인                                                                         |
| 편집/마스킹 보안                         | 미구현, 미검증                                                                                        |

단위 테스트: UI landmark/테마 회귀, 형식 판별, 크기 한도, TIFF 구조 손상, 페이지 상태, 업로드 취소/혼합 성공·실패, 캐시 eviction, 문서 닫기 이후 늦은 결과 폐기. 브라우저 E2E는 Windows Edge headless에서 실제 생성한 파일로 실행했다. TIFF grayscale fixture의 페이지별 픽셀 값과 orientation 6도 검사한다. CCITT fixture는 단순 white bilevel 패턴이며 복잡한 팩스 문서 코퍼스 검증은 남아 있다. 비밀번호 fixture는 암호 필요 안내를 위한 Standard Security Handler 문서이며 암호 해제 성공 검증은 아니다. 요청 검사로 테스트 PDF에서 외부 전송이 없음을 확인했다. Linux CI 실행은 아직 미검증이다.

스크린샷: screenshots/phase-1.png, screenshots/phase-2.png. E2E 설정은 build base와 일치해야 하며 README의 명령 순서로 재현한다.

## 발견한 문제와 해결

- npm 레지스트리 DNS 조회가 제한 환경에서 실패했다. 네트워크 권한을 통해 설치했다.
- 제한 환경에서 Vite/Vitest가 realpath EPERM으로 실패했다. 권한을 갖춘 환경에서 실제 재실행 후 통과했다. 최초 실패를 테스트 성공으로 계산하지 않았다.
- 최초 Vitest 3 계열 audit에서 3개 취약점이 확인됐다. 호환 버전 갱신 및 이번 작업 생성 의존성 재설치로 0건이 됐다.
- ESLint 9 지원 종료 경고는 ESLint 10 및 호환 플러그인 갱신으로 해결했다.
- jsdom의 간접 의존성 whatwg-encoding deprecated 안내는 남아 있다. 실행 실패 또는 audit 취약점은 아니다.
- TIFF Deflate에서 UTIF browser build가 Worker의 pako를 찾지 못했다. pako를 명시적으로 제공한 후 실제 Deflate 픽셀 테스트가 통과했다.
- PDF.js 생성 리소스가 lint 대상으로 들어간 문제는 generated vendor 디렉터리를 제외해 해결했다. 앱 코드는 전체 lint 검사를 유지한다.
- 초기 Konva 포함 메인 번들의 500KB 경고는 뷰어 lazy import로 해결했다 (메인 약 242KB, 별도 뷰어 약 329KB).

## 알려진 제한과 진행 작업

현재 진행 작업: 없음. 다음 우선순위는 Phase 3 affine 좌표 엔진의 순수 함수/왕복 테스트, 확대·이동, 회전·반전과 색상 처리다.

테마와 열린 문서는 새로고침 시 초기화한다. TIFF 출력 인코더, PDF 출력 DPI, 브라우저별 큰 Canvas/메모리 한도 및 worker fallback은 후속 구현 전에 검증해야 한다. TIFF는 Worker 미지원 환경에서 명시적으로 중단한다. Firefox/Safari, 복잡한 CCITT/LZW/palette/RGB/EXIF 변형과 대용량 파일 코퍼스 검증은 남아 있다. 자동 테스트는 대용량 성능이나 원본 마스킹 보안 완료를 뜻하지 않는다. 실제 배포 주소/Pages 동작은 미검증이다.
