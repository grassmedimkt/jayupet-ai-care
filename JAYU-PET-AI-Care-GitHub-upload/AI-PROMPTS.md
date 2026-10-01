# AI prompt handoff

## 운영 설정

- 모델: `@cf/google/gemma-4-26b-a4b-it`
- API: Cloudflare Workers AI OpenAI-compatible chat completions
- system prompt: `You are a careful visual observer. Analyze only details that are clearly visible in the supplied image. Return only valid JSON that follows the user instructions.`
- `temperature: 0.1`
- `max_completion_tokens: 1200`
- `reasoning_effort: low`
- JSON object 응답 강제
- 60초 제한, 408·429·5xx에 한해 1회 자동 재시도

실제 실행되는 프롬프트의 단일 기준 소스는 각 언어판의 `app/api/analyze-image/route.ts` 안 `promptFor()`입니다. 고민별 제품/관찰 제한 문구는 `lib/care-concerns.ts`의 `target`, `aiNote`와 함께 조합됩니다. 프롬프트를 바꾸면 이 문서와 두 언어판 코드를 함께 갱신해야 합니다.

## 공통 출력 스키마

### 매력 분석

```json
{"petDetected":true,"petType":"dog|cat|unknown","imageQuality":"good|retry","retryReason":"no_pet|blurry|dark|overexposed|too_far|target_hidden|unsupported_angle|wrong_pet_type|null","compliment":"string","visibleTraits":[{"category":"face|coat|body|distinctive","trait":"string"}]}
```

### 케어 분석

```json
{"petDetected":true,"petType":"dog|cat|unknown","imageQuality":"good|retry","retryReason":"...|null","targetVisible":true,"careStatus":"clear|observed|caution","visibleObservations":["string"],"safetyFlags":["string"],"rawSummary":"string"}
```

## 한국어 매력 프롬프트 규칙

- 사진에 직접 보이는 외형적 매력을 구체적이고 다정한 한국어로 설명합니다.
- 관찰 범위: 얼굴(눈·코·입·귀·무늬·각도), 털(길이·질감·색·무늬), 몸(자세·발·꼬리·실루엣), 개성 요소(옷·목걸이·장난감·혀·비대칭 무늬).
- 선명하게 확인되는 서로 다른 특징만 1~3개 선택하며 억지로 세 개를 채우지 않습니다.
- 칭찬 문장은 관찰 특징 최소 두 개를 자연스럽게 결합합니다.
- 성격, 감정, 건강, 질병, 나이, 성별, 품종은 추측하지 않습니다.
- 반려동물이 없거나 어떤 특징도 식별할 수 없을 정도의 흐림·노출 문제·거리 문제일 때만 재촬영을 요청합니다.

## English charm prompt

`Describe the pet's visible charm in warm, specific, natural English.` 사진에 명확히 보이는 눈·코·입·귀·무늬·털·자세·발·꼬리·액세서리 중 1~3개를 선택합니다. 칭찬은 관찰 특징 두 개 이상을 자연스럽게 결합합니다. 성격, 감정, 건강, 질병, 나이, 성별, 품종 및 배경은 추측하거나 특징으로 사용하지 않습니다. 반려동물이 없거나 어떤 특징도 식별할 수 없는 경우에만 재촬영을 요청합니다.

## 케어 공통 판정 프롬프트

- 선택한 부위가 보이고 중립적 관찰을 하나 이상 할 수 있으면 `good`/`targetVisible=true`.
- 가림은 `target_hidden`, 필요한 면이 아닌 각도는 `unsupported_angle`, 너무 작으면 `too_far`.
- 흐림·어두움·과노출은 관찰이 불가능할 때만 사용합니다.
- 관련 특징이 뚜렷하지 않으면 `clear`, 직접 보이면 `observed`, 안전 신호가 명확하면 `caution`.
- 관찰은 위치를 포함해 최대 3개, 반복 없이 작성합니다.
- 출혈, 열린 상처, 뚜렷한 심한 부기, 많은 분비물, 눈을 뜨기 어려운 모습, 명확히 깨진 치아만 안전 신호 후보입니다.
- 질병명, 진단, 중증도, 통증, 치료법, 제품 효과는 출력하지 않습니다.

## 고민별 추가 프롬프트

### 1. 입 냄새 / Bad breath

사진으로 냄새 유무·강도·원인을 판단하지 않습니다. 치아·잇몸·입안 중 하나가 보여야 통과합니다. 닫힌 입은 `target_hidden`입니다. 결과 요약에는 냄새는 사진으로 확인할 수 없고 보이는 구강 특징만 관찰했다는 의미를 포함합니다.

### 2. 치아·어금니 / Teeth & molars

치아 표면 또는 어금니가 선명해야 합니다. 색, 부착물, 얼룩, 작은 이물질만 관찰합니다. 자연스러운 크림색이나 그림자를 문제로 판정하지 않습니다. 치석·충치·치주염·감염 등을 진단하지 않고 `부착물`, `표면 얼룩`, `이물질`처럼 표현합니다.

### 3. 털 엉킴 / Tangled coat

서로 붙은 털, 매듭, 빗에 걸린 털, 눌리거나 갈라진 결, 작은 이물질만 관찰합니다. 자연스러운 곱슬털·긴 털·젖은 털·그림자를 엉킴으로 판정하지 않습니다. 피부염·탈모·감염·통증은 추측하지 않습니다.

### 4. 눈곱·작은 이물질 / Eye-area debris

한쪽 눈과 주변 털이 선명해야 합니다. 마른 이물질, 국소 착색·오염, 붙은 털 뭉침만 관찰합니다. 털색·무늬·그림자·단순한 눈물 반사를 이물질로 오인하지 않습니다. `정상`, `깨끗함`을 보장하거나 안과 질환을 진단하지 않습니다.

### 5. 고양이 턱 노폐물 / Cat chin buildup

명확한 강아지 사진은 `wrong_pet_type`입니다. 고양이 턱 아래 피부 또는 털 뿌리가 선명해야 합니다. 검은 점, 표면 부착물, 국소 털 뭉침만 관찰합니다. 털색·수염 뿌리·피부색·그림자를 노폐물로 오인하거나 턱드름·피부염·감염을 진단하지 않습니다.

## 후처리 규칙

- 반환 JSON이 스키마를 벗어나면 502 오류로 처리합니다.
- `safetyFlags`가 하나라도 있으면 서버가 `careStatus`를 `caution`으로 강제합니다.
- 입 냄새 선택은 서버가 `careStatus`를 `self_reported`로 정규화합니다.
- 제품 추천은 AI가 결정하지 않습니다. 사용자가 고른 고민과 `lib/care-concerns.ts`의 고정 매핑으로 결정됩니다.

