# DocumentMask Studio

React + TypeScript 기반 브라우저 문서 편집 및 영구 마스킹 프로젝트입니다. 원본 파일을 서버에 업로드하지 않는 구조를 목표로 합니다.

현재 **Phase 1 기반 구성**만 구현했습니다. 한국어 작업 공간과 라이트/다크 테마 전환을 사용할 수 있습니다. 파일 업로드, PDF/TIFF 처리, 편집, 영구 마스킹, 다운로드는 아직 제공하지 않습니다.

## 실행

Node.js 24와 npm을 권장합니다.

```sh
npm ci
npm run dev
```

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run preview
```

## 구조

`src/app`: 애플리케이션과 디자인 토큰, `components`: UI, `stores`: Zustand 상태, `features`: 사용자 작업, `core`: 문서/좌표/마스킹/출력 로직, `adapters`: 형식별 처리, `workers`: 비동기 처리, `tests`: 자동화 검증. 이후 단계용 디렉터리는 의도적으로 구현이 없는 경계입니다.

공통 페이지 모델로 포맷별 어댑터를 연결하고, 원본 페이지 좌표에서 편집 상태를 보존합니다. 출력은 처리된 새 픽셀만 인코딩하도록 설계합니다. PDF 출력은 이미지 기반 재생성이므로 검색/복사/링크/벡터 정보가 유지되지 않을 예정입니다. 아직 마스킹 보안 검증 결과는 없습니다.

전체 요구사항은 [PROJECT.md](PROJECT.md), 작업 상태는 [docs/PROGRESS.md](docs/PROGRESS.md), 아키텍처와 제약은 [docs/DECISIONS.md](docs/DECISIONS.md)를 확인하세요.

## GitHub Pages

`.github/workflows/pages.yml`에서 PR 검증과 main 배포를 구성했습니다. 저장소를 GitHub에 연결한 뒤 Settings → Pages → Source를 GitHub Actions로 설정해야 합니다. 실제 배포 주소는 아직 없습니다.

Vite는 로컬에서 `/`, CI에서는 저장소 이름으로 계산한 base를 사용합니다. 직접 서브경로 빌드 시 PowerShell에서 다음과 같이 실행합니다.

```powershell
$env:VITE_BASE_PATH = '/MaskingViewer/'
npm run build
Remove-Item Env:VITE_BASE_PATH
```

Phase 2에서 실제 문서 및 worker 리소스의 배포 경로를 검증할 예정입니다.
