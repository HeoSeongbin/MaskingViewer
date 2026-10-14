# 기술 결정 및 전체 아키텍처

기준: PROJECT.md 전체 및 AGENTS.md. 작성일: 2026-10-13.
현재 Phase 1–4를 구현했다. 아래 초기 전체 설계 중 출력은 이후 단계의 계약이다. 실제 Phase 2 결정은 009, Phase 3 결정과 검증 범위는 011, Phase 4는 013에 기록한다.

## 001. 계층과 의존성

```text
app / components (한국어 UI)
  → features (사용자 작업 조정) → stores (직렬화 가능한 편집 상태)
  → core/document (Loader, Adapter 계약, PageRenderer)
     → adapters/raster | pdf | tiff (형식별 파싱/디코딩)
  → core/geometry (순수 affine 정방향/역방향 변환)
  → core/masking (원본 페이지 좌표의 영역)
  → core/export (새 픽셀 생성 → 검사 → 형식 인코딩 → 검사 → 다운로드)
     → workers (지원되는 디코딩/픽셀 처리)
```

UI는 파일 파싱, 좌표 계산, 픽셀 처리 또는 인코딩을 직접 수행하지 않는다. 포맷 차이는 어댑터와 출력 인코더에서만 처리한다. 동일한 페이지 렌더링과 편집 흐름을 재사용한다. Phase 1에서는 경계별 디렉터리와 실제 레이아웃/테마 store만 생성한다. 빈 함수나 성공을 반환하는 가짜 엔진을 만들지 않는다.

## 002. 공통 문서 계약과 리소스 소유권 (Phase 2)

- Loader: 확장자/MIME과 magic bytes를 교차 확인하고 지원 형식에만 어댑터를 선택한다. 손상 파일과 미지원 코덱은 명확한 오류로 반환한다.
- DocumentModel: 문서 ID, 이름, 파일 크기, 형식, 페이지 메타데이터와 페이지 ID를 보유한다. 편집 상태는 페이지 ID와 연결한다.
- Adapter 계획: `open(file, signal)`, `getPageMetadata(index, signal)`, `renderPage(index, resolution, signal)`, `dispose()` 계약. PDF 암호 입력/취소를 로딩 상태로 다룬다.
- PDF는 PDF.js worker로 파싱하고 페이지 viewport, 초기 rotation, PDF 단위 및 출력 DPI를 별도 메타데이터로 유지한다. TIFF는 IFD를 통해 페이지를 열거하고 지원 압축 방식을 fixture로 검증한다. 일반 이미지는 브라우저 디코더 지원을 확인한다. GIF 프레임 지원 범위는 별도로 검증한다.
- ImageBitmap, Canvas, 원본 File, Blob URL, PDF document handle은 core의 resource registry가 소유한다. Zustand와 Undo 히스토리에 바이너리를 복제하지 않는다.
- 썸네일/화면 미리보기/출력 렌더링 해상도를 분리한다. 활성 페이지 주변만 지연 렌더링하고 byte budget 기반 LRU 캐시를 둔다. 페이지 전환 시 이전 요청을 취소하고, 취소 불가능한 결과는 request ID로 폐기한다. 문서 닫기 시 bitmap.close, URL.revokeObjectURL, PDF destroy 등을 호출한다.

## 003. 상태와 Undo/Redo (Phase 2–4)

Zustand selector로 UI 구독 범위를 좁힌다. 문서 목록/활성 페이지, 페이지별 편집 상태, 도구/선택 영역, 뷰포트, 로딩/출력 작업 상태를 나눈다. 초기 Phase 1 store는 테마 전환만 제공한다.

페이지 편집 상태에는 회전(90도 단위), 수평/수직 반전, 색상 보정, 마스킹 목록을 둔다. Undo/Redo는 이 직렬화 가능한 상태의 변경 기록 또는 command patch만 보관한다. 드래그는 시작/종료를 한 transaction으로 묶고, 기록 개수/크기를 제한한다. 화면 확대/이동은 편집 히스토리와 분리한다.

## 004. 좌표 및 표시/출력 일치 (Phase 3–5)

원본 페이지의 정규화된 픽셀 좌표가 마스킹의 기준이다. PDF 원본 좌표 → 초기 회전이 반영된 기준 raster 좌표 변환은 어댑터가 보유한다. 이후 사용자가 적용하는 회전/반전은 geometry 엔진이 담당한다. PDF 원래 페이지 크기(pt)는 보존하여 출력 크기를 계산한다.

동차 affine matrix로 `원본 → 편집 회전/반전 및 양수 경계 보정 → fit/zoom → pan → Stage → 화면`을 합성한다. 포인터 입력은 역행렬로 원본 좌표로 변환한다. devicePixelRatio는 Canvas backing buffer 설정이며 편집 좌표에 누적하지 않는다. 회전된 bounding box 크기와 원점 이동을 함께 계산한다. 음수 드래그를 정규화하고 이미지 경계에 clamp한다.

Konva/react-konva는 미리보기 및 편집 핸들만 담당한다. 표시와 출력은 같은 geometry 모델 및 색상 연산 순서를 사용하되, 화면 배율과 pan은 출력에 포함하지 않는다. 전체 변환 조합과 왕복 오차를 순수 함수 단위 테스트로 검증한다.

## 005. 출력과 영구 마스킹 (Phase 5)

파싱/디코딩 → 출력 해상도 raster → 색상/기하 편집 → 변환된 영역에 불투명 단색 마스킹 → 새 버퍼 검증 → 새 인코더 → 재디코딩/구조 검증 → 다운로드 순서를 사용한다. 영역 변환과 픽셀 경계 반올림은 바깥 방향으로 수행하며 마스킹 합성은 마지막 픽셀 연산으로 한다. 숨김 미리보기 상태는 출력에 적용하지 않는다.

원본 바이트, PDF 페이지 객체, 텍스트/주석/첨부/숨김 레이어 및 원본 메타데이터를 출력에 복사하지 않는다. PDF는 pdf-lib 후보를 통해 처리된 이미지만 새 문서에 삽입한다. Stage 스크린샷은 출력 원본으로 사용하지 않는다. 검증 실패 시 다운로드를 차단하고 검증 범위를 UI에 표시한다.

PNG는 무손실 기본 출력이다. JPEG는 손실 압축으로 단색 경계 픽셀이 달라질 수 있으므로 압축 전 제거 보장과 재디코딩 검사 기준을 구분하고, 필요 시 안전 여백을 적용한다. 투명 원본을 JPEG로 변환할 때는 배경색을 명시한다. 여러 PNG/JPEG 페이지는 JSZip 후보로 묶고, PDF/TIFF는 페이지 순서대로 순차 인코딩한다.

## 006. 요구사항의 주의점과 검증 관문

1. PDF는 고정된 '원본 픽셀 해상도'가 없다. 출력 DPI 정책 및 최대 픽셀/메모리 제한을 명시해야 한다. 이미지 기반 재생성 시 검색/복사/링크/벡터 기능 소실을 UI/README에 안내한다.
2. TIFF 디코더의 지원 압축 방식과 인코더의 다중 페이지 지원은 별개다. UTIF.js 등은 후보이며 Phase 2 입력 및 Phase 5 출력 fixture/재개방 검사 후 채택한다. 인코딩 불가가 확인되면 근거를 문서화하고 PDF/ZIP 대안을 제공한다. 목표를 임의로 삭제하지 않는다.
3. PROJECT.md의 '비활성화된 버튼을 남기지 않는다'와 단계별 구현을 함께 준수한다. Phase 1에는 예정 기능 안내만 표시하고 실제로 동작하는 테마 버튼만 제공한다.
4. SVG 원본 DOM 삽입 금지, HEIC/AVIF/ICO의 브라우저/디코더 지원 검토, GIF 프레임 처리는 후속 단계에서 분리 검증한다. 확장 포맷을 지원 완료라고 표시하지 않는다.
5. 브라우저 Canvas 크기 제한은 환경마다 다르다. 작업 전 width×height×4와 중간 버퍼 예산을 확인하고 초과 시 중단한다. 전체 페이지를 동시에 최고 해상도로 만들지 않는다. ZIP 최종 버퍼도 메모리 예산에 포함한다.
6. Worker/OffscreenCanvas가 불가능한 환경에서는 비동기 분할 작업 및 제한된 fallback을 제공한다. 일반 worker는 TIFF/색상/합성에 검토하고 PDF.js 전용 worker와 분리한다. worker 지원이 메모리 무제한을 의미하지 않는다.
7. PDF 보안 검사는 텍스트 추출 + 객체/첨부/주석 구조 + 추출 이미지 픽셀 검사를 함께 수행한다. 기능 테스트만으로 절대적 보안을 선언하지 않는다.

## 007. Phase 1 도구와 배포

React 19, TypeScript 6 strict, Vite 8, Tailwind 4 Vite plugin, Zustand 5, Lucide를 사용한다. 최초 후보인 Vitest 3에서 npm audit 취약점이 확인되어 Vite 8.3.4 / Vitest 5.0.4 / React plugin 6.1.2로 갱신했다. npm registry의 peerDependencies로 Tailwind와 Vitest의 Vite 8 호환 범위를 확인했고 실제 빌드/테스트로 검증했다. 지원 종료 경고가 발생한 ESLint 9도 ESLint 10 및 호환 hooks/refresh 플러그인으로 갱신했다. 실제 설치 버전은 package-lock.json에 고정한다. Node 24를 로컬/CI 기준으로 한다. 후속 포맷 라이브러리는 해당 단계의 호환성/코덱 검증 후 설치한다.

디자인은 CSS semantic token(표면/텍스트/경계/강조) 기반 light/dark 테마와 일관된 간격/패널 구성이다. Tailwind Vite plugin 및 font theme를 통합하고 복잡한 레이아웃은 CSS class로 표현한다. 반응형에서는 패널을 삭제하지 않고 아래쪽으로 재배치한다. 한국어 기본, semantic landmark, skip link, 키보드 focus를 제공한다. 테마는 현재 세션 상태만 유지한다.

Vite base는 VITE_BASE_PATH로 주입한다. CI는 저장소 이름으로 프로젝트 Pages 경로를 계산하고 사용자/조직 루트 Pages는 `/`를 사용한다. custom domain은 이후 base 정책을 갱신해야 한다. PDF.js worker와 codec 리소스는 CDN 없이 Vite asset import/new URL 기반으로 번들링할 계획이며 Phase 2에서 실제 서브경로 테스트를 수행한다.

Actions는 PR에서 install/typecheck/lint/format/test/build를 수행하고 main의 성공한 빌드만 Pages에 배포한다. Phase 2에서 Chromium E2E도 배포 전 조건으로 추가했다. GitHub remote는 연결했고 Phase 1을 푸시했으며, Pages 설정 및 실제 배포는 미검증이다. URL 라우터는 현재 필요하지 않다.

## 008. 테스트 확장

Phase 1: jsdom + Testing Library로 landmark, 미구현 안내 및 실제 테마 전환을 검증한다. Phase 2: 형식별 정상/손상/암호/다중 페이지 fixture 및 취소/자원 해제 테스트. Phase 3–4: affine 조합/경계/히스토리 테스트. Phase 5: 출력 재디코딩 및 PDF 구조 보안 검사. Phase 6: Playwright 사용자 흐름, 메모리, 접근성, worker fallback 및 대용량 fixture 테스트. 배포 서브경로 리소스 검사는 포맷 기능 도입 시 반드시 추가한다.

## 009. Phase 2 실제 구현 및 지원 관문 (2026-10-13)

- Adapter 계약은 이미 열린 인스턴스의 `pageCount`, `getPageMetadata`, `renderPage(maxEdge)`, `dispose`로 구현했다. Loader가 파일 선택 및 형식 분기를 담당한다. Zustand에는 문서 메타데이터와 페이지 번호만 저장하고 실제 바이너리/Canvas/PDF handle은 어댑터/renderer가 소유한다.
- 일반 이미지는 브라우저 Image 디코더를 사용한다. PNG/JPEG/BMP/GIF/WEBP 헤더 크기를 먼저 읽어 픽셀 한도를 검사하고 디코딩 후 natural size도 다시 검사한다. EXIF 등 브라우저가 적용한 방향을 normalized raster 기준으로 삼는다. GIF는 첫 프레임만 제공하고 UI에 제한을 표시한다.
- [PDF.js 공식 예제](https://mozilla.github.io/pdf.js/examples/index.html)의 getDocument/getViewport/render 흐름을 사용한다. pdfjs-dist 6.4.299에서 이전 버전의 isEvalSupported 옵션은 타입에 없어 사용하지 않는다. `onPassword`에서 작업을 종료하고 암호 보호 안내를 제공한다. 초기 rotation은 getViewport에 반영하고 pt 단위 크기/rotation을 별도 표시한다. 최대 2px/pt의 preview를 1,800px 한 변으로 제한하며 출력 DPI는 구현하지 않는다.
- PDF worker는 Vite `?url`로 번들링한다. CMap/standard_fonts/WASM/ICC는 predev/prebuild 스크립트로 설치 패키지에서 public/pdfjs로 복사하고 BASE_URL 기준으로 읽는다. LICENSE도 포함한다. CDN 없이 같은 사이트 리소스만 사용한다. 생성 폴더는 Git/lint/format 대상에서 제외한다.
- TIFF는 [UTIF 공식 API](https://github.com/photopea/UTIF.js) decode/decodeImage/toRGBA8을 Worker에서 사용한다. 제한된 classic IFD 구조를 먼저 검사하고, 요청당 필요한 페이지만 풀 디코딩한 뒤 transferable RGBA 버퍼를 전달한다. UTIF의 browser build가 self.pako를 읽으므로 Worker에서 직접 제공해야 한다. Worker 렌더 취소 시 terminate하고 필요하면 File에서 재시작한다. 처리 timeout은 30초다.
- TIFF orientation 1–8을 어댑터에서 정규화한다. 사용자 편집 회전과는 별개이다. 안전하게 다룰 수 없는 BigTIFF/tiled/16bit/planar-separated/JPEG-in-TIFF 등은 현재 거부한다. six codec fixture 및 페이지별 픽셀 테스트는 선언한 지원의 기본 관문이며 모든 조합의 호환을 보장하지 않는다. TIFF 다중 페이지 출력 목표에는 변경이 없다.
- 렌더링은 전역 순차 큐로 한 번에 한 decode만 수행한다. 취소된 큐 작업은 실행 전에 폐기한다. active preview를 먼저 표시한 뒤 현재 페이지 주변 최대 7개 썸네일을 요청한다. 48MiB LRU canvas cache와 추가로 현재 UI가 참조하는 Canvas만 유지한다. cache eviction은 참조 제거로 처리하고 UI에서 아직 사용하는 Canvas를 0 크기로 바꾸지 않는다. 문서 닫기 후 도착한 결과는 0 크기로 해제하고 캐시에 재등록하지 않는다. 직전 결과를 큐 tail promise에 보관하지 않는다.
- 입력 총량/픽셀/문서/페이지 한도는 PROGRESS.md에 명시했다. 실제 decoder 중간 버퍼와 브라우저 native 메모리까지 포함한 절대 heap 상한은 아니며 대용량 벤치마크는 Phase 6에 남아 있다. 원본 파일을 서버로 전송하는 코드가 없다.
- PDF/TIFF는 lazy import, Konva viewer는 React.lazy로 분리했다. 초기 메인 bundle은 약 242KB이며 viewer/pdf 엔진은 필요한 시점에 로드한다.
- E2E는 직접 생성한 PNG/JPEG/BMP/GIF/WEBP/PDF/TIFF/손상/암호 안내 fixture를 production 서브경로에서 실행한다. Windows는 설치된 Edge, Linux CI는 Chromium을 사용하도록 구성했다. CI E2E base는 build의 VITE_BASE_PATH를 따른다. Phase 2 CI 실행은 npm ci 단계에서 실패했고, 아래 010의 수정을 e2bb583으로 푸시했고 실행 38361812212의 성공을 확인했다. 이후 Phase 3 CI와 수정은 012에 기록한다.

## 010. CI 의존성 잠금 파일 복구 (2026-10-13)

GitHub 실행 38359540248은 npm ci에서 실패하여 나머지 검사와 배포가 건너뛰어졌다. 로컬 npm ci --dry-run에서도 EUSAGE 및 @emnapi/core/runtime/wasi-threads, tslib 누락을 재현했다. 이전 npm install 성공만으로 깨끗한 설치의 재현성을 검증하지 못한 것이다.

기존 node_modules 또는 불완전한 잠금 파일을 유지한 npm install --package-lock-only는 오류를 고치지 못했다. 별도 임시 폴더에 package.json만 복사하여 package-lock.json을 새로 생성한 뒤 교체했다. 다른 플랫폼의 optional/bundled 의존성 트리가 복구되었고 일부 하위 패키지 배치가 바뀌었다. 직접 의존성 선언은 유지했다. user-event의 허용 범위 내 패치 버전은 14.6.7에서 14.6.8로 변경되었다.

실제 npm ci, Linux x64/glibc를 지정한 npm ci dry-run, 타입/lint/포맷, 23개 단위 테스트, production 서브경로 빌드 및 10개 Windows Edge E2E가 통과했다. Linux dry-run은 실제 Linux에서 빌드/브라우저를 실행했다는 의미가 아니다. GitHub 재실행 및 Pages 성공 여부는 푸시 후 별도로 확인해야 한다.

앞으로 잠금 파일을 수정하면 npm install 결과와 별도로 npm ci를 검사한다. 설치 재현 실패를 우회하려고 CI를 npm install 또는 --legacy-peer-deps/--force로 바꾸지 않는다. Windows에서 native 모듈이 잠긴 경우 이 프로젝트의 Vite 서버만 종료한 뒤 설치 검증하고 다시 실행한다.

## 011. Phase 3 편집과 좌표 변환 (2026-10-13)

- 순수 affine 행렬은 Canvas와 같은 [a,b,c,d,e,f] 규약이다. 정규화된 원본 → 시계 방향 90° 단위 회전 → 회전된 화면 기준 좌우/상하 반전 → 양수 경계 보정 → zoom → 중심 배치/pan으로 합성한다. Konva Group은 같은 행렬의 translation과 회전/scale을 적용한다. 홀수 90° 회전에서는 Group의 local scale 축을 교환하여 화면 기준 flip과 일치시킨다. thumbnail도 같은 geometry를 사용한다.
- CSS screen→Stage는 DOM rect 비율로 변환하고 원본 좌표는 전체 행렬의 역행렬로 얻는다. HiDPI는 Konva backing buffer에만 적용한다. 확대 이전 pointer의 원본 위치를 새 행렬에서도 같은 화면 점으로 맞춘다. 단, 화면 밖 이탈 방지를 위한 pan clamp가 필요한 가장자리에서는 clamp가 우선한다. 최소/최대 zoom은 1–800%, 페이지가 화면에 맞으면 기본 zoom은 최대 100%다. 화면/너비 맞춤은 resize와 편집 크기 변화 시 재계산한다.
- 포인터 위치를 유지하는 확대 방식은 [Konva 공식 예제](https://konvajs.org/docs/sandbox/Zooming_Relative_To_Pointer.html)를 참고했다. 입력은 DOM pointer capture와 non-passive wheel listener로 처리하고 행렬 계산 자체는 Konva와 분리한다.
- raster/TIFF는 정규화된 원본 px를 기준으로 한다. PDF는 PDF.js 초기 viewport 회전을 이미 반영한 1 raster px/pt 좌표를 기준으로 하며 사용자 회전을 추가한다. 100%의 의미는 CSS 1px/원본 기준 단위이며 PDF UI에 명시한다. preview Canvas 픽셀 수를 geometry 기준으로 사용하지 않는다. Phase 5 출력 DPI와 기준→출력 raster 비율 변환은 별도로 구현해야 한다.
- Zustand editStore는 documentId:pageIndex별 serializable 편집/viewport/이력만 저장한다. geometry/color는 페이지별이며 확대/pan은 Undo 대상이 아니다. 회전/반전/색상 변경만 최대 100개/페이지 이력에 기록하고 slider pointer 또는 keyboard 작업을 transaction으로 묶는다. 현재 페이지에만 Undo/Redo를 적용한다. 문서 닫기 시 편집/viewport/이력/표시 배율도 삭제한다. Phase 4의 마스킹 데이터와 transaction은 아직 연결하지 않았다.
- 색상 순서는 invert → Rec.709 가중 grayscale(선택 시) → 대비 → 밝기 → binary threshold(선택 시)다. 흑백은 임계값 128의 0/255 단색 값이며 grayscale과 구분한다. RGB를 clamp하고 alpha는 유지한다. 미리보기 원본을 수정하지 않고 새 Canvas/픽셀 사본에 적용한다. 동일 순수 커널을 색상 Worker와 작은 thumbnail에서 재사용하며 Phase 5에서도 재사용할 수 있다.
- 색상 preview는 최대 1,800px 입력을 Worker에 transferable 사본으로 전달한다. 상태 변경/페이지 전환/문서 닫기 시 terminate 및 임시 Canvas 해제, 결과 signature 비교로 이전 결과를 폐기한다. 10초 timeout/실패 안내 후 색상 복원으로 재개할 수 있다. Worker API가 없는 raster 환경은 제한된 preview의 main-thread fallback을 사용하며 대용량 성능 보장은 아니다. TIFF의 Worker 필수 원칙은 유지한다.
- 데스크톱은 viewport 높이에 맞춰 작업 영역을 배치하고 패널 내부에서 스크롤한다. 좁은 화면은 기존처럼 패널을 아래로 재배치하고 도구를 줄바꿈한다. 페이지별 수정 표시와 thumbnail은 미리보기이며 파일 저장 완료를 의미하지 않는다.
- 검증: 단위 95개 및 production /MaskingViewer/의 Windows Edge E2E 15개. affine 64조합 왕복/방향/경계/역행렬/zoom, 색상 alpha/threshold, 이력 branching/한도/자원 상태 정리, HiDPI 실제 비대칭 픽셀, PDF 초기 회전·페이지 보존, TIFF preview/thumbnail 색상 일치, Worker 오류 복구/fallback 및 페이지 전환을 확인했다. 마스킹 생성/출력/보안, 다른 브라우저 및 대용량 성능은 후속 관문이다.

## 012. Canvas paint를 기다리는 E2E 검사 (2026-10-13)

Phase 3 CI(38367640034)는 E2E 6개 실패로 배포가 중단됐다. Chromium에서 원래 HiDPI 테스트의 flip 직후 픽셀 오류를 같은 위치에서 재현했다. Konva batchDraw는 requestAnimationFrame으로 실제 Canvas draw를 예약하며, React DOM의 준비 상태와 paint 시점은 다르다. aria-busy 또는 속성 상태만 확인한 뒤 즉시 픽셀을 읽던 테스트가 이전 frame/투명 Canvas를 읽었다.

모든 TIFF 및 편집 픽셀 검사는 expect.poll로 정확한 기대 RGB/RGBA가 나타날 때까지 기다린다. 예상 색상/좌표/허용 오차를 바꾸거나 고정 sleep, 전체 테스트 retry, 테스트 삭제로 우회하지 않는다. 앱은 기존 비동기 batchDraw를 유지하여 상호작용마다 강제 동기 draw 비용을 추가하지 않는다.

PLAYWRIGHT_CHANNEL=chromium은 OS와 관계없이 Playwright bundled Chromium 기본 실행기를 선택한다. 기본 Windows는 기존 Edge, Linux는 bundled Chromium이다. 이를 통해 Windows에서도 CI 엔진의 paint 타이밍을 재현할 수 있다. trace는 실패 때 유지하고 CI는 실패 시 test-results를 7일간 업로드한다. 진단 artifact의 실제 원격 업로드는 다음 실패 실행이 생겨야 확인할 수 있다.

수정 후 Windows Chromium/Edge 각각 E2E 15개, 단위 95개, 타입/lint/production build가 통과했다. Linux 원격 재실행은 아직 하지 않았으며 로컬 Chromium 성공을 Linux 성공으로 기록하지 않는다. 의존성과 원본 좌표/색상 처리에는 변경이 없다.

## 013. Phase 4 마스킹 편집 (2026-10-14)

MaskRegion은 id/pageId/원본 기준 x/y/width/height/불투명 fill만 보유한다. pageId는 기존 documentId:pageIndex key를 사용한다. PDF는 초기 viewport 회전이 반영된 normalized 1px/pt 기준 좌표를 그대로 사용한다. 화면 배율과 backing DPR은 저장 영역에 들어가지 않는다. geometry의 전체 역행렬로 입력을 변환한다.

MaskEngine은 hit/모서리/경계/move/resize/검증의 순수 함수다. UI pointer capture와 임시 drag 상태는 useMaskGesture, 세션 내 편집 데이터는 editStore, 속성 입력은 MaskPanel에 분리했다. 생성 후 선택 도구로 전환하고 기존 Konva Group 안에 영역/선택선/핸들을 표시한다. 핸들의 hit 반경은 Stage CSS 좌표, 표시 크기는 zoom 역수로 보정한다. 겹친 mask는 마지막 추가된 영역이 위쪽이다.

드래그 동안 store/history를 갱신하지 않고 draft만 표시한다. pointerup의 최종 좌표를 반영한 뒤 한 번 commit한다. 0 크기 클릭, Escape, pointercancel, capture loss 또는 컴포넌트 종료는 미완성 작업을 폐기한다. 화면 wheel은 gesture 중 중단하여 입력 행렬이 바뀌지 않게 한다. min 가로/세로는 원본 기준 1 단위이며 생성은 페이지 내부에서 시작한다. 이동은 크기를 유지해 경계에 clamp, 모서리 교차는 반대 모서리를 기준으로 정규화한다.

masks를 PageEdit에 추가하여 회전/반전/색상과 마스킹 생성·이동·resize·색상·삭제를 같은 Undo/Redo 순서로 처리한다. immutable 배열/변경 객체만 보관하고 원본 바이너리 또는 Canvas는 복제하지 않는다. 영역 1,000개/페이지 및 이력 100개/페이지로 제한한다. 전체 세션 메모리 상한을 보장하지는 않으며 실측은 Phase 6에 남긴다.

선택 id, 표시/숨김, 도구와 새 영역 기본 색상은 UI 상태로 분리한다. 숨김은 원본 preview 확인에만 쓰고 영역 데이터/이력에 포함하지 않는다. thumbnail은 숨김과 관계없이 저장된 마스킹을 표시한다. 문서 닫기 시 UI 상태도 삭제한다. 삭제 후 Undo로 복원한 영역은 목록에서 다시 선택할 수 있다. 색상/좌표 변경은 불투명 HEX 및 페이지 bounds를 검사한다. 단순 focus/blur가 소수 좌표를 반올림하지 않게 입력에 저장 정밀도를 유지한다.

원본 preview의 색상 처리 후 불투명 Rectangle을 표시하며 thumbnail도 색상 처리 후 원본→thumbnail 비율로 mask를 그린다. 색상 반전/흑백/밝기 등은 mask fill에 적용되지 않는다. 이미지 전체 편집 복원은 기존 masks를 보존하고 영역 초기화는 별도 이력 작업이다. UI는 마스킹 속성/미리보기 경고를 문서 정보보다 먼저 보여준다.

이것은 Phase 4 편집 preview다. 실제 새 픽셀 생성, 출력 DPI 변환, 바깥 방향 경계 확장, PDF 원본 객체/텍스트/주석 미복사 및 출력 재디코딩 검증은 Phase 5에서 구현해야 한다. 현재 원본 File과 decode 리소스를 유지하므로 영구 제거 또는 안전한 결과물로 표현하지 않는다.

검증: 단위 129개, Windows Chromium/Edge 각각 E2E 20개. 마스킹 E2E는 DPR 2에서 원본 좌표와 실제 픽셀을 검사한다. affine/경계/교차/히스토리, 색상/숨김/삭제/취소, PDF 초기 회전과 TIFF, 모바일 390px를 포함한다. screenshot은 CAPTURE_PHASE4=1의 기존 PDF/TIFF 테스트에서 재현한다. 원격 Phase 4 CI와 실제 터치/Safari/Firefox/대용량 메모리는 아직 미검증이다.
