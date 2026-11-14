// 판이 끝나도 남는 영구 성장 (정수 → 업그레이드)

export const META_UPGRADES = [
  { id: 'vit', icon: '❤️', name: '강인함', desc: '시작 최대 체력 +10', max: 10, base: 20 },
  { id: 'might', icon: '⚔️', name: '완력', desc: '모든 피해 +5%', max: 10, base: 25 },
  { id: 'swift', icon: '👟', name: '날쌘 발', desc: '이동 속도 +4%', max: 5, base: 30 },
  { id: 'magnet', icon: '🧲', name: '끌림', desc: '자석 범위 +12%', max: 5, base: 20 },
  { id: 'wisdom', icon: '📘', name: '깨달음', desc: '경험치 +6%', max: 10, base: 25 },
  { id: 'luck', icon: '🍀', name: '행운', desc: '치명타 확률 +2%', max: 5, base: 35 },
  { id: 'reroll', icon: '🎲', name: '운명 비틀기', desc: '판마다 선택지 다시뽑기 +1회', max: 3, base: 60 },
  { id: 'spiritPow', icon: '🌱', name: '정령 교감', desc: '정령 공격력 +20%', max: 5, base: 30 },
  { id: 'revive', icon: '🪽', name: '불사조의 깃', desc: '판마다 1회 부활 (체력 50%)', max: 1, base: 300 }
]

export function upgradeCost(def, lv) {
  return Math.round(def.base * Math.pow(1.55, lv))
}

/** 정령 진화 단계: 누적 처치 수 기준 */
export const SPIRIT_STAGES = [
  { min: 0, name: '새싹 정령' },
  { min: 800, name: '물빛 정령' },
  { min: 4000, name: '태양 정령' }
]

export function spiritStage(totalKills) {
  let s = 0
  for (let i = 0; i < SPIRIT_STAGES.length; i++) if (totalKills >= SPIRIT_STAGES[i].min) s = i
  return s
}

export function defaultMeta() {
  return {
    essence: 0,
    upgrades: {},
    totalKills: 0,
    runs: 0,
    bestScore: 0,
    bestTime: 0,
    seenMutators: []
  }
}

/** 한 판 결과 → 점수와 획득 정수 */
export function scoreRun(r) {
  const multBonus = 1 + Math.log2(Math.max(1, r.peakMult)) * 0.1
  const score = Math.round((r.kills + r.time * 3 + r.bossKills * 200 + r.level * 15) * multBonus)
  const essence = Math.floor(r.kills / 8 + r.time / 6 + r.bossKills * 25)
  return { score, essence }
}
