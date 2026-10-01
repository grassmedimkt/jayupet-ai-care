import { findConcern } from '@/lib/care-concerns';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 3 * 1024 * 1024;
const MODEL = '@cf/google/gemma-4-26b-a4b-it';

type AnalysisType = 'charm' | 'care';
type RetryReason = 'no_pet' | 'blurry' | 'dark' | 'overexposed' | 'too_far' | 'target_hidden' | 'unsupported_angle' | 'wrong_pet_type';

function mockResult(type: AnalysisType, concern: string) {
  if (type === 'charm') return { petDetected: true, petType: 'dog', imageQuality: 'good', compliment: '동그란 눈과 복슬복슬한 털이 한눈에 들어오는 아이예요.', visibleTraits: [{ category: 'face', trait: '동그랗고 짙은 색의 눈' }, { category: 'coat', trait: '길고 복슬복슬한 털' }, { category: 'body', trait: '카메라를 향해 앉아 있는 자세' }], mode: 'mock' };
  const labels: Record<string, string> = { breath: '입안과 치아가 보이는 사진', dental: '치아와 어금니가 보이는 사진', tangle: '털의 결이 보이는 사진', face: '눈가와 얼굴 털이 보이는 사진', chin: '턱 아래가 보이는 사진' };
  return { petDetected: true, petType: concern === 'chin' ? 'cat' : 'unknown', imageQuality: 'good', targetVisible: true, careStatus: concern === 'breath' ? 'self_reported' : 'clear', visibleObservations: [labels[concern] || '선택한 부위 사진', '뚜렷한 주의 신호는 확인되지 않음'], safetyFlags: [], rawSummary: '선택한 부위가 잘 보여 일상 관리 안내를 준비했어요.', mode: 'mock' };
}

function promptFor(type: AnalysisType, concern: string) {
  const retryReasons = 'no_pet|blurry|dark|overexposed|too_far|target_hidden|unsupported_angle|wrong_pet_type';
  if (type === 'charm') return `역할: 보호자가 자신의 반려동물 사진을 보며 공감할 수 있도록, 사진에 직접 보이는 외형적 매력을 구체적이고 다정한 한국어로 설명한다.

반드시 다음 JSON만 반환한다: {"petDetected":boolean,"petType":"dog"|"cat"|"unknown","imageQuality":"good"|"retry","retryReason":"${retryReasons}"|null,"compliment":string,"visibleTraits":[{"category":"face"|"coat"|"body"|"distinctive","trait":string}]}.

관찰 후보 영역:
- face: 눈의 모양·색·크기·시선 방향, 코와 주둥이 모양, 입과 혀가 보이는 모습, 귀의 모양·방향, 얼굴 무늬, 고개 각도
- coat: 털 길이, 직모·곱슬·복슬복슬함 등 형태와 질감, 털색 조합, 점·줄무늬·그라데이션
- body: 서기·앉기·눕기 자세, 앞발·뒷발 위치, 꼬리 모양·방향, 몸의 방향과 실루엣
- distinctive: 목걸이·리본·옷·장난감, 혀를 내민 모습, 한쪽 귀만 접힌 모습, 좌우가 다른 무늬처럼 사진에서 뚜렷한 개성 포인트

작성 규칙:
1. visibleTraits는 사진에서 선명하게 확인되는 서로 다른 특징만 1~3개 선택한다. 세 가지를 확신할 수 없다면 억지로 채우지 않는다.
2. 가능하면 서로 다른 category를 선택하되, 얼굴만 보이는 사진처럼 다른 영역이 보이지 않으면 같은 category를 반복해도 된다.
3. 보이지 않는 부위를 채우거나 추측하지 않는다.
4. trait는 하나의 구체적인 시각적 사실을 8~24자의 자연스러운 명사구로 작성한다.
5. compliment는 visibleTraits 중 최소 2개를 자연스럽게 조합한 한 문장으로 작성한다. 단순히 '예쁘다', '귀엽다', '멋지다'라고만 쓰지 않는다.
6. 성격, 감정, 건강, 질병, 나이, 성별, 품종은 추측하지 않는다. '친근한', '행복한', '착한', '용감한', '얌전한', '호기심 어린', '건강한', '윤기 있는'처럼 내면이나 건강을 판단하는 표현을 쓰지 않는다.
7. 같은 특징을 다른 말로 반복하지 않는다. 배경은 반려동물 자체의 매력이 부족할 때에도 특징으로 사용하지 않는다.
8. 사진이 부적합하면 imageQuality="retry"로 하고 retryReason을 정확히 하나 선택한다. 이때 보이지 않는 특징을 만들어내지 않는다.
9. 응답을 작성하기 전에 사진을 새로 관찰한다. 이전 응답이나 프롬프트 속 표현을 정답처럼 복사하지 않는다.
10. 각 trait는 사진 속 어느 부위에서 확인했는지 스스로 검증하고, 해당 부위가 프레임에 실제로 보일 때만 작성한다. 꼬리가 보이지 않으면 꼬리를, 귀가 보이지 않으면 귀를 절대 언급하지 않는다.
11. 금지 표현: "친근한", "행복한", "착한", "멋진", "용감한", "얌전한", "호기심 어린", "건강한", "사랑스러운 성격", "윤기 있는".

사진 통과 기준:
- 강아지나 고양이가 보이고, 얼굴·머리 또는 몸의 의미 있는 일부에서 시각적 특징을 최소 1개 확인할 수 있으면 imageQuality="good"으로 통과시킨다.
- 얼굴 정면이 아니거나, 얼굴·상반신·전신 중 한 가지만 보이거나, 몸 일부가 잘렸거나, 배경이 복잡하거나, 일반적인 실내 조명이라는 이유만으로 재촬영을 요구하지 않는다.
- 다음 경우에만 imageQuality="retry"로 한다: 반려동물이 없음(no_pet), 흔들림 때문에 특징을 하나도 확인할 수 없음(blurry), 너무 어둡거나 밝아서 특징을 확인할 수 없음(dark/overexposed), 반려동물이 너무 작아 어떤 특징도 구분할 수 없음(too_far).
- 첫 매력 분석에는 target_hidden, unsupported_angle, wrong_pet_type을 사용하지 않는다.`;
  const config = findConcern(concern);
  if (!config) throw new Error('지원하지 않는 걱정 항목이에요.');
  const concernRules: Record<string, string> = {
    breath: `
입 냄새 전용 관찰 규칙:
- 사진만으로 냄새의 유무나 강도를 판단할 수 없다. 사용자가 선택한 "입 냄새" 걱정은 자기 보고로만 취급한다.
- 통과 기준: 입술을 든 상태에서 치아, 잇몸 또는 입안 중 한 곳이 선명하게 보여 구강 관리 사진으로 사용할 수 있으면 통과한다.
- 입이 닫혔거나 입술·혀·손에 구강 부위가 대부분 가려지면 target_hidden, 구강 부위가 너무 작으면 too_far, 표면을 구분할 수 없을 정도로 흐리면 blurry로 재촬영을 요청한다.
- 얼굴이 크게 보이더라도 입이 닫혀 구강 부위가 안 보이면 too_far가 아니라 반드시 target_hidden을 사용한다. too_far는 반려동물 또는 입 부위 자체가 프레임에서 작게 찍힌 경우에만 사용한다.
- visibleObservations에는 "구강 부위가 보이는 사진이에요"와 함께 치아·잇몸·입안에서 실제로 보이는 중립적 사실만 최대 3개 적는다.
- 냄새가 난다/나지 않는다, 냄새의 원인, 구취 단계, 소화 상태를 추측하지 않는다.
- 활동성 출혈, 뚜렷한 심한 부기, 열린 상처 또는 깨진 치아가 명확할 때만 caution과 safetyFlags를 사용한다.
- "구취", "치주염", "염증", "감염"을 진단하지 않는다. rawSummary에는 사진으로 냄새를 확인할 수 없으며 보이는 구강 특징만 살폈다는 뜻을 자연스럽게 담는다.`,
    dental: `

치아·어금니 전용 관찰 규칙:
- 통과 기준: 치아 표면 또는 어금니 중 한 곳과 그 주변이 초점에 맞아, 표면의 색이나 부착물 여부를 최소 1개 관찰할 수 있으면 통과한다. 입 전체나 모든 어금니가 보일 필요는 없다.
- 치아가 전혀 보이지 않거나 혀·입술·손에 대부분 가려지면 target_hidden, 치아가 너무 작으면 too_far, 표면을 구분할 수 없을 정도로 흐리면 blurry로 재촬영을 요청한다.
- 관찰 후보는 다음으로 제한한다: 치아 표면의 흰색·크림색·노란색·갈색 계열, 주변과 구분되는 노란색 또는 갈색 부착물, 부분적인 표면 얼룩, 치아 사이의 작은 이물질, 사진에 명확히 보이는 잇몸 주변 변화.
- visibleObservations는 사진에서 확인한 위치와 모습을 함께 적는다. 예: "뒤쪽 치아 표면에 노란빛 부착물이 보여요", "치아 사이에 작은 이물질이 보여요".
- 자연스러운 크림색 치아, 분홍색 잇몸, 빛과 그림자만으로 observed나 caution을 판정하지 않는다.
- 뚜렷한 부착물·얼룩·이물질과 안전 신호가 보이지 않으면 careStatus="clear"로 한다.
- 노란색·갈색 부착물, 국소적인 표면 얼룩 또는 치아 사이 이물질이 직접 보이면 careStatus="observed"로 한다.
- 사진에서 활동성 출혈, 뚜렷한 심한 부기, 열린 상처 또는 깨진 치아가 명확히 보일 때만 careStatus="caution"으로 하고 해당 사실을 safetyFlags에 넣는다.
- 치아가 노랗거나 잇몸이 붉어 보인다는 이유만으로 caution을 사용하지 않는다. 애매하면 진단하지 않고 보이는 색과 위치만 중립적으로 쓴다.
- "치석", "충치", "치주염", "염증", "감염", "잇몸병"을 확정하지 않는다. 대신 "부착물", "표면 얼룩", "이물질", "붉게 보이는 부분"처럼 시각적 사실로 표현한다.
- 치아나 잇몸이 건강하다고 보장하거나 통증·입 냄새·양치 거부를 사진만으로 추측하지 않는다.
- rawSummary는 가장 중요한 관찰 한 가지를 한 문장으로 요약하며 진단명, 중증도, 치료 또는 제품 효과를 포함하지 않는다.`,
    tangle: `
털 엉킴 전용 관찰 규칙:
- 통과 기준: 털의 결이 충분히 가까이 보이고, 엉킴·뭉침·갈라짐 또는 빗에 걸린 털 중 하나를 구분할 수 있으면 통과한다.
- 털이 거의 보이지 않거나 옷·손에 가려지면 target_hidden, 털 결이 너무 작으면 too_far, 결을 구분할 수 없을 정도로 흐리면 blurry로 재촬영을 요청한다.
- 관찰 후보는 서로 붙어 덩어리진 털, 매듭처럼 꼬인 부분, 빗살 사이에 걸린 털, 주변과 다르게 눌리거나 갈라진 털, 털에 붙은 작은 이물질로 제한한다.
- 단순한 곱슬털, 긴 털, 젖은 털, 빛에 따른 명암만으로 엉켰다고 판정하지 않는다.
- 뚜렷한 뭉침이나 매듭이 없으면 clear, 직접 보이면 observed로 한다.
- 붉게 드러난 피부, 활동성 출혈, 열린 상처 또는 피부를 심하게 당기는 단단한 털 뭉침이 명확할 때만 caution으로 한다.
- "피부염", "탈모", "감염", "통증"을 진단하거나 추측하지 않는다. visibleObservations에는 위치와 털의 모양을 함께 적는다.`,
    face: `
눈곱·작은 이물질 전용 관찰 규칙:
- 통과 기준: 최소 한쪽 눈과 그 주변 얼굴 털이 선명하게 보여, 붙어 있는 이물질이나 오염 여부를 관찰할 수 있으면 통과한다.
- 눈가가 털·손·사진 잘림에 가려지면 target_hidden, 얼굴이 너무 작으면 too_far, 눈가 털을 구분할 수 없으면 blurry로 재촬영을 요청한다.
- 관찰 후보는 눈가 털에 붙은 작은 마른 이물질, 털의 국소적인 착색·오염, 눈 주변에 붙은 털 뭉침으로 제한한다.
- 털색·무늬·그림자를 이물질로 오인하지 말고, 단순히 눈이 촉촉하거나 눈물이 비친다는 이유만으로 observed로 판정하지 않는다.
- 뚜렷한 이물질이나 오염이 없으면 clear, 직접 보이면 observed로 한다.
- clear일 때도 "깨끗하다", "정상이다", "문제가 없다"고 보장하지 말고 "사진에서 뚜렷한 이물질은 보이지 않아요"처럼 관찰 범위만 표현한다.
- 활동성 출혈, 열린 상처, 뚜렷한 심한 부기, 많은 분비물 또는 눈을 제대로 뜨지 못하는 모습이 명확할 때만 caution으로 한다.
- "결막염", "눈병", "감염", "유루증"을 진단하지 않는다. visibleObservations에는 왼쪽/오른쪽 또는 양쪽 눈가와 보이는 사실을 함께 적는다.`,
    chin: `
고양이 턱 노폐물 전용 관찰 규칙:
- 사진 속 동물이 명확히 강아지이면 wrong_pet_type으로 재촬영을 요청한다. 고양이인지 불확실하면 보이는 범위만 판단하고 품종은 추측하지 않는다.
- 통과 기준: 고양이의 턱 아래 피부 또는 털 뿌리 부분이 선명하게 보여 검은 점·부착물·털 뭉침 여부를 관찰할 수 있으면 통과한다.
- 턱 아래가 보이지 않거나 손·목·가슴 털에 가려지면 target_hidden, 턱이 너무 작으면 too_far, 피부와 털 뿌리를 구분할 수 없으면 blurry로 재촬영을 요청한다.
- 관찰 후보는 턱 아래 털 사이의 검은 점, 표면 부착물, 국소적인 털 뭉침, 주변과 구분되는 오염으로 제한한다.
- 자연스러운 털색·수염 뿌리·피부색·그림자를 검은 점이나 노폐물로 오인하지 않는다.
- 뚜렷한 검은 점이나 부착물이 없으면 clear, 직접 보이면 observed로 한다.
- 활동성 출혈, 열린 상처, 뚜렷한 심한 부기 또는 넓게 젖은 분비물이 명확할 때만 caution으로 한다.
- "턱드름", "여드름", "피부염", "감염"을 진단하지 않는다. 대신 "검은 점", "표면 부착물", "털 뭉침"처럼 보이는 사실만 적는다.`,
  };
  return `역할: 반려동물 케어용 사진의 사용 가능 여부와 직접 보이는 특징만 확인한다. 사용자가 선택한 걱정은 "${config.label}"이고 확인해야 할 부위는 "${config.target}"이다. 관찰 제한: ${config.aiNote}

반드시 JSON만 반환한다: {"petDetected":boolean,"petType":"dog"|"cat"|"unknown","imageQuality":"good"|"retry","retryReason":"${retryReasons}"|null,"targetVisible":boolean,"careStatus":"clear"|"observed"|"caution","visibleObservations":string[],"safetyFlags":string[],"rawSummary":string}.

판정 기준:
1. 선택한 부위가 사진에서 실제로 보이고, 중립적인 관찰을 최소 1개 할 수 있을 만큼 선명하면 구도나 크기가 완벽하지 않아도 imageQuality="good", targetVisible=true로 통과시킨다.
2. 손·털·사진 잘림에 가려 부위를 확인할 수 없으면 target_hidden, 필요한 면이 보이지 않는 각도이면 unsupported_angle, 너무 작으면 too_far를 사용한다.
3. 흐림·어두움·과도한 밝기는 선택 부위를 관찰하지 못할 정도일 때만 각각 blurry, dark, overexposed로 판정한다.
4. 선택 항목이 "입 냄새"라면 냄새 자체를 사진으로 판단하지 않는다. 입·치아·잇몸 주변 중 하나가 보이면 targetVisible=true로 하고, visibleObservations에는 사진에 직접 보이는 사실만 쓴다.
5. 선택 항목이 "고양이 턱 노폐물"인데 사진 속 동물이 명확히 강아지라면 imageQuality="retry", targetVisible=false, retryReason="wrong_pet_type"으로 한다.
6. careStatus는 선택 부위가 보이지만 관련 특징이 뚜렷하지 않으면 clear, 관련된 관리 특징이 직접 보이면 observed, 안전 신호가 명확히 보이면 caution으로 정한다.
7. visibleObservations는 관리에 의미 있는 중립적인 특징만 최대 3개로 작성하고, 같은 뜻이나 단순 형태 설명은 반복하지 않는다.
8. safetyFlags에는 출혈, 뚜렷한 상처, 심한 붓기, 많은 분비물, 눈을 뜨기 어려워 보이는 모습처럼 실제 사진에서 명확히 보이는 항목만 넣고, 없으면 빈 배열로 반환한다.
9. 모든 문장은 자연스러운 한국어로 작성한다. 질병명, 진단, 중증도, 치료법, 제품 추천은 작성하지 않는다.${concernRules[concern] || ''}`;
}

function extractJson(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced || text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(candidate);
}

function isValidResult(value: unknown, type: AnalysisType) {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  if (typeof data.petDetected !== 'boolean' || !['dog', 'cat', 'unknown'].includes(String(data.petType)) || !['good', 'retry'].includes(String(data.imageQuality))) return false;
  const retryReasons: RetryReason[] = ['no_pet', 'blurry', 'dark', 'overexposed', 'too_far', 'target_hidden', 'unsupported_angle', 'wrong_pet_type'];
  if (data.imageQuality === 'retry' && !retryReasons.includes(data.retryReason as RetryReason)) return false;
  if (type === 'charm') {
    if (typeof data.compliment !== 'string' || !Array.isArray(data.visibleTraits) || data.visibleTraits.length < 1 || data.visibleTraits.length > 3) return false;
    return data.visibleTraits.every((item) => item && typeof item === 'object' && ['face', 'coat', 'body', 'distinctive'].includes(String((item as Record<string, unknown>).category)) && typeof (item as Record<string, unknown>).trait === 'string');
  }
  return typeof data.targetVisible === 'boolean' && ['clear', 'observed', 'caution'].includes(String(data.careStatus)) && Array.isArray(data.visibleObservations) && Array.isArray(data.safetyFlags) && typeof data.rawSummary === 'string';
}

async function runWorkersAI(image: string, prompt: string, accountId: string, token: string) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
  let lastError = 'AI 분석 요청에 실패했어요.';
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: 'You are a careful visual observer. Analyze only details that are clearly visible in the supplied image. Return only valid JSON that follows the user instructions.' },
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: image } },
              ],
            },
          ],
          max_completion_tokens: 1_200,
          reasoning_effort: 'low',
          chat_template_kwargs: { thinking: false },
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });
      if (response.ok) {
        const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
        const result = payload.choices?.[0]?.message?.content;
        return extractJson(result);
      }
      const providerError = (await response.text()).slice(0, 1_000);
      console.error('Workers AI request failed', { status: response.status, body: providerError });
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      lastError = response.status === 429 ? 'AI 요청이 몰리고 있어요. 잠시 후 다시 시도해주세요.' : `AI가 응답하지 않았어요. (${response.status})`;
      if (!retryable || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Workers AI connection failed', error instanceof Error ? error.name : 'UnknownError');
      lastError = error instanceof Error && error.name === 'AbortError' ? 'AI 분석 시간이 초과됐어요.' : 'AI 연결 중 문제가 발생했어요.';
      if (attempt === 1) break;
    } finally { clearTimeout(timeout); }
  }
  throw new Error(lastError);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const photo = form.get('photo');
    const analysisType = form.get('analysisType');
    const concern = String(form.get('concern') || '');
    if (!(photo instanceof File) || (analysisType !== 'charm' && analysisType !== 'care')) return Response.json({ error: '올바른 분석 요청이 아니에요.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(photo.type)) return Response.json({ error: '지원하지 않는 사진 형식이에요.' }, { status: 415 });
    if (photo.size < 1 || photo.size > MAX_BYTES) return Response.json({ error: '처리할 사진은 3MB 이하여야 해요.' }, { status: 413 });

    const type = analysisType as AnalysisType;
    if (type === 'care' && !findConcern(concern)) return Response.json({ error: '지원하지 않는 걱정 항목이에요.' }, { status: 400 });
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_AI_API_TOKEN;
    if ((process.env.AI_MODE || 'mock') !== 'live' || !accountId || !token) return Response.json(mockResult(type, concern));

    const bytes = new Uint8Array(await photo.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    const image = `data:${photo.type};base64,${btoa(binary)}`;
    const result = await runWorkersAI(image, promptFor(type, concern), accountId, token);
    if (!isValidResult(result, type)) return Response.json({ error: 'AI 응답 형식을 확인하지 못했어요. 다시 시도해주세요.' }, { status: 502 });
    const normalized = result as Record<string, unknown>;
    if (type === 'care') {
      const flags = Array.isArray(normalized.safetyFlags) ? normalized.safetyFlags : [];
      normalized.careStatus = flags.length > 0 ? 'caution' : concern === 'breath' ? 'self_reported' : normalized.careStatus;
    }
    return Response.json({ ...normalized, mode: 'live' });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : '분석 중 문제가 발생했어요.' }, { status: 502 });
  }
}
