# 개발 진행 상태

최종 갱신: 2026-10-14 (Asia/Seoul). 기준 문서: PROJECT.md / AGENTS.md.

## 프로젝트 시작 상태 및 현재 범위

- 기준 문서 2개와 빈 docs 디렉터리만 존재했다. 기존 구현, 테스트 결과, Git 저장소 또는 remote는 없었다.
- 기준 문서를 전체 읽고 의존성/보안/메모리 제약 및 전체 계층 설계를 DECISIONS.md에 기록했다.
- 이번 작업은 Phase 7 v0.3.0 릴리스 UI·README/포트폴리오/아키텍처·화면·배포 검사, Pages workflow 소스 전환, 원격 CI 성공 및 실제 HTTPS 파일 출력/재개방을 검증했다. 모든 포맷·브라우저·복구 공격 또는 전체 native heap 검증을 뜻하지 않는다.
- PROJECT.md와 AGENTS.md는 수정하지 않았다. Phase 1 `6a2c3d8`, Phase 2 `40b5b2d`, CI 잠금 파일 수정 `e2bb583`는 `origin/main`에 푸시되어 있다. 원격 주소: https://github.com/HeoSeongbin/MaskingViewer.git. Phase 3은 6b0265c로 푸시했다. E2E 타이밍 수정은 dcf7fd0으로 푸시했고 Actions 38369290926의 전체 성공을 확인했다. Phase 4는 d39fe4e로 로컬 커밋했으며 사용자 요청에 따라 푸시하지 않았다. Phase 5는 6529357로 로컬 커밋했다. Phase 6은 0299c12로 로컬 커밋했다. Phase 7의 6c2ac4b와 앞선 3개 커밋을 정상 푸시했다. 원격 CI/Pages와 공개 사이트 검사 증거는 아래에 기록한다.

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

Phase 1 완료 당시 미구현 기능은 안내만 표시했다. Phase 5 현재 업로드/탐색/편집/마스킹/다운로드는 실제 동작한다. Phase 1 당시 GitHub 호스팅은 미검증이었으며 Phase 7에서 실제 배포/사용 흐름을 확인했다.

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

표시 좌표는 정규화된 원본 기준이다. 일반 이미지/TIFF는 원본 px, PDF는 초기 회전을 적용한 1px/pt 기준 raster 좌표(100% = 1pt당 CSS 1px)다. Phase 3에서는 PDF 출력 DPI와 raster 비율 변환을 구현하지 않았으며 이후 Phase 5에서 별도 출력 경로로 구현했다. 1,800px 미리보기 확대는 디코딩 해상도를 높이지 않는다. Phase 3 시점의 원본 좌표/음수 드래그는 순수 엔진 테스트로 검사했고, Phase 4에서는 실제 마스킹 gesture도 검증했다. Phase 3 당시 다운로드 결과 일치/영구 마스킹 보안은 미검증이었다. 최신 결과는 Phase 5 항목을 기준으로 한다.

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

페이지당 최대 1,000개 영역, 가로/세로 최소 원본 기준 1 단위, 페이지별 이력 최대 100개다. 작은 영역의 핸들이 겹치면 확대 또는 좌표 입력을 사용한다. Canvas overlay/thumbnail은 편집 미리보기이며 원본 파일을 제거하거나 안전한 결과 파일을 생성하지 않는다. PDF 기준 좌표는 Phase 3의 normalized 1px/pt를 유지한다. 실제 출력 raster 좌표와의 배율 변환/경계 확장/픽셀 합성/잔존 정보 검증은 이후 Phase 5에서 구현했다.

변경 파일: 신규 src/core/masking/MaskEngine.ts, src/hooks/useMaskGesture.ts, src/components/masking/MaskPanel.tsx, src/tests/MaskEngine.test.ts, e2e/masking.spec.ts, docs/screenshots/phase-4.png. 수정 src/stores/editStore.ts, src/components/viewer/DocumentViewer.tsx, src/components/toolbar/EditToolbar.tsx, src/components/sidebar/DocumentPanel.tsx 및 PropertiesPanel.tsx, src/app/App.tsx 및 styles.css, README.md, docs/PROGRESS.md 및 DECISIONS.md. 직접 의존성, 잠금 파일, 기준 문서는 변경하지 않았다.

## Phase 5 — 완료 (명시한 출력/검증 범위)

- [x] 새 픽셀 버퍼에 실제 불투명 마스킹 합성, 경계 외향 반올림/1픽셀 여백, 보간 없는 회전·반전
- [x] PNG/JPEG, 새 이미지 기반 다중 PDF, 페이지 PNG/JPEG ZIP 출력
- [x] baseline RGB8 무압축 단일/다중 TIFF 인코더와 독립 UTIF 재디코딩 검증
- [x] 현재/전체 범위, 출력 형식/페이지 수/진행 상태/_masked 파일명, 150/300 DPI, 취소/복구/오류 차단
- [x] PNG 전체 픽셀/JPEG 명시한 오차/TIFF 전체 픽셀/ZIP CRC와 이미지/PDF 텍스트·구조·추출 RGB 검증

## Phase 6 — 완료 (명시한 환경·한도·검증 범위)

- [x] 기존 Canvas/픽셀/128MiB 추정 예산 및 200페이지 한도 유지, decode 전 fallback 예산 검사
- [x] 출력 픽셀 Worker와 OffscreenCanvas 인코딩, PDF/TIFF/ZIP 최종 조립·검증 Worker 및 모듈 지연 로딩
- [x] Worker 미지원 시 취소 가능한 동일 합성 커널, 100만 픽셀/8MiB 제한 fallback
- [x] PDF의 페이지별 원시 RGBA 누적 제거, PNG + RGB 전체 SHA-256 검증
- [x] 출력 Canvas 즉시 해제, transferable buffer, 단일 출력 lock, Worker 종료/오류/시간 초과/취소 cleanup
- [x] PNG 비교 chunk 양보, 실행 중 취소 및 재시도, 실제 Worker/Blob URL 0 복귀 검사
- [x] 단위/통합/전체 E2E 회귀와 독립 출력 재검증 유지
- [x] axe WCAG A/AA 자동 검사, light 텍스트 대비 수정, 다운로드 포커스/Escape 흐름
- [x] 400만 픽셀 PNG 출력/응답성, 120페이지 PDF/TIFF 탐색·전체 출력·재개방, 반복 닫기 JS heap 표본
- [x] 성능 보고서 및 CI artifact 구성 (Phase 7에서 실제 업로드/내용 확인)

총 native/Worker/GPU heap과 모든 브라우저/스크린리더·대용량 코퍼스 검증은 완료 처리하지 않는다. 스트리밍/디스크 임시 저장은 미구현이며 한도를 초과하는 결과는 차단한다. 최신 성능 표본은 docs/performance JSON에 보관한다.

## Phase 7 — 완료 (명시한 지원·검증 범위)

- [x] 실제 기능 기준 README/PORTFOLIO/ARCHITECTURE 및 release 화면 5개 작성·시각 확인
- [x] 좌표/영구 마스킹/다중 페이지/성능 문제 해결 및 검증 범위 문서화
- [x] 원격 저장소 연결 및 Phase 1 푸시
- [x] Pages 게시 소스 workflow 전환, 원격 CI 검증 성공 후 실제 배포
- [x] 실제 HTTPS 사이트에서 Chromium/Edge 이미지·PDF·TIFF 열기/편집/다운로드/재개방 각 3검사 통과

README/포트폴리오/아키텍처/릴리스 화면/workflow와 실제 배포 증거를 갱신했다. Phase 7 완료는 아래 지원 범위와 검사에 한정하며 알려진 미지원/확장 범위는 유지한다.

## 가장 최근 검증 결과

Phase 7 v0.3.0, Windows Node 24.12.0/npm 11.6.2 로컬 및 실제 Ubuntu GitHub Actions/HTTPS Pages 기준이다.

| 검사                                  | 결과                                                                                           |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 설치/lock                             | npm ls 통과. 직접 의존성 변경 없음, version만 0.3.0. Linux dry-run 통과, 원격 실제 npm ci 성공 |
| TypeScript / ESLint / Prettier / diff | 로컬·원격 통과 (diff는 로컬)                                                                   |
| Vitest                                | 13파일 164개, 로컬·원격 통과                                                                   |
| Production build                      | `/`와 `/MaskingViewer/` 로컬 성공, 원격 프로젝트 경로 성공                                     |
| 로컬 Chromium / Edge                  | 전체 각 34개 통과 (기존 31 + release 3)                                                        |
| 원격 CI / Pages                       | 6c2ac4b 실행 38524880117 build/deploy success                                                  |
| 공개 HTTPS Chromium / Edge            | 정확한 SHA+dirty=false, 실제 파일 흐름 각 3개 통과                                             |
| 공개 PNG                              | 변환 크기 60×100, 마스킹 (15,15) RGB 0,0,0/255, 비마스킹 cyan, 결과 재개방                     |
| 공개 PDF                              | 초기 회전 + 사용자 회전/flip, 전체 3페이지, font 없음/추출 RGB mask, 결과 재개방               |
| 공개 TIFF                             | Deflate 입력 Worker, 새 다중 RGB TIFF의 mask 픽셀/3페이지, 자체 adapter 재개방/mobile          |
| 리소스/프라이버시                     | 릴리스 첫 흐름에서 HTTP 4xx/5xx 및 외부 POST 0, PDF/TIFF/export module Worker 실제 동작        |
| 성능 artifact                         | phase-6-performance 실제 업로드 및 Linux JSON 내용 확인, phase-7-linux-ci.json 보관            |

공개 주소: https://heoseongbin.github.io/MaskingViewer/. 검증한 기능 릴리스 SHA: 6c2ac4b79d535b9de1dfa671ca9195b3ea3252d1. build-info: version=0.3.0, basePath=/MaskingViewer/, dirty=false, builtAt=2026-10-14T06:53:52.787Z. 기능 릴리스 배포 검증 기록을 보관하는 문서 커밋은 별도로 작성한다.

실행 증거: [Validate and deploy Pages 38524880117](https://github.com/HeoSeongbin/MaskingViewer/actions/runs/38524880117). build와 deploy가 모두 success였고 github-pages artifact(3,260,706bytes), performance artifact(470bytes)를 확인했다. 공개 Chromium 3개(16.9초), Edge 3개(11.6초)가 실제 다운로드와 재개방을 통과했다. 메타데이터 확인만으로 완료 처리하지 않았다.

Linux CI 표본: PDF 120페이지 20.292초/875,323bytes, TIFF 120페이지 1.247초/447,848bytes. baseline/관찰 peak/final CDP JS heap은 1,612,352 / 8,588,956 / 6,476,328bytes. 원본은 docs/performance/phase-7-linux-ci.json이며 아래 Windows 표본과 별개다. 운영체제/폰트/runner 차이 때문에 파일 크기·시간을 보편적 수치로 해석하지 않는다.
출력 보안 검사는 Phase 5의 기존 6개 E2E를 유지한다. Worker/OffscreenCanvas 경로에서도 PNG/JPEG/TIFF/ZIP 재디코딩, PDF 원본 텍스트·주석·첨부·metadata·숨김 구조 제외, 추출 RGB를 검사한다. 이전 단계의 테스트 결과는 아래 이력과 DECISIONS.md에 보존한다.

성능 표본(1회 Windows 실행, 보편 성능 보장 아님):

| 브라우저 | PDF 120페이지 출력     | TIFF 120페이지 출력   | baseline / 관찰 peak / final JS heap   |
| -------- | ---------------------- | --------------------- | -------------------------------------- |
| Chromium | 13.876초, 832,775bytes | 0.970초, 447,848bytes | 1,582,536 / 9,947,672 / 6,426,308bytes |
| Edge     | 14.593초, 832,775bytes | 1.317초, 447,848bytes | 1,673,956 / 8,826,804 / 6,476,856bytes |

원시 보고서: docs/performance/phase-6-chromium.json 및 phase-6-msedge.json. heap은 CDP usedSize 표본이며 native Canvas/decoder/GPU/전체 Worker 메모리를 포함하지 않는다. 최종 강제 GC 후 증가가 32MiB 이하인지 검사한다. baseline 이후 lazy module 로딩도 포함하므로 순수 누수량 또는 전체 순간 peak로 해석하지 않는다. PDF/TIFF 페이지는 512pt/40×30px fixture이며 다양한 실문서 성능을 대표하지 않는다.

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

현재 진행 작업: 없음. Phase 1–7은 명시한 지원 범위로 구현·검증했다. 최종 배포 증거 문서를 반영한다. Firefox/Safari·실제 터치·스크린리더, GIF frame/암호 PDF/추가 TIFF 변형, 전체 native heap/다양한 코퍼스/스트리밍은 남은 확장 범위다.

테마와 열린 문서는 새로고침 시 초기화한다. TIFF 출력은 classic RGB8 무압축, PDF DPI는 150/300으로 검증했다. 출력은 흰색 배경과 사방 1픽셀 마스킹 여백을 적용한다. 출력 Worker 및 제한된 대용량 JS heap 표본은 Phase 6에서 구현했다. 브라우저별 전체 native heap 상한과 디스크 스트리밍은 여전히 미검증/미구현이다. TIFF는 Worker 미지원 환경에서 명시적으로 중단한다. Firefox/Safari, 복잡한 CCITT/LZW/palette/RGB/EXIF 변형과 대용량 파일 코퍼스 검증은 남아 있다. 자동 테스트는 fixture 출력의 마스킹/구조 검증을 뜻하며 대용량 성능이나 모든 복구 공격에 대한 절대적 보안을 뜻하지 않는다. 실제 Pages의 명시한 이미지/PDF/TIFF 흐름은 Phase 7에서 확인했다.

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
- Phase 4 완료 당시 새 픽셀 마스킹/다운로드는 미구현·미검증이었다. 이후 Phase 5의 출력 검증 결과는 위 항목을 기준으로 한다. Firefox/Safari, 실제 터치 디바이스, 1,000개 영역/많은 페이지의 메모리 실측 및 Phase 4 원격 Linux 실행은 남아 있다.
- 이전 CI 수정 dcf7fd0의 [Actions 실행 38369290926](https://github.com/HeoSeongbin/MaskingViewer/actions/runs/38369290926)은 성공했다. Phase 4 코드의 원격 결과와 혼동하지 않는다.

## Phase 5 구현 및 발견한 문제 (2026-10-14)

- 새 기능: 공통 출력 pipeline, 원본 픽셀/지정 DPI 렌더링, 새 버퍼의 색상/불투명 마스킹/정수 기하 합성, PNG/JPEG/PDF/ZIP/TIFF 인코딩과 검증, 다운로드 UI/진행 상태/취소. PDF는 원본 객체를 복사하지 않는다. 검증 실패와 취소 후 파일을 전달하지 않는다.
- 신규 파일: src/core/export/ExportPipeline.ts, pixels.ts, TiffExporter.ts; src/components/dialogs/ExportPanel.tsx; src/tests/export.test.ts; e2e/export.spec.ts; docs/screenshots/phase-5.png.
- 수정 파일: src/core/document/DocumentModel.ts, PageRenderer.ts; src/adapters/pdf/PdfAdapter.ts; src/app/App.tsx, styles.css; src/components/masking/MaskPanel.tsx, sidebar/PropertiesPanel.tsx; src/tests/App.test.tsx, PageRenderer.test.ts; e2e/masking.spec.ts; package.json, package-lock.json; README.md, docs/PROGRESS.md, DECISIONS.md. PROJECT.md/AGENTS.md는 변경하지 않았다.
- pdf-lib 1.17.1을 runtime 의존성으로 이동하고 JSZip 3.10.1을 추가했다. 원본 입력 adapter/geometry/color 커널을 재사용했다. 잠금 파일 Linux dry-run 및 실제 npm ci 모두 통과했다.
- 새 PDF의 빈 Annots 배열이 보안 검사에 걸려 다운로드를 차단했다. 라이브러리가 추가한 빈 배열을 저장 전에 제거해 출력에 주석 항목 자체를 남기지 않는다. 실제 원본 주석/첨부/텍스트가 존재하는 fixture와 출력의 부재를 PDF.js로 확인했다.
- 초기 E2E 버튼 이름/fixture 기대값 및 PDF 인쇄 크기의 부동소수점 비교 오류를 수정했다. 소수 크기는 12자리 정확도 비교이며 픽셀 기대값은 그대로 유지한다. 실패 결과는 성공 결과로 계산하지 않는다.
- 깨끗한 npm ci의 첫 시도는 실행 중인 4173 preview의 Windows 네이티브 모듈 파일 잠금으로 실패했다. 해당 프로젝트 preview만 종료한 후 실제 재설치에 성공했고 최신 build로 서버를 복원했다. npm ci를 npm install로 우회하지 않았다.
- 제한: 최대 200페이지, 작업 추정 예산 128MiB와 기존 픽셀 한도를 함께 적용한다. JPEG 품질 0.98/마스킹 채널 오차 64 검사, TIFF 무압축 RGB8, 투명 배경 흰색 합성, 마스킹 1픽셀 여백을 UI/README에 안내한다. 큰 300DPI PDF는 예산 초과로 거부할 수 있다. 자동 축소하지 않는다. 원본 파일/세션은 유지하며 출력 파일의 보안 범위와 구분한다.
- Phase 6의 대용량 Worker/스트리밍/실측, 실제 터치·Safari·Firefox, 원격 CI/Pages는 미검증이다. 이번 변경은 로컬 커밋으로 보관하며 푸시는 진행하지 않는다.

- Phase 5 최종 검증: 타입/ESLint/production 서브경로 build/Prettier/diff 검사 통과, Vitest 12파일 150개, Chromium 26개(36.7초) 및 Edge 26개(37.6초) E2E 모두 통과. 4173 preview는 최신 빌드로 복원했다.

## Phase 6 구현 및 발견한 문제 (2026-10-14)

- 공통 Worker job으로 성공/실패/취소/timeout을 처리하고 합성·최종 조립을 분리했다. PDF 원시 RGBA를 누적하지 않고 전체 RGB SHA-256을 비교한다. 기존 출력 안전성 검사를 유지했다. PNG 검사는 chunk로 UI에 양보한다.
- 픽셀 Worker가 초기 582KB로 모든 인코더를 포함하던 비용은 Vite es module Worker와 lazy import로 4.31KB까지 줄였다. 어댑터/색상/마스킹 좌표/원본 문서는 재작성하지 않았다.
- axe가 accent/tint 4.39 및 muted/background 4.35 등 대비 부족을 검출했다. 규칙 제외 없이 semantic token을 수정해 light/dark/mobile 편집·출력 검사를 통과했다.
- 신규: src/core/export/ExportWorker.ts, FinalizeExport.ts, fingerprint.ts; src/workers/export.worker.ts; src/tests/exportWorker.test.ts; e2e/optimization.spec.ts; docs/performance/phase-6-chromium.json, phase-6-msedge.json.
- 수정: src/core/export/ExportPipeline.ts, pixels.ts; src/core/document/PageRenderer.ts; src/components/dialogs/ExportPanel.tsx; src/app/App.tsx, styles.css; src/tests/PageRenderer.test.ts; scripts/fixtures.mjs, fixtures.d.mts; vite.config.ts; package.json, package-lock.json; .github/workflows/pages.yml; README.md, docs/PROGRESS.md, DECISIONS.md.
- @axe-core/playwright 4.13.0을 devDependency로 추가했다. 실제 npm ci와 Linux 대상 dry-run 성공, audit 0건이다. 깨끗한 설치를 위해 4173 preview를 일시 종료한 후 최신 빌드로 복원했다.
- Phase 7 원격 배포, native heap 전체 측정, Firefox/Safari·터치·스크린리더, 다양한 큰 TIFF/PDF 코퍼스 및 디스크 스트리밍은 완료 처리하지 않는다. 이번 Phase 6 변경은 로컬 커밋으로 보관하며 푸시는 진행하지 않는다.

- Phase 6 최종 재확인: 실제 npm ci 및 Linux 대상 dry-run, 타입/ESLint/Vitest 164개/Prettier/production 서브경로 build 통과. Chromium·Edge 전체 31개씩 통과했으며 깨끗한 설치 후 CI와 같은 test-results/performance 경로의 120페이지 전체 출력/보고서 생성 검사도 통과했다. 4173 preview를 최신 빌드로 복원했다. 원격 CI 업로드와 실제 배포는 실행하지 않았다.

## Phase 7 준비 (2026-10-14)

- v0.3.0, 사용자 화면에서 개발 Phase 표시 제거, meta description/버전 정리. build-info.json에 version/commit/base/dirty/builtAt 기록. 생성물은 Git 제외.
- 로컬 production 릴리스 검사 3개 통과: PNG 복합 변환 픽셀과 재개방/외부 POST 부재, 초기 회전 PDF의 전체 출력·이미지 구조·픽셀·재개방, 다중 TIFF 출력·재개방·모바일.
- 실제 검사 화면 5개(welcome/editor-light/editor-dark/download/mobile)를 docs/screenshots/release에 캡처했다. fixture만 사용했다.
- 공개 Pages HTTP 200과 기존 Phase 3 번들을 확인했다. API의 build_type=legacy, main 루트 게시 설정을 확인했다. 기존 기본 pages build and deployment와 앱 workflow가 함께 실행되어 검증한 앱 산출물만 배포하도록 GitHub Actions 게시 소스로 전환할 예정이다.
- 로컬 전체 회귀/원격 CI/공개 사이트 정확한 SHA 및 실제 파일 재검증을 아직 완료 처리하지 않는다.

- Phase 7 로컬 검증: 타입/ESLint/Prettier/Vitest 164개/production 서브경로 build 통과. Chromium 전체 34개 통과, Edge 전체 34개 통과. 아직 원격 릴리스 배포 검증 전이다.

- Phase 7 변경 파일: README.md, docs/ARCHITECTURE.md, PORTFOLIO.md, DECISIONS.md, PROGRESS.md; release screenshot 5개; e2e/release.spec.ts, playwright.deployment.config.ts; scripts/build-info.mjs, src/env.d.ts; src/app/App.tsx, index.html, vite.config.ts, tsconfig.json, package.json/lock, .gitignore, .github/workflows/pages.yml. PROJECT.md/AGENTS.md는 변경하지 않았다.

- 배포 전 최종 로컬 검사: 타입/ESLint/Prettier, Vitest 13파일 164개, Chromium/Edge 전체 34개씩, 루트와 /MaskingViewer/ production build, Linux x64/glibc npm ci dry-run 통과. 원격 CI 및 실제 사이트 검증을 위해 이번 릴리스를 커밋·정상 푸시한다.

## Phase 7 배포 완료 및 문제 해결 (2026-10-14)

- Pages 설정 변경의 첫 요청은 잘못된 PATCH 방식으로 404가 발생했다. 공식 REST API의 PUT으로 수정해 build_type=workflow를 다시 읽어 확인했다. 기존 브랜치 자동 배포와의 중복을 제거했다. 인증 정보는 로그/파일에 저장하지 않았다.
- 6c2ac4b와 Phase 4–6을 정상 푸시했다. 원격 CI의 build/deploy success, 새 performance artifact의 실제 내용, 공개 사이트 SHA/dirty=false와 실제 파일 검증을 확인했다.
- 기준 PROJECT.md/AGENTS.md, 기존 기능/커밋을 보존했다. 원격의 강제 덮어쓰기나 원본 PDF 재사용 없이 배포했다. source/chunk/Worker는 실제 파일 흐름으로 확인했다. CMap/ICC/폰트/WASM 대표 경로는 별도 HTTP 200 검사로 확인했으며 모든 문자·codec 조합의 렌더링 검증을 뜻하지 않는다.

- 공개 PDF.js 리소스 HTTP 검사: cmaps/78-EUC-H.bcmap (2,404bytes), iccs/CGATS001Compat-v2-micro.icc (8,464bytes), standard_fonts/FoxitDingbats.pfb (29,513bytes), wasm/jbig2.wasm (103,671bytes)는 모두 200. 공개 문서 렌더링과 자원 경로 검사를 구분했다.
