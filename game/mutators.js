// "오늘의 숲 변이" 카탈로그 — 서버(AI 신탁)와 클라이언트가 같이 쓰는 순수 데이터 (DOM 없음)
// AI는 여기 있는 id 중 3개만 골라 주므로 토큰이 아주 적게 든다.

export const MUTATORS = {
  giant: { name: '거인의 날', icon: '🦣', desc: '적이 크고 단단해지지만 경험치도 1.8배', mods: { enemyScale: 1.35, enemyHp: 1.8, enemyXp: 1.8 } },
  swarm: { name: '대군세', icon: '🐜', desc: '적이 1.6배 자주 나오지만 체력은 낮음', mods: { spawnRate: 1.6, enemyHp: 0.7 } },
  bloodmoon: { name: '핏빛 달', icon: '🩸', desc: '적이 20% 빨라지고 경험치 +25%', mods: { enemySpeed: 1.2, enemyXp: 1.25, tint: 'rgba(160,20,30,0.16)' } },
  greed: { name: '황금 욕망', icon: '💰', desc: '황금 보석이 쏟아지지만 재생력 절반', mods: { goldBonus: 0.18, regenMult: 0.5 } },
  split: { name: '분열의 숲', icon: '🧬', desc: '쓰러진 적이 25% 확률로 둘로 갈라짐', mods: { splitChance: 0.25 } },
  storm: { name: '뇌우', icon: '⛈️', desc: '5초마다 하늘에서 번개가 적을 내리침', mods: { storm: true, tint: 'rgba(30,40,90,0.14)' } },
  glass: { name: '유리 대포', icon: '🥂', desc: '피해 +50%, 최대 체력 -40%', mods: { playerDmg: 0.5, playerHpMult: 0.6 } },
  haste: { name: '가속의 시간', icon: '⏩', desc: '모두가 15% 빨라지고 쿨타임 -10%', mods: { enemySpeed: 1.15, playerSpeed: 1.15, cdMult: 0.9 } },
  magnetic: { name: '자력 폭풍', icon: '🧲', desc: '보석 자석 범위 2배', mods: { magnetMult: 2 } },
  fog: { name: '짙은 안개', icon: '🌫️', desc: '시야가 좁아지지만 경험치 +35%', mods: { fog: true, enemyXp: 1.35 } },
  elite: { name: '정예의 숲', icon: '🏅', desc: '황금 테두리 정예몹 등장, 처치 시 유물 상자 확률', mods: { eliteChance: 0.08 } },
  vampire: { name: '흡혈 계약', icon: '🧛', desc: '처치마다 체력 흡수, 자연 재생 없음', mods: { lifesteal: 0.8, regenMult: 0 } },
  echo: { name: '메아리', icon: '🔁', desc: '스킬이 25% 확률로 한 번 더 발동', mods: { echoChance: 0.25 } },
  treasure: { name: '보물 사냥', icon: '🗝️', desc: '75초마다 근처에 유물 상자 출현', mods: { chestEvery: 75 } },
  tiny: { name: '소인국', icon: '🐭', desc: '작고 빠른 적이 우르르, 대신 약함', mods: { enemyScale: 0.75, enemySpeed: 1.25, enemyHp: 0.6, spawnRate: 1.3 } },
  rush: { name: '조합 러시', icon: '✨', desc: '조합 진화 해금 시간 절반', mods: { fusionTimeMult: 0.5 } }
}

export const MUTATOR_IDS = Object.keys(MUTATORS)

/** 여러 변이를 하나의 수치 묶음으로 합친다 */
export function combineMutators(ids) {
  const m = {
    enemyScale: 1, enemyHp: 1, enemyXp: 1, enemySpeed: 1, spawnRate: 1,
    goldBonus: 0, regenMult: 1, splitChance: 0, storm: false, playerDmg: 0, playerHpMult: 1,
    playerSpeed: 1, cdMult: 1, magnetMult: 1, fog: false, eliteChance: 0, lifesteal: 0,
    echoChance: 0, chestEvery: 0, fusionTimeMult: 1, tints: []
  }
  for (const id of ids || []) {
    const mu = MUTATORS[id]
    if (!mu) continue
    for (const [k, v] of Object.entries(mu.mods)) {
      if (k === 'tint') m.tints.push(v)
      else if (typeof v === 'boolean') m[k] = m[k] || v
      else if (['goldBonus', 'splitChance', 'playerDmg', 'eliteChance', 'lifesteal', 'echoChance'].includes(k)) m[k] += v
      else if (k === 'chestEvery') m[k] = m[k] ? Math.min(m[k], v) : v
      else m[k] *= v
    }
  }
  return m
}

/** 날짜 문자열로 만드는 결정적 난수 (AI 없이도 모두에게 같은 '오늘의 숲'을 보장) */
export function seedFrom(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

const NAME_A = ['속삭이는', '굶주린', '잠들지 않는', '뒤틀린', '빛나는', '울부짖는', '잊혀진', '타오르는']
const NAME_B = ['이끼숲', '안개골짜기', '고목의 정원', '덩굴미로', '반딧불 늪', '바람의 협곡', '버섯 왕국', '별빛 정글']
const BOSS_T = ['광폭한', '각성한', '저주받은', '황금빛', '그림자', '고대의', '분노한', '눈부신']
const LINES = [
  '오늘 숲은 낯선 숨을 쉰다.', '뿌리가 너의 발자국을 기억한다.', '달이 기울면 숲도 굶주린다.',
  '살아남는 자만 이름을 남긴다.', '바람이 세 번 울면 왕이 깨어난다.', '빛을 쫓는 자, 그림자를 조심하라.'
]

/** AI 호출이 불가능할 때 쓰는 결정적 오늘의 신탁 */
export function fallbackOracle(dayKey) {
  const r = seedFrom('jungle:' + dayKey)
  const pool = MUTATOR_IDS.slice()
  const picks = []
  while (picks.length < 3) picks.push(pool.splice(Math.floor(r() * pool.length), 1)[0])
  return {
    day: dayKey,
    name: NAME_A[Math.floor(r() * NAME_A.length)] + ' ' + NAME_B[Math.floor(r() * NAME_B.length)],
    mutators: picks,
    bossTitle: BOSS_T[Math.floor(r() * BOSS_T.length)],
    line: LINES[Math.floor(r() * LINES.length)],
    source: 'local'
  }
}

/** 한국 시간 기준 날짜 키 (예: 2026-11-14) */
export function kstDayKey(date = new Date()) {
  const k = new Date(date.getTime() + 9 * 3600 * 1000)
  return k.toISOString().slice(0, 10)
}

export function kstHour(date = new Date()) {
  return new Date(date.getTime() + 9 * 3600 * 1000).getUTCHours()
}
