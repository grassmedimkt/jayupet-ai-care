import { findConcern } from '@/lib/care-concerns';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 3 * 1024 * 1024;
const MODEL = '@cf/google/gemma-4-26b-a4b-it';

type AnalysisType = 'charm' | 'care';
type RetryReason = 'no_pet' | 'blurry' | 'dark' | 'overexposed' | 'too_far' | 'target_hidden' | 'unsupported_angle' | 'wrong_pet_type';

function mockResult(type: AnalysisType, concern: string) {
  if (type === 'charm') return { petDetected: true, petType: 'dog', imageQuality: 'good', compliment: 'Round eyes and a fluffy coat make this pet instantly memorable.', visibleTraits: [{ category: 'face', trait: 'Round, dark eyes' }, { category: 'coat', trait: 'Long, fluffy coat' }, { category: 'body', trait: 'Sitting while facing the camera' }], mode: 'mock' };
  const labels: Record<string, string> = { breath: 'The mouth and teeth are visible', dental: 'The teeth and molars are visible', tangle: 'The coat texture is visible', face: 'The eye area and facial coat are visible', chin: 'The underside of the chin is visible' };
  return { petDetected: true, petType: concern === 'chin' ? 'cat' : 'unknown', imageQuality: 'good', targetVisible: true, careStatus: concern === 'breath' ? 'self_reported' : 'clear', visibleObservations: [labels[concern] || 'Photo of the selected area', 'No distinct warning sign is visible'], safetyFlags: [], rawSummary: 'The selected area is visible, so a daily-care suggestion is ready.', mode: 'mock' };
}

function promptFor(type: AnalysisType, concern: string) {
  const retryReasons = 'no_pet|blurry|dark|overexposed|too_far|target_hidden|unsupported_angle|wrong_pet_type';
  if (type === 'charm') return `Role: Describe the pet's visible charm in warm, specific, natural English. Return JSON only: {"petDetected":boolean,"petType":"dog"|"cat"|"unknown","imageQuality":"good"|"retry","retryReason":"${retryReasons}"|null,"compliment":string,"visibleTraits":[{"category":"face"|"coat"|"body"|"distinctive","trait":string}]}.
Rules: Select 1-3 distinct features that are clearly visible. Use concrete visual facts about eyes, nose, mouth, ears, markings, coat length/texture/color, posture, paws, tail, or accessories. The compliment must naturally combine at least two observed traits. Never guess personality, emotion, health, disease, age, sex, or breed. Do not repeat traits or use the background. Request a retry only when there is no pet, nothing is identifiable due to blur/darkness/overexposure, or the pet is too small. A face, upper body, full body, side view, or partially cropped pet can all pass. Write all user-facing strings in natural English.`;
  const config = findConcern(concern);
  if (!config) throw new Error('This care concern is not supported.');
  const specific: Record<string,string> = {
    breath: 'A photo cannot reveal odor. Pass only when the mouth, teeth, or gums are visible. A closed mouth is target_hidden. Never infer odor, cause, or severity.',
    dental: 'Pass when at least one tooth surface or molar is sharp enough to observe. Describe only visible color, deposits, staining, or debris. Never diagnose tartar, decay, periodontal disease, inflammation, or infection.',
    tangle: 'Pass when coat texture is close and sharp enough to assess. Observe only visible mats, knots, clumps, fur caught in a brush, or debris. Do not treat natural curls, long fur, wet fur, or shadows as tangles.',
    face: 'Pass when at least one eye and surrounding facial coat are clear. Observe only visible dry debris, localized staining, or clumped fur. Do not diagnose an eye condition or call the area normal/clean; say only what is or is not visible.',
    chin: 'This concern is for cats. A clear dog photo must return wrong_pet_type. Pass only when the skin or fur roots under the cat chin are clear. Observe dark specks, surface buildup, or clumped fur without diagnosing acne or infection.',
  };
  return `Role: Check whether this pet-care photo is usable and report only directly visible features. Concern: "${config.label}". Target: "${config.target}". Return JSON only: {"petDetected":boolean,"petType":"dog"|"cat"|"unknown","imageQuality":"good"|"retry","retryReason":"${retryReasons}"|null,"targetVisible":boolean,"careStatus":"clear"|"observed"|"caution","visibleObservations":string[],"safetyFlags":string[],"rawSummary":string}.
Pass when the target is visible and sharp enough for at least one neutral observation. Use target_hidden when blocked, unsupported_angle when the required surface is not shown, too_far when too small, and blurry/dark/overexposed only when observation is impossible. Use clear when no relevant feature is visible, observed when a relevant feature is directly visible, and caution only for unmistakable active bleeding, open wounds, marked swelling, heavy discharge, inability to open an eye, or a clearly broken tooth. Limit observations to three, include location, and avoid repetition. Never diagnose disease, severity, pain, treatment, or product effects. Write every user-facing string in natural English. ${specific[concern] || ''}`;
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
  let lastError = 'The AI analysis request failed.';
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
      lastError = response.status === 429 ? 'AI is receiving many requests. Please try again shortly.' : `AI did not respond. (${response.status})`;
      if (!retryable || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error('Workers AI connection failed', error instanceof Error ? error.name : 'UnknownError');
      lastError = error instanceof Error && error.name === 'AbortError' ? 'The AI analysis timed out.' : 'There was a problem connecting to AI.';
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
    if (!(photo instanceof File) || (analysisType !== 'charm' && analysisType !== 'care')) return Response.json({ error: 'This is not a valid analysis request.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(photo.type)) return Response.json({ error: 'This image format is not supported.' }, { status: 415 });
    if (photo.size < 1 || photo.size > MAX_BYTES) return Response.json({ error: 'The processed image must be under 3MB.' }, { status: 413 });

    const type = analysisType as AnalysisType;
    if (type === 'care' && !findConcern(concern)) return Response.json({ error: 'This care concern is not supported.' }, { status: 400 });
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const token = process.env.CLOUDFLARE_AI_API_TOKEN;
    if ((process.env.AI_MODE || 'mock') !== 'live' || !accountId || !token) return Response.json(mockResult(type, concern));

    const bytes = new Uint8Array(await photo.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    const image = `data:${photo.type};base64,${btoa(binary)}`;
    const result = await runWorkersAI(image, promptFor(type, concern), accountId, token);
    if (!isValidResult(result, type)) return Response.json({ error: 'The AI response could not be validated. Please try again.' }, { status: 502 });
    const normalized = result as Record<string, unknown>;
    if (type === 'care') {
      const flags = Array.isArray(normalized.safetyFlags) ? normalized.safetyFlags : [];
      normalized.careStatus = flags.length > 0 ? 'caution' : concern === 'breath' ? 'self_reported' : normalized.careStatus;
    }
    return Response.json({ ...normalized, mode: 'live' });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Something went wrong during analysis.' }, { status: 502 });
  }
}
