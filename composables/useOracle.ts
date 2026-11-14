// "오늘의 숲 신탁" — Firebase AI Logic(Gemini Flash)으로 하루 딱 1번만 생성해 모두가 공유
//
// 토큰 절약 흐름
//  1) 이 기기에 오늘 신탁이 저장돼 있으면 → 그대로 사용 (호출 0)
//  2) Firestore oracles/{오늘}에 있으면 → 읽어서 사용 (호출 0)
//  3) 오늘 첫 플레이어만 Gemini 호출 → Firestore에 저장 (규칙상 '최초 1회 생성'만 허용, 덮어쓰기 불가)
//  4) Firebase/AI가 없거나 실패 → 날짜 기반 생성 (호출 0)
// Gemini에는 변이 id 3개 + 짧은 글 3개만 JSON 스키마로 요청하고 생각(thinking)은 최소로 → 한 번에 수백 토큰
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { fallbackOracle, kstDayKey, MUTATORS, MUTATOR_IDS } from '~/game/mutators.js'

export interface Oracle {
  day: string
  name: string
  mutators: string[]
  bossTitle: string
  line: string
  source: 'ai' | 'local' | 'cache'
}

const oracle = ref<Oracle | null>(null)
const loading = ref(false)

const isValid = (o: any) =>
  o && Array.isArray(o.mutators) && o.mutators.length >= 2 &&
  o.mutators.every((m: string) => (MUTATORS as any)[m]) && typeof o.name === 'string'

async function askGemini(app: any, modelName: string, day: string): Promise<Oracle | null> {
  // AI SDK는 필요할 때만 불러와서 첫 화면 로딩을 가볍게 유지
  const { getAI, getGenerativeModel, GoogleAIBackend, Schema, ThinkingLevel } = await import('firebase/ai')
  const ai = getAI(app, { backend: new GoogleAIBackend() })
  const schema = Schema.object({
    properties: {
      n: Schema.string({ description: '숲 이름, 한국어 12자 이내' }),
      m: Schema.array({ items: Schema.enumString({ enum: MUTATOR_IDS }) }),
      b: Schema.string({ description: '보스 칭호 형용사, 한국어 6자 이내' }),
      l: Schema.string({ description: '신비로운 예언 한 줄, 한국어 30자 이내' })
    }
  })
  // 생각(thinking)은 최소로: 2.x는 예산 0, 3.x는 LOW. 모델이 거부하면 설정 없이 한 번 더 시도
  const thinking = modelName.startsWith('gemini-2')
    ? { thinkingBudget: 0 }
    : { thinkingLevel: ThinkingLevel.LOW }
  const makeModel = (withThinking: boolean) => getGenerativeModel(ai, {
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      maxOutputTokens: 1024, // 생각 토큰 포함 상한 (하루 1번이라 비용 미미)
      temperature: 1.1,
      ...(withThinking ? { thinkingConfig: thinking } : {})
    } as any,
    systemInstruction: '너는 레트로 픽셀 정글 서바이벌 게임의 일일 신탁이다.'
  })
  const catalog = MUTATOR_IDS.map((id) => `${id}:${(MUTATORS as any)[id].name}`).join(',')
  const prompt = `날짜 ${day}. 변이목록 ${catalog}. 서로 어울리는 변이 3개(m)와 숲 이름(n), 보스 칭호(b), 예언(l)을 정해.`
  let res
  try {
    res = await makeModel(true).generateContent(prompt)
  } catch (e: any) {
    if (!/thinking/i.test(String(e?.message))) throw e
    res = await makeModel(false).generateContent(prompt)
  }
  const j = JSON.parse(res.response.text())
  const ids = Array.from(new Set((j.m || []).filter((id: string) => MUTATOR_IDS.includes(id)))).slice(0, 3) as string[]
  if (ids.length < 2) return null
  const clean = (s: unknown, n: number) => String(s || '').replace(/[<>]/g, '').slice(0, n)
  console.info('[oracle] Gemini 토큰 사용량', res.response.usageMetadata)
  return { day, name: clean(j.n, 16) || '이름 없는 숲', mutators: ids, bossTitle: clean(j.b, 8), line: clean(j.l, 40), source: 'ai' }
}

export function useOracle() {
  const { $fb } = useNuxtApp() as any

  async function fetchToday() {
    const day = kstDayKey()
    if (oracle.value?.day === day) return oracle.value
    const cacheKey = 'pj_oracle_' + day
    const testMode = typeof location !== 'undefined' && new URLSearchParams(location.search).has('oracleTest')

    // 테스트: ?oracleTest 로 열면 저장 없이 Gemini를 직접 불러 결과/오류를 콘솔과 화면에 보여 줌
    if (testMode && $fb?.app) {
      try {
        await $fb.ready
        const r = await askGemini($fb.app, $fb.geminiModel, day)
        console.info('[oracleTest] 성공', r)
        oracle.value = r || (fallbackOracle(day) as Oracle)
      } catch (e: any) {
        console.error('[oracleTest] 실패', e?.code, e?.message, e)
        oracle.value = { ...(fallbackOracle(day) as Oracle), line: 'AI 오류: ' + String(e?.message || e).slice(0, 60) }
      }
      return oracle.value
    }

    // 1) 기기 캐시 (AI 결과는 하루 종일, 대체 결과는 30분만 유지하고 다시 시도)
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null')
      if (isValid(cached) && (cached.source !== 'local' || Date.now() - (cached.at || 0) < 30 * 60 * 1000)) {
        oracle.value = cached
        return cached
      }
    } catch (e) {}

    loading.value = true
    let result: Oracle | null = null
    try {
      if ($fb?.db) {
        await $fb.ready
        const ref = doc($fb.db, 'oracles', day)
        // 2) 공유 캐시 (AI가 만든 것만 저장되어 있음)
        const snap = await getDoc(ref)
        if (snap.exists() && isValid(snap.data()) && snap.data().source === 'ai') {
          result = { ...(snap.data() as Oracle), source: 'cache' }
        } else {
          // 3) 오늘 아직 아무도 성공 못 했으면 → Gemini 호출, 성공했을 때만 공유 저장
          try { result = await askGemini($fb.app, $fb.geminiModel, day) } catch (e) { console.warn('[oracle] Gemini 실패', e) }
          if (result) {
            try {
              await setDoc(ref, { day, name: result.name, mutators: result.mutators, bossTitle: result.bossTitle, line: result.line, source: 'ai' })
            } catch (e) {
              // 다른 사람이 먼저 저장했다면 그것을 사용 (모두 같은 숲을 보게)
              const again = await getDoc(ref)
              if (again.exists() && isValid(again.data()) && again.data().source === 'ai') result = { ...(again.data() as Oracle), source: 'cache' }
            }
          }
        }
      }
    } catch (e) {
      console.warn('[oracle]', e)
    }
    // 4) 대체 (저장하지 않음 → 다음 사람이 다시 AI 시도)
    if (!result) result = fallbackOracle(day) as Oracle
    oracle.value = result
    loading.value = false
    try { localStorage.setItem(cacheKey, JSON.stringify({ ...result, at: Date.now() })) } catch (e) {}
    return result
  }

  return { oracle, loading, fetchToday }
}
