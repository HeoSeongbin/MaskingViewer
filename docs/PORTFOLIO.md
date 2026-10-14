# DocumentMask Studio — 구현 사례

이미지/PDF/TIFF를 열고 원하는 영역을 제거한 새 파일로 다운로드하는 React + TypeScript 도구다. 브라우저 로컬 처리와 페이지별 편집 상태, 변환 후에도 정확한 원본 좌표, 이미지 기반 PDF 재생성이 핵심이다. 공개 사이트 검증 상태는 PROGRESS.md를 기준으로 한다.

## 1. 포맷별 코드 중복을 줄이는 문서 Adapter

PDF는 pt 단위와 초기 회전, TIFF는 orientation/IFD/압축, 일반 이미지는 브라우저 decode를 갖는다. 이 차이를 Adapter 안에서 정규화하고 PageRenderer가 metadata/render/dispose 계약으로 처리한다. UI·페이지 선택·편집·출력은 같은 페이지 모델을 쓴다. 모든 페이지를 최고 해상도로 동시에 decode하지 않는다.

## 2. 화면 좌표와 원본 마스킹 좌표

400% 확대, 회전, 화면 기준 반전, pan이 결합돼도 mask 좌표를 수정하지 않는다. 하나의 affine 변환과 역행렬을 입력·미리보기·썸네일에서 사용하고 PDF 출력에서는 DPI 비율만 별도 적용한다. HiDPI는 backing buffer의 문제로 분리한다. 64개 geometry 조합 왕복, 16개 실제 출력 회전/반전 조합, 복합 gesture 및 PDF 초기 회전 E2E로 검증한다.

## 3. 안전한 결과물과 편집 미리보기의 분리

Canvas 위 검은 Rectangle은 편집 상태일 뿐이다. 출력은 새 픽셀 버퍼에 불투명 단색으로 덮고 보간 없는 회전/반전을 적용한다. 원본 PDF에 주석을 추가하지 않고 처리된 이미지만 새 PDF에 삽입한다. 저장 결과를 다시 decode하고 텍스트/주석/첨부/숨김 구조와 추출 이미지 RGB를 검사한다. 원본 파일은 유지하며 결과 PDF의 검색/복사/링크/벡터 기능은 사라진다. JPEG 손실 색상 오차, 흰색 배경, 1픽셀 여백, TIFF 무압축 범위를 사용자에게 표시한다.

## 4. 비용이 큰 작업의 분리와 취소

TIFF decode, 색상, 출력 합성/최종 조립은 Worker에 나눈다. transferable buffer로 복사를 줄이고 출력 Canvas를 즉시 해제한다. 출력 Worker의 초기 582KB 인코더 묶음을 4.31KB 픽셀 Worker와 지연 인코더로 분리했다. PDF raw RGBA 누적을 PNG+RGB SHA-256으로 대체해 검증 기준을 유지하면서 보관량을 줄였다. 모든 Worker 성공/오류/취소/timeout에 cleanup 경로가 있다.

실제 120페이지 PDF/TIFF 전체 다운로드를 다시 열어 페이지 수를 검사하고 400만 픽셀 PNG의 픽셀·응답성, 반복 파일 닫기 후 JS heap을 측정했다. 이 결과는 Windows 표본이고 native/GPU/전체 Worker heap 또는 모든 파일 성능을 보장하지 않는다.

## 5. 테스트로 발견한 문제

| 문제                       | 확인한 원인                                                    | 해결과 검증                                                           |
| -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| Linux CI의 npm ci 실패     | Windows 설치만 확인한 불완전한 lock의 optional dependency 누락 | 별도 깨끗한 lock 생성, 실제 npm ci와 Linux dry-run, 원격 CI 성공 확인 |
| flip 직후 Canvas 픽셀 오류 | DOM 준비 상태와 requestAnimationFrame paint 시점 불일치        | 기대값을 완화하지 않고 expect.poll로 실제 정확한 픽셀 대기            |
| PDF 출력 보안 검사 실패    | 새 PDF 라이브러리가 빈 Annots 배열을 자동 생성                 | 빈 배열도 저장 전에 제거, 실제 원본 주석/첨부 대비 출력 부재 검사     |
| TIFF Deflate Worker 오류   | UTIF browser build가 self.pako에 의존                          | pako 명시 제공, 실제 페이지 픽셀/코덱 fixture 검사                    |
| light UI 텍스트 대비 부족  | accent/tint·muted/background 대비가 AA에 미달                  | semantic token 수정, axe 규칙 제외 없이 편집/light/dark/mobile 위반 0 |

## 재현과 결과

`npm ci`, typecheck/lint/format/test, `/MaskingViewer/` production build와 E2E 순서로 재현한다. release.spec.ts는 배포 사이트에서도 이미지/PDF/TIFF 업로드·복합 편집·마스킹 다운로드·재개방을 실행한다. `build-info.json`의 정확한 SHA와 실제 파일 픽셀·페이지 구조를 함께 확인한다. 로컬 검증/원격 CI/실제 Pages 검증은 구분한다.

상세 설계는 ARCHITECTURE.md, 변경 이유는 DECISIONS.md, 테스트 숫자·배포 증거는 PROGRESS.md, 측정 원본은 performance/ JSON에 있다. 캡처는 생성 fixture로 실제 동작한 화면이며 개인정보가 포함된 문서를 사용하지 않는다.

## 남은 범위

GIF 다중 프레임/암호 PDF 입력, BigTIFF/tile/16bit 등의 추가 입력, Firefox/Safari·실제 터치·스크린리더, native 전체 메모리와 다양한 대용량 코퍼스, 디스크 스트리밍은 미지원 또는 미검증이다. SVG/HEIC/AVIF/ICO와 TIFF 출력 압축도 제공하지 않는다. 지원하지 않는 기능을 완료된 것으로 표시하지 않는다.
