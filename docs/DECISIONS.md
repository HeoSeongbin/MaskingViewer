# 기술 결정 및 전체 아키텍처

기준: PROJECT.md 전체 및 AGENTS.md. 작성일: 2026-10-13.
이번 구현 범위는 Phase 1이다. 아래 문서 처리 설계는 이후 단계의 계약이며, 구현 완료를 의미하지 않는다.

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

Actions는 PR에서 install/typecheck/lint/format/test/build를 수행하고 main의 성공한 빌드만 Pages에 배포한다. GitHub 저장소 remote 및 Pages 설정은 아직 없으므로 실제 배포는 미검증이다. URL 라우터는 Phase 1에서 필요하지 않다.

## 008. 테스트 확장

Phase 1: jsdom + Testing Library로 landmark, 미구현 안내 및 실제 테마 전환을 검증한다. Phase 2: 형식별 정상/손상/암호/다중 페이지 fixture 및 취소/자원 해제 테스트. Phase 3–4: affine 조합/경계/히스토리 테스트. Phase 5: 출력 재디코딩 및 PDF 구조 보안 검사. Phase 6: Playwright 사용자 흐름, 메모리, 접근성, worker fallback 및 대용량 fixture 테스트. 배포 서브경로 리소스 검사는 포맷 기능 도입 시 반드시 추가한다.
