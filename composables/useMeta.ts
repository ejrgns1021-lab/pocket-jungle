// 영구 성장 데이터: localStorage에 항상 저장 + Firebase가 켜져 있으면 players/{uid}에도 저장
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { META_UPGRADES, upgradeCost, defaultMeta, scoreRun, spiritStage } from '~/game/meta.js'

const KEY = 'pj_meta_v1'
const state = reactive(defaultMeta()) as ReturnType<typeof defaultMeta>
let loaded = false

export function useMeta() {
  const { $fb } = useNuxtApp() as any

  function saveLocal() {
    try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) {}
  }

  async function saveRemote() {
    if (!$fb?.db) return
    const user = await $fb.ready
    if (!user) return
    try { await setDoc(doc($fb.db, 'players', user.uid), { ...state, updatedAt: Date.now() }) } catch (e) { console.warn(e) }
  }

  async function load() {
    if (loaded) return
    loaded = true
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) Object.assign(state, defaultMeta(), JSON.parse(raw))
    } catch (e) {}
    if ($fb?.db) {
      const user = await $fb.ready
      if (!user) return
      try {
        const snap = await getDoc(doc($fb.db, 'players', user.uid))
        // 더 많이 플레이한 쪽 기록을 신뢰
        if (snap.exists() && (snap.data().runs || 0) > state.runs) {
          Object.assign(state, defaultMeta(), snap.data())
          saveLocal()
        }
      } catch (e) { console.warn(e) }
    }
  }

  function levelOf(id: string) {
    return (state.upgrades as Record<string, number>)[id] || 0
  }

  function buy(id: string) {
    const def = META_UPGRADES.find((d) => d.id === id)
    if (!def) return false
    const lv = levelOf(id)
    if (lv >= def.max) return false
    const cost = upgradeCost(def, lv)
    if (state.essence < cost) return false
    state.essence -= cost
    ;(state.upgrades as Record<string, number>)[id] = lv + 1
    saveLocal()
    saveRemote()
    return true
  }

  /** 판 결과 반영 → 점수/정수/정령 진화 여부 */
  function recordRun(run: any, mutators: string[]) {
    const { score, essence } = scoreRun(run)
    const prevStage = spiritStage(state.totalKills)
    state.essence += essence
    state.totalKills += run.kills
    state.runs += 1
    const newBest = score > state.bestScore
    if (newBest) state.bestScore = score
    if (run.time > state.bestTime) state.bestTime = run.time
    for (const m of mutators) if (!state.seenMutators.includes(m)) state.seenMutators.push(m)
    const stage = spiritStage(state.totalKills)
    saveLocal()
    saveRemote()
    return { score, essence, newBest, evolved: stage > prevStage, stage }
  }

  /** 카드 원정 결과 반영 (점수·정수는 엔진이 계산) */
  function recordCardRun(r: any, mutators: string[]) {
    const prevStage = spiritStage(state.totalKills)
    state.essence += r.essence
    state.totalKills += r.kills
    state.runs += 1
    const s = state as any
    const newBest = r.score > (s.bestCardScore || 0)
    if (newBest) s.bestCardScore = r.score
    for (const m of mutators) if (!state.seenMutators.includes(m)) state.seenMutators.push(m)
    const stage = spiritStage(state.totalKills)
    saveLocal()
    saveRemote()
    return { newBest, evolved: stage > prevStage, stage }
  }

  return { meta: state, load, buy, levelOf, recordRun, recordCardRun, spiritStage: computed(() => spiritStage(state.totalKills)) }
}
