# 개발 진행 상태

최종 갱신: 2026-10-14 (Asia/Seoul). 기준 문서: PROJECT.md / AGENTS.md.

## 프로젝트 시작 상태 및 현재 범위

- 기준 문서 2개와 빈 docs 디렉터리만 존재했다. 기존 구현, 테스트 결과, Git 저장소 또는 remote는 없었다.
- 기준 문서를 전체 읽고 의존성/보안/메모리 제약 및 전체 계층 설계를 DECISIONS.md에 기록했다.
- 이번 작업은 Phase 4 마스킹 영역 편집을 구현했다. Phase 5의 새 픽셀 합성/파일 출력/영구 마스킹 보안 검증은 구현하지 않았다. 기존 Phase 3 좌표 엔진과 편집 이력을 확장했다.
- PROJECT.md와 AGENTS.md는 수정하지 않았다. Phase 1 `6a2c3d8`, Phase 2 `40b5b2d`, CI 잠금 파일 수정 `e2bb583`는 `origin/main`에 푸시되어 있다. 원격 주소: https://github.com/HeoSeongbin/MaskingViewer.git. Phase 3은 6b0265c로 푸시했다. E2E 타이밍 수정은 dcf7fd0으로 푸시했고 Actions 38369290926의 전체 성공을 확인했다. Phase 4 변경은 이번 로컬 커밋에 포함하며, 사용자 요청에 따라 푸시는 진행하지 않는다. 원격 실행 결과와 실제 배포는 별도로 검증해야 한다.

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

Phase 1 완료 당시 미구현 기능은 안내만 표시했다. 현재 업로드/탐색/편집은 실제 동작하고 마스킹/다운로드는 예정 단계로 표시한다. 실제 GitHub 호스팅 배포는 별도 미검증이다.

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

## Phase 3 — 완료 (브라우저 미리보기 편집)

- [x] Konva 확대/축소 버튼, 배율 직접 입력(Enter/blur), 100%, 화면/너비 맞춤, 1–800% 한도
- [x] Ctrl+휠 pointer 중심 zoom, 손 도구 pointer capture 드래그, 일반/Shift 휠·방향키 이동과 경계 제한
- [x] 왼쪽/오른쪽 90°, 180°, 각도 복원, 회전된 화면 기준 좌우/상하 반전
- [x] 색상 반전, Grayscale, 임계값 128 흑백, 밝기/대비(-100–100), 색상/전체 편집 복원
- [x] 페이지별 편집/viewport 보존, 편집된 썸네일과 표시, 속성/배율 상태 표시
- [x] 페이지별 Undo/Redo, Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y, 밝기/대비 slider transaction, 페이지당 이력 100개
- [x] 독립 affine 정방향/역방향 엔진, screen→Stage 변환, 원본 좌표 확인, 경계/음수 드래그 사각형 정규화
- [x] PDF 초기 회전을 어댑터에서 한 번 반영, HiDPI 2배 실제 Canvas 픽셀 검증
- [x] 색상 Worker, 새 요청/페이지 전환 취소·종료, 10초 timeout, 실패 복구 및 Worker 없는 raster fallback
- [x] 배율 50/100/200/400%, 회전 0/90/180/270°, 반전/이동 조합 64개 왕복 및 실제 복합 변환 E2E

표시 좌표는 정규화된 원본 기준이다. 일반 이미지/TIFF는 원본 px, PDF는 초기 회전을 적용한 1px/pt 기준 raster 좌표(100% = 1pt당 CSS 1px)다. 실제 PDF 출력 DPI와 raster 비율 변환은 Phase 5에서 구현해야 한다. 1,800px 미리보기 확대는 디코딩 해상도를 높이지 않는다. Phase 3 시점의 원본 좌표/음수 드래그는 순수 엔진 테스트로 검사했고, Phase 4에서는 실제 마스킹 gesture도 검증했다. 다운로드 결과 일치/영구 마스킹 보안은 아직 미검증이다.

이번 변경 파일(24개):

- 신규: src/core/geometry/transformMatrix.ts, coordinateTransform.ts, rectangleUtils.ts; src/core/image/colorTransform.ts; src/stores/editStore.ts; src/hooks/useColorPreview.ts; src/workers/color.worker.ts; src/components/toolbar/EditToolbar.tsx.
- 신규 검증/화면: src/tests/geometry.test.ts, editStore.test.ts, colorTransform.test.ts; e2e/editing.spec.ts; docs/screenshots/phase-3.png.
- 수정: src/app/App.tsx, styles.css; src/components/viewer/DocumentViewer.tsx; src/components/sidebar/DocumentPanel.tsx, PropertiesPanel.tsx; src/features/file-upload/documentActions.ts; src/tests/App.test.tsx; scripts/fixtures.mjs; README.md; docs/PROGRESS.md, DECISIONS.md.

직접 의존성 및 잠금 파일 변경은 없다. 기존 React/TypeScript/Zustand/Konva/Vitest/Playwright 구조를 유지했다.

## Phase 4 — 완료 (편집 미리보기)

- [x] 사각형 생성과 음수 드래그 정규화, 원본 좌표 경계 제한
- [x] 생성 후 선택 도구 자동 전환, 선택/이동/4개 모서리 크기 조절, 겹친 영역은 가장 위쪽 선택
- [x] 선택 삭제/Delete, 현재 페이지 전체 삭제, Escape/pointer cancel로 미완성 작업 폐기
- [x] 검은색/흰색/사용자 HEX 및 color picker, 불투명 6자리 색상 검증
- [x] 목록, 선택한 영역 X/Y/가로/세로 입력, 범위 오류 안내와 원본 소수 좌표 보존
- [x] 표시/숨김은 미리보기 UI 상태로 분리, 숨김 중 canvas 영역 편집 차단
- [x] 페이지/파일별 영역 보존, 문서 닫기 시 영역/선택/숨김/이력 해제
- [x] 회전/반전/색상 처리와 마스킹이 동일한 페이지 Undo/Redo 이력 사용
- [x] 드래그 중 임시 preview만 갱신, 완료 시 한 작업 기록, 클릭/취소는 이력 없음
- [x] 미리보기와 썸네일에 색상 처리 후 마스킹 적용, 전체 이미지 편집 복원은 영역 보존
- [x] 복합 확대/회전/반전/pan, PDF 초기 회전, HiDPI 2배, 모바일 390px 회귀 테스트

페이지당 최대 1,000개 영역, 가로/세로 최소 원본 기준 1 단위, 페이지별 이력 최대 100개다. 작은 영역의 핸들이 겹치면 확대 또는 좌표 입력을 사용한다. Canvas overlay/thumbnail은 편집 미리보기이며 원본 파일을 제거하거나 안전한 결과 파일을 생성하지 않는다. PDF 기준 좌표는 Phase 3의 normalized 1px/pt를 유지한다. 실제 출력 raster 좌표와의 배율 변환/경계 확장/픽셀 합성/잔존 정보 검증은 Phase 5 관문이다.

변경 파일: 신규 src/core/masking/MaskEngine.ts, src/hooks/useMaskGesture.ts, src/components/masking/MaskPanel.tsx, src/tests/MaskEngine.test.ts, e2e/masking.spec.ts, docs/screenshots/phase-4.png. 수정 src/stores/editStore.ts, src/components/viewer/DocumentViewer.tsx, src/components/toolbar/EditToolbar.tsx, src/components/sidebar/DocumentPanel.tsx 및 PropertiesPanel.tsx, src/app/App.tsx 및 styles.css, README.md, docs/PROGRESS.md 및 DECISIONS.md. 직접 의존성, 잠금 파일, 기준 문서는 변경하지 않았다.

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

| 검사                                     | 결과                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| 의존성 설치 및 npm ls                    | 깨끗한 npm ci 성공, Linux 대상 dry-run도 통과                                             |
| npm 보안 검사(최종 설치)                 | 0 vulnerabilities                                                                         |
| TypeScript typecheck                     | 통과                                                                                      |
| ESLint (max-warnings 0)                  | 통과                                                                                      |
| Prettier format:check                    | 통과                                                                                      |
| Vitest                                   | 11 파일, 129 테스트 통과                                                                  |
| Production build (`/`)                   | Phase 2 통과, Phase 3–4는 아래 서브경로로 검증                                            |
| Production build (`/MaskingViewer/`)     | 통과, JS/CSS에 서브경로 적용                                                              |
| 브라우저 UI 회귀/테마 및 문서 로딩       | 확인                                                                                      |
| 모바일 390px                             | 확인, 가로 넘침 없음                                                                      |
| Production 서브경로 E2E                  | Chromium/Edge 각각 20개 통과: 기존 15개 + 마스킹 편집·HiDPI·PDF/TIFF·취소·경계·모바일 5개 |
| GitHub Actions 원격 실행/실제 Pages 배포 | Phase 3 CI 수정 실행 38369290926 성공. Phase 4는 로컬 검증 완료, 원격 실행 전             |
| 문서 업로드/탐색                         | 자동 테스트 및 실제 화면 확인                                                             |
| 문서 편집                                | 좌표/상태/색상 단위 테스트 및 브라우저 실제 픽셀 검증 통과                                |
| 영구 마스킹 보안                         | 미구현, 미검증                                                                            |

단위 테스트: UI landmark/테마 회귀, 형식 판별, 크기 한도, TIFF 구조 손상, 페이지 상태, 업로드 취소/혼합 성공·실패, 캐시 eviction, 문서 닫기 이후 늦은 결과 폐기. 브라우저 E2E는 Windows Edge headless에서 실제 생성한 파일로 실행했다. TIFF grayscale fixture의 페이지별 픽셀 값과 orientation 6도 검사한다. CCITT fixture는 단순 white bilevel 패턴이며 복잡한 팩스 문서 코퍼스 검증은 남아 있다. 비밀번호 fixture는 암호 필요 안내를 위한 Standard Security Handler 문서이며 암호 해제 성공 검증은 아니다. 요청 검사로 테스트 PDF에서 외부 전송이 없음을 확인했다. Linux CI의 Phase 3 실행은 E2E 6실패/9통과였다. 아래 012 결정에 따라 수정했으며 Windows의 공식 Chromium과 Edge에서 각각 15개를 통과했다. 이후 Linux 실행 38369290926의 성공을 확인했다. Phase 4 원격 실행은 아직 하지 않았다.

Phase 3 추가 검증은 geometry.test.ts의 64개 복합 변환 왕복 조합 및 방향/zoom/clamp/화면 좌표, editStore.test.ts의 페이지 격리/이력/transaction/한도, colorTransform.test.ts의 alpha/grayscale/binary/밝기/대비다. 편집 E2E는 HiDPI 2배 비대칭 픽셀, 밝기·대비/복원/Undo, PDF 초기 회전·페이지별 이력, wheel 원본 좌표 유지·pan, Worker 실패 복구/fallback 및 TIFF thumbnail 일치를 확인했다. Worker timeout 경로 자체의 자동 테스트와 메모리 실측은 남아 있다.

스크린샷: screenshots/phase-1.png, screenshots/phase-2.png, screenshots/phase-3.png, screenshots/phase-4.png. Phase 3 데스크톱 1280×900의 실제 PDF 회전/반전/Grayscale 및 light/dark 레이아웃을 확인했다. E2E 설정은 build base와 일치해야 하며 README의 명령 순서로 재현한다.

## 발견한 문제와 해결

- Phase 2 푸시의 [Actions 실행](https://github.com/HeoSeongbin/MaskingViewer/actions/runs/38359540248)에서 npm ci 실패를 확인했다. 로컬에서도 EUSAGE와 @emnapi/core/runtime/wasi-threads 및 tslib 누락을 재현했다. 기존 node_modules와 잠금 파일 없이 새 lock을 생성해 복구했고 실제 npm ci부터 전체 검증을 다시 통과했다. 기존 설치 성공만으로 재현성을 확인한 검증 부족을 보완했다. 수정은 e2bb583으로 푸시했고 Actions 실행 38361812212의 전체 성공을 확인했다.
- Phase 3에서는 회전 후 좌우 반전이 화면의 상하 반전처럼 보일 수 있어 회전된 화면 기준 flip으로 순서를 확정하고 Konva local scale 축을 교환했다. 실제 비대칭 픽셀 테스트로 확인했다. brightness/contrast 뒤에 binary threshold를 적용하여 흑백 모드가 중간 회색으로 바뀌지 않도록 했다. 데스크톱은 도구가 늘어나도 뷰어가 viewport 안에 배치되도록 flex 높이를 조정했다.

- npm 레지스트리 DNS 조회가 제한 환경에서 실패했다. 네트워크 권한을 통해 설치했다.
- 제한 환경에서 Vite/Vitest가 realpath EPERM으로 실패했다. 권한을 갖춘 환경에서 실제 재실행 후 통과했다. 최초 실패를 테스트 성공으로 계산하지 않았다.
- 최초 Vitest 3 계열 audit에서 3개 취약점이 확인됐다. 호환 버전 갱신 및 이번 작업 생성 의존성 재설치로 0건이 됐다.
- ESLint 9 지원 종료 경고는 ESLint 10 및 호환 플러그인 갱신으로 해결했다.
- jsdom의 간접 의존성 whatwg-encoding deprecated 안내는 남아 있다. 실행 실패 또는 audit 취약점은 아니다.
- TIFF Deflate에서 UTIF browser build가 Worker의 pako를 찾지 못했다. pako를 명시적으로 제공한 후 실제 Deflate 픽셀 테스트가 통과했다.
- PDF.js 생성 리소스가 lint 대상으로 들어간 문제는 generated vendor 디렉터리를 제외해 해결했다. 앱 코드는 전체 lint 검사를 유지한다.
- 초기 Konva 포함 메인 번들의 500KB 경고는 뷰어 lazy import로 해결했다 (메인 약 242KB, 별도 뷰어 약 329KB).

## 알려진 제한과 진행 작업

현재 진행 작업: 없음. Phase 4는 로컬 검증을 완료했으며 이번 커밋으로 보관한다. 푸시는 보류한다. 다음 우선순위는 Phase 5 출력 DPI/메모리 예산 확정, 새 픽셀 버퍼에 편집과 영구 마스킹 합성, 안전한 PNG/JPEG/PDF/ZIP/TIFF 인코딩 및 잔존 정보 검사다.

테마와 열린 문서는 새로고침 시 초기화한다. TIFF 출력 인코더, PDF 출력 DPI, 브라우저별 큰 Canvas/메모리 한도 및 worker fallback은 후속 구현 전에 검증해야 한다. TIFF는 Worker 미지원 환경에서 명시적으로 중단한다. Firefox/Safari, 복잡한 CCITT/LZW/palette/RGB/EXIF 변형과 대용량 파일 코퍼스 검증은 남아 있다. 자동 테스트는 대용량 성능이나 원본 마스킹 보안 완료를 뜻하지 않는다. 실제 배포 주소/Pages 동작은 미검증이다.

## CI E2E 오류 수정 (2026-10-13)

[실패 실행 38367640034](https://github.com/HeoSeongbin/MaskingViewer/actions/runs/38367640034)의 npm ci, typecheck, lint, format, 단위 테스트, production build, Chromium 설치는 성공했다. E2E에서 TIFF 5코덱 페이지 이동과 HiDPI flip 검사 6개가 실패하고 9개는 통과했다. deploy는 건너뛰어졌다.

공식 Playwright Chromium에서 수정 전 flip 테스트를 임시 복사본으로 실행하여 같은 위치에서 기대 red 대신 이전 blue 픽셀을 읽는 실패를 재현했다. 임시 파일은 검증 후 제거했다. Konva의 batchDraw가 다음 프레임에서 실행되므로 DOM의 aria-busy=false가 Canvas paint 완료를 뜻하지 않는다. 픽셀 기대값을 바꾸지 않고 expect.poll로 실제 결과가 그려질 때까지 검사한다.

변경: e2e/documents.spec.ts, e2e/editing.spec.ts, playwright.config.ts, .github/workflows/pages.yml, README.md, docs/PROGRESS.md, docs/DECISIONS.md. 기존 앱 처리 로직과 의존성/잠금 파일은 변경하지 않았다. Chromium 선택 환경 변수, 실패 trace 보존 및 CI 진단 artifact(7일)를 추가했다.

수정 후 검증: 타입/lint, 단위 95개, /MaskingViewer/ production build 통과. Windows 공식 Chromium 15개 및 Edge 15개 E2E 모두 통과. 수정 전 재현 실패는 성공 결과에 포함하지 않는다. 포맷 검사도 문서 갱신 후 통과했다. 후속 확인: dcf7fd0의 Linux 실행 38369290926은 성공했다. 실패 진단 artifact 업로드 자체는 추가 실패가 없어 미검증이다.

별도 기본 pages build and deployment 실행도 동일 커밋에서 성공했지만 앱의 Validate and deploy Pages 성공과 구분한다. Pages 설정과 최종 제공 산출물의 검증은 여전히 남아 있다. checkout/setup-node의 Node 20 경고는 E2E 실패 원인이 아니다.

## Phase 4 최종 검증 (2026-10-14)

- 타입 검사, ESLint, /MaskingViewer/ production build: 통과.
- 단위 테스트: 11파일 129개 통과. 추가 34개는 mask 이동/경계/모서리 교차/색상 검증, 변환 32조합의 생성·이동·resize, 마스킹+geometry 이력 격리/정리를 검사한다.
- Chromium 및 Edge: 각각 20개 통과. 추가 5개는 HiDPI 2배 생성/이동/resize의 한 작업 Undo, Delete/clear/redo, HEX/불투명 픽셀/숨김/색상 처리 이후 유지, 좌표 입력/복원, zoom+rotation+flips+pan, PDF 초기 회전 및 파일/페이지 격리, Escape/pointercancel, 이미지 경계와 모바일 390px를 검사한다.
- 포맷 검사도 문서 갱신 후 통과했다. screenshot phase-4.png는 PDF/TIFF E2E의 CAPTURE_PHASE4 옵션으로 실제 페이지를 캡처하고 시각 확인했다. 캡처 재현 테스트도 통과했다.
- HEX 입력 JSX 구문 오류는 수정 후 lint/단위/타입/build를 다시 통과했다. 실패한 검증과 이전 빌드로 진행되다 중단한 테스트는 성공으로 계산하지 않는다.
- 원본 마스킹 복구 불가/안전한 다운로드는 미구현·미검증이다. Firefox/Safari, 실제 터치 디바이스, 1,000개 영역/많은 페이지의 메모리 실측 및 Phase 4 원격 Linux 실행은 남아 있다.
- 이전 CI 수정 dcf7fd0의 [Actions 실행 38369290926](https://github.com/HeoSeongbin/MaskingViewer/actions/runs/38369290926)은 성공했다. Phase 4 코드의 원격 결과와 혼동하지 않는다.
