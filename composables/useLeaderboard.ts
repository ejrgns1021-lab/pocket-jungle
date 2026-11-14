// 일일 랭킹: daily/{날짜}/{scores=서바이벌 | cards=카드 원정}/{uid} — 같은 '오늘의 숲'을 플레이한 사람끼리 경쟁
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore'
import { kstDayKey } from '~/game/mutators.js'

export interface ScoreRow { name: string; score: number; kills: number; time: number; level: number; uid?: string }

export function useLeaderboard(mode: 'scores' | 'cards' = 'scores') {
  const { $fb } = useNuxtApp() as any
  const enabled = computed(() => !!$fb?.db)
  const rows = ref<ScoreRow[]>([])
  const myUid = ref<string | null>(null)

  async function submit(row: ScoreRow) {
    if (!$fb?.db) return false
    const user = await $fb.ready
    if (!user) return false
    myUid.value = user.uid
    const ref = doc($fb.db, 'daily', kstDayKey(), mode, user.uid)
    try {
      const prev = await getDoc(ref)
      if (prev.exists() && (prev.data().score || 0) >= row.score) return false
      await setDoc(ref, {
        name: (row.name || '트레이너').slice(0, 12),
        score: Math.floor(row.score), kills: Math.floor(row.kills),
        time: Math.floor(row.time), level: Math.floor(row.level), at: Date.now()
      })
      return true
    } catch (e) { console.warn(e); return false }
  }

  async function loadTop(n = 20) {
    if (!$fb?.db) return
    const user = await $fb.ready
    myUid.value = user?.uid || null
    try {
      const q = query(collection($fb.db, 'daily', kstDayKey(), mode), orderBy('score', 'desc'), limit(n))
      const snap = await getDocs(q)
      rows.value = snap.docs.map((d) => ({ ...(d.data() as ScoreRow), uid: d.id }))
    } catch (e) { console.warn(e) }
  }

  return { enabled, rows, myUid, submit, loadTop }
}
