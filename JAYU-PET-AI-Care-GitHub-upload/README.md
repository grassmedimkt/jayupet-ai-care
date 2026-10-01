# JAYU PET AI Care — 최종 인수인계

이 저장소는 반려동물 사진을 분석해 외형적 매력을 설명하고, 사용자가 선택한 관리 고민에 맞는 관찰 결과와 JAYU PET 제품을 안내하는 모바일 웹 서비스의 최종 보관본입니다.

새 담당자는 **이 README를 먼저 읽고**, 수정할 언어 폴더로 이동해 작업합니다. 영문판과 한국어판은 각각 독립적으로 설치·실행·배포할 수 있습니다.

## 1. 현재 상태

| 구분 | 영문판 | 한국어판 |
| --- | --- | --- |
| 폴더 | `english/` | `korean/` |
| 기준 배포본 | https://jayu-pet-ai-care-en-demo.jayu-pet-ai.workers.dev/ | https://jayu-pet-ai-care-demo.jayu-pet-ai.workers.dev/ |
| 현재 AI 상태 | 화면 배포 완료, 새 Worker의 Secret 미등록으로 mock 응답 | 기준 배포본 |
| 이미지 | 공통 이미지 11개를 각 언어 폴더에 포함 | 공통 이미지 11개를 각 언어 폴더에 포함 |
| 오디오 | 없음 | 없음 |

- AI 모델: `@cf/google/gemma-4-26b-a4b-it`
- 런타임: Vinext + React + Cloudflare Workers
- 사진 저장소: 사용하지 않음. 사진은 요청 중 메모리에서 AI API로 전달되며 별도 DB나 스토리지에 저장하지 않습니다.
- Dropbox 공통 이미지 백업: https://www.dropbox.com/work/GTEP%20INU/AI%EC%A7%84%EB%8B%A8%EC%BD%98%ED%85%90%EC%B8%A0%20%EC%9D%B4%EB%AF%B8%EC%A7%80%20%EB%B0%B1%EC%97%85%EB%B3%B8_HERO

## 2. 저장소 구조

```text
.
├─ english/                      영문판 독립 프로젝트
│  ├─ app/                       화면·스타일·AI API
│  ├─ lib/                       고민 항목·제품 정보·상품 링크
│  ├─ asset/images/              실행에 필요한 이미지 11개
│  ├─ build/                     Vinext 빌드 지원 코드
│  ├─ scripts/                   설치·실행·빌드 보조 스크립트
│  ├─ vendor/                    프로젝트 빌드용 스타일
│  ├─ .openai/hosting.json       빌드 설정(D1·R2 미사용)
│  ├─ .env.example               환경변수 이름 예시, 실제 값 없음
│  ├─ package.json
│  └─ package-lock.json
├─ korean/                       한국어판 독립 프로젝트
│  └─ 영문판과 같은 실행 구조
├─ vendor/                       공통 보관 파일
├─ README.md                     이 문서
├─ AI-PROMPTS.md                 모델·프롬프트·판정 규칙
├─ ASSET-LIST.md                 이미지 파일과 사용 위치
└─ SHA256SUMS.txt                업로드 파일 무결성 체크섬
```

`english/asset/images/`와 `korean/asset/images/`에 같은 이미지가 각각 들어 있는 것은 의도된 구성입니다. 각 언어판이 GitHub 저장소만으로 독립 실행·배포되도록 유지합니다.

`.openai/hosting.json`에는 개인 로그인, Cloudflare Account ID, API Token 또는 Worker 연결 정보가 없습니다. 현재 `d1`과 `r2`가 모두 `null`이며 빌드에 필요하므로 삭제하지 않습니다.

## 3. 필요한 환경

- Node.js `22.13.0` 이상
- npm
- 회사 Cloudflare 계정 접근 권한
- 실시간 AI 분석을 사용할 경우 회사 계정의 Account ID와 Workers AI 호출 권한이 있는 API Token

실제 환경변수 파일과 Secret은 GitHub에 올리지 않습니다.

## 4. 처음 내려받은 뒤 실행

저장소 루트에서 원하는 언어 폴더로 이동합니다.

### 영문판

```powershell
cd .\english
npm ci
Copy-Item .env.example .env.local
npm run dev
```

### 한국어판

```powershell
cd .\korean
npm ci
Copy-Item .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:5173/`을 엽니다. 두 언어를 동시에 실행할 경우 두 번째 프로젝트는 다른 포트를 사용합니다.

```powershell
npm run dev -- --port 5174
```

외부 AI 호출 없이 화면과 흐름만 확인할 때는 `.env.local`을 다음처럼 둡니다.

```dotenv
AI_MODE=mock
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_AI_API_TOKEN=
```

실제 AI 응답을 로컬에서 확인할 때만 회사 계정의 값을 입력합니다.

```dotenv
AI_MODE=live
CLOUDFLARE_ACCOUNT_ID=회사_Cloudflare_Account_ID
CLOUDFLARE_AI_API_TOKEN=회사_계정에서_발급한_API_Token
```

`.env.local`은 `.gitignore`에 포함되어 있으며 커밋하지 않습니다.

## 5. 수정 위치

각 언어 폴더를 기준으로 수정합니다.

| 수정 내용 | 파일 또는 폴더 |
| --- | --- |
| 화면 문구·게임 흐름 | `app/page.tsx` |
| 공통 스타일·반응형 | `app/globals.css` |
| 페이지 제목·언어 코드·favicon | `app/layout.tsx` |
| AI 모델·프롬프트·판정·오류 응답 | `app/api/analyze-image/route.ts` |
| 고민 항목·제품명·상품 링크·제품 이미지 | `lib/care-concerns.ts` |
| 이미지 | `asset/images/` |
| AI 규칙 인수인계 | 저장소 루트 `AI-PROMPTS.md` |

코드의 이미지 경로는 `/asset/images/...` 형식의 로컬 상대 경로입니다. 파일명이나 폴더를 바꾸면 코드의 참조 경로도 함께 수정합니다.

## 6. 수정 후 검사

수정한 언어 폴더에서 다음 명령을 실행합니다.

```powershell
npm ci
npm run lint
npm run build
```

`npm run build`가 성공하면 `dist/server/wrangler.json`이 생성됩니다. 이 파일은 배포용 자동 생성물이며 GitHub에 커밋하지 않습니다.

현재 최종 보관본은 새 설치 상태에서 영문판과 한국어판 모두 `npm ci`와 `npm run build`를 통과했습니다. 린트 오류는 0개이며, `<img>` 최적화와 React Hook 의존성 관련 경고가 각각 남아 있습니다.

## 7. 회사 Cloudflare 계정으로 새 배포

기존 개인 계정의 Account ID와 API Token은 복사하지 않습니다. 회사 계정에서 새 값을 준비합니다. 아래 작업은 배포할 언어 폴더 안에서 각각 수행합니다.

### 7-1. 영문판

```powershell
cd .\english
npm ci
npm run build
npx wrangler login
npx wrangler deploy --config dist/server/wrangler.json --name jayu-pet-ai-care-en
```

첫 배포가 끝난 뒤 같은 Worker에 Secret 세 개를 등록합니다. 각 명령을 실행하면 값을 입력하라는 메시지가 나오며 입력값은 화면에 표시되지 않습니다.

```powershell
npx wrangler secret put AI_MODE --name jayu-pet-ai-care-en
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID --name jayu-pet-ai-care-en
npx wrangler secret put CLOUDFLARE_AI_API_TOKEN --name jayu-pet-ai-care-en
```

- `AI_MODE`: `live`
- `CLOUDFLARE_ACCOUNT_ID`: 회사 Cloudflare Account ID
- `CLOUDFLARE_AI_API_TOKEN`: 회사 계정에서 새로 발급한 Workers AI 호출용 Token

### 7-2. 한국어판

```powershell
cd .\korean
npm ci
npm run build
npx wrangler login
npx wrangler deploy --config dist/server/wrangler.json --name jayu-pet-ai-care-ko
npx wrangler secret put AI_MODE --name jayu-pet-ai-care-ko
npx wrangler secret put CLOUDFLARE_ACCOUNT_ID --name jayu-pet-ai-care-ko
npx wrangler secret put CLOUDFLARE_AI_API_TOKEN --name jayu-pet-ai-care-ko
```

Secret 등록 후 Worker를 다시 열어 실제 사진으로 분석하고, 응답 데이터의 `mode`가 `live`인지 확인합니다. `mode: "mock"`이면 세 Secret의 이름과 값, 대상 Worker 이름을 다시 확인합니다.

Worker 이름은 회사 규칙에 맞게 바꿔도 됩니다. 명령마다 `--name`에 동일한 이름을 사용해야 합니다.

## 8. 배포 후 필수 확인

- 모바일에서 카메라 촬영과 앨범 선택이 되는지 확인
- 데스크톱에서 파일 선택이 되는지 확인
- 영문판·한국어판 문구와 AI 응답 언어가 맞는지 확인
- 첫 사진의 매력 분석 결과가 `mode: "live"`로 반환되는지 확인
- 입 냄새·치아·털·눈가·고양이 턱을 각각 1회 이상 확인
- 부적절한 사진에서 재촬영 안내가 나오는지 확인
- 안전 신호가 있을 때 제품 안내 대신 전문가 확인 안내가 나오는지 확인
- 제품별 버튼이 대상 국가의 실제 상품 페이지로 이동하는지 확인
- 새 Production URL을 인수인계 노션에 기록
- Cloudflare 대시보드에서 오류율·응답 시간·Workers AI 사용량 확인

## 9. 국가별 추가 작업

### 한국어판

`korean/lib/care-concerns.ts`의 `productUrl` 5개를 최신 한국몰 상품 링크로 확인·교체합니다. 국내 판매 제품명이나 문구가 달라졌다면 같은 파일에서 함께 수정합니다.

### 일본어판

현재 일본어판은 없습니다. `korean/` 또는 `english/` 폴더를 `japanese/`로 복사한 뒤 다음을 수정합니다.

- `app/page.tsx`: 모든 사용자 문구
- `app/layout.tsx`: 제목·설명과 `<html lang="ja">`
- `lib/care-concerns.ts`: 고민명·촬영 안내·제품명·일본몰 상품 링크
- `app/api/analyze-image/route.ts`: 프롬프트·오류 문구·mock 응답을 일본어로 변경
- 루트 `AI-PROMPTS.md`: 일본어 프롬프트와 판정 규칙 추가

번역 후 실제 강아지·고양이 사진으로 AI 응답 언어, 줄바꿈, 버튼 배치와 모바일 반응형을 다시 확인합니다.

## 10. GitHub와 Dropbox 보관 기준

- **GitHub가 실행·수정·재배포의 기준본입니다.** 코드, 설정, 문서와 실행에 필요한 이미지가 모두 들어 있습니다.
- **Dropbox는 공통 이미지 11개의 별도 백업본입니다.** 실행 중 Dropbox URL을 불러오지 않습니다.
- GitHub의 `english/asset/images/`와 `korean/asset/images/`를 삭제하거나 Dropbox 공유 URL로 교체하지 않습니다.
- 오디오는 사용하지 않습니다.
- `.env`, `.env.local`, API Token, 개인 계정 정보는 GitHub·Dropbox 어디에도 올리지 않습니다.

## 11. 서비스 흐름

1. 반려동물 첫 사진 촬영 또는 선택
2. 브라우저에서 최대 1600px·약 2MB로 최적화
3. AI 매력 분석 및 특징 1~3개 표시
4. 걱정거리 5개 중 하나 선택
5. 선택 부위 촬영 안내 및 두 번째 사진 입력
6. AI가 사진 사용 가능 여부와 눈에 보이는 특징만 정리
7. 안전 신호가 없으면 고민별 제품 안내, 안전 신호가 있으면 전문가 확인 안내

## 12. 원본 보존과 최종 보관본

기존 작업 폴더와 공개 배포본은 수정하거나 삭제하지 않았습니다. 이 최종 보관본은 이미지 경로를 `asset/images/`로 정리하고 영문판 HTML 언어 코드를 `en`으로 맞춘 상태입니다.

파일이 변했는지 확인해야 할 경우 저장소 루트의 `SHA256SUMS.txt`와 비교합니다. 의도적으로 파일을 수정했다면 체크섬도 다시 생성해야 합니다.
