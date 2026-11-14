// 스킬·패시브·조합·유물 데이터 (이름은 모두 오리지널로 교체 — 공개 배포 시 저작권 문제 방지)

export const TYPES = {
  grass: { id: 'grass', name: '풀', bg: '#48b848', fg: '#ffffff' },
  fire: { id: 'fire', name: '불꽃', bg: '#f05030', fg: '#ffffff' },
  water: { id: 'water', name: '물', bg: '#4898f8', fg: '#ffffff' },
  electric: { id: 'electric', name: '전기', bg: '#f8c820', fg: '#202830' },
  psychic: { id: 'psychic', name: '신비', bg: '#c068e8', fg: '#ffffff' },
  dragon: { id: 'dragon', name: '용', bg: '#5868e8', fg: '#ffffff' }
}

export const ARCHETYPES = {
  grass: { pattern: 'orbit', cd: 1.85, dmg: 23, count: 2, color: '#48d858', desc: '주변을 회전하며 적을 베어내는 잎날 보호막' },
  fire: { pattern: 'projectile', cd: 0.62, dmg: 22, count: 1, color: '#f85830', desc: '가장 가까운 적에게 작열하는 화염탄 발사' },
  water: { pattern: 'boomerang', cd: 1.0, dmg: 21, count: 2, color: '#48b8f8', desc: '날아갔다가 돌아오는 수류 부메랑' },
  electric: { pattern: 'lightning', cd: 1.05, dmg: 25, count: 3, color: '#f8d830', desc: '적들 사이를 튕기는 연쇄 번개' },
  psychic: { pattern: 'homing', cd: 0.85, dmg: 23, count: 2, color: '#d878f8', desc: '적을 끝까지 추적하는 신비 오브' },
  dragon: { pattern: 'nova', cd: 1.25, dmg: 31, count: 1, color: '#7888ff', desc: '주변 적을 밀어내는 용의 충격파' }
}

const NAMES_BY_TYPE = {
  grass: [['잎새칼날', '🍃'], ['넝쿨채찍', '🌿'], ['클로버폭풍', '🍀'], ['도토리탄', '🌰'], ['이슬흡수', '🌱'], ['가시덤불', '🌵'], ['꽃잎회오리', '🌸'], ['녹엽광선', '🟢'], ['햇살잎', '☀️'], ['세계수뿌리', '🌳']],
  fire: [['불씨탄', '🔥'], ['화염바퀴', '🛞'], ['회염', '🌀'], ['용암구슬', '🌋'], ['홍염방사', '♨️'], ['불사조깃', '🪶'], ['작열의별', '🌟'], ['업화', '🏮'], ['화산탄', '☄️'], ['태양폭발', '🌞']],
  water: [['물방울탄', '💧'], ['거품방패', '🫧'], ['얼음조각', '🧊'], ['파도칼날', '🌊'], ['냉기숨결', '❄️'], ['소용돌이', '🌀'], ['빙산낙하', '🏔️'], ['심해의창', '🔱'], ['해일', '🐬'], ['눈보라', '🌨️']],
  electric: [['정전기', '⚡'], ['스파크볼', '✨'], ['번개사슬', '⛓️'], ['뇌전주먹', '👊'], ['방전', '🔋'], ['플라즈마', '🔌'], ['천둥창', '🌩️'], ['낙뢰', '⚡'], ['전격돌진', '🦁'], ['뇌신강림', '👑']],
  psychic: [['염파', '🔮'], ['무지개빔', '🌈'], ['별똥탄', '⭐'], ['초승달칼날', '🌙'], ['환영구슬', '💫'], ['정신폭풍', '👁️'], ['꿈의파동', '💤'], ['예지탄', '⏳'], ['달빛오브', '🌕'], ['은하파동', '🌌']],
  dragon: [['용숨결', '🐲'], ['회오리포효', '🌪️'], ['용발톱', '🦖'], ['용꼬리', '🦎'], ['용비늘폭풍', '💠'], ['비룡강하', '🦅'], ['용의분노', '💢'], ['진룡파', '💥'], ['용성우', '☄️'], ['시간의포효', '🐉']]
}
const TYPE_ORDER = ['grass', 'fire', 'water', 'electric', 'psychic', 'dragon']

// 원본과 같은 규칙: 0~59번이 6속성 순서로 돌아가며 배치되고, 뒤 번호일수록 위력이 조금 높다
export const SKILLS_60 = Array.from({ length: 60 }, (_, idx) => {
  const type = TYPE_ORDER[idx % 6]
  const [name, icon] = NAMES_BY_TYPE[type][Math.floor(idx / 6)]
  const arch = ARCHETYPES[type]
  const scale = 1 + (idx / 60) * 0.32
  return {
    id: idx, name, icon, type,
    pattern: arch.pattern, cdBase: arch.cd, dmgBase: Math.round(arch.dmg * scale),
    countBase: arch.count, color: arch.color, desc: arch.desc
  }
})

export const MAX_SKILL_SLOTS = 20

export const PASSIVES = [
  { id: 'p_power', name: '힘의 렌즈', icon: '👓', tag: '공격력 +15%', desc: '모든 스킬 피해 +15%', applyRank: (p) => { p.dmgMult += 0.15 } },
  { id: 'p_scarf', name: '바람 스카프', icon: '🧣', tag: '이동속도 +12%', desc: '이동 속도 +12%', applyRank: (p) => { p.speed *= 1.12 } },
  { id: 'p_metronome', name: '메트로놈', icon: '⏱️', tag: '쿨타임 -10%', desc: '모든 스킬 재사용 대기시간 -10%', applyRank: (p) => { p.cdMult *= 0.9 } },
  { id: 'p_wide', name: '확산 렌즈', icon: '🔍', tag: '범위 +15%', desc: '투사체·보호막·충격파 범위 +15%', applyRank: (p, g) => { p.areaMult += 0.15; g.rebuildOrbitShields() } },
  { id: 'p_lunch', name: '숲의 도시락', icon: '🍙', tag: '최대HP +25 · 재생', desc: '최대 체력 +25, 초당 재생 +1.5', applyRank: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); p.regen += 1.5 } },
  { id: 'p_magnet', name: '자석 코일', icon: '🧲', tag: '자석 +30%', desc: '보석·상자를 끌어당기는 범위 +30%', applyRank: (p) => { p.magnetRange *= 1.3 } },
  { id: 'p_hawk', name: '매의 눈', icon: '🎯', tag: '치명 +7% · 피해 +20%', desc: '치명타 확률 +7%, 치명타 배율 +20%', applyRank: (p) => { p.critChance = Math.min(1, p.critChance + 0.07); p.critMult += 0.2 } },
  { id: 'p_feather', name: '지식의 깃털', icon: '🪶', tag: '경험치 +18%', desc: '모든 경험치 획득 +18%', applyRank: (p) => { p.xpMult += 0.18 } },
  { id: 'p_bell', name: '생명의 방울', icon: '🔔', tag: '15처치마다 회복', desc: '15마리 처치할 때마다 체력 6 회복', applyRank: (p) => { p.shellBellRank += 1 } },
  { id: 'p_pierce', name: '관통의 징표', icon: '🗡️', tag: '관통 +1', desc: '모든 투사체 관통 횟수 +1', applyRank: (p) => { p.bonusPierce += 1 } }
]

export const FUSIONS = [
  { id: 'f_solar_beam', name: '태양광선', icon: '🌿🔥', reqTypes: ['grass', 'fire'], unlockSec: 60, cdBase: 1.35, dmgBase: 62, color: '#ff9828', desc: '응축된 태양 광선이 일직선의 적을 불태웁니다' },
  { id: 'f_storm_tsunami', name: '폭풍 뇌우 해일', icon: '💧⚡', reqTypes: ['water', 'electric'], unlockSec: 60, cdBase: 1.3, dmgBase: 64, color: '#58c8ff', desc: '해일 파동과 7연쇄 낙뢰가 동시에 몰아칩니다' },
  { id: 'f_crimson_dragon', name: '홍련 드래곤 유성', icon: '🔥🐲', reqTypes: ['fire', 'dragon'], unlockSec: 90, cdBase: 1.35, dmgBase: 78, color: '#ff4830', desc: '홍련 운석이 전방을 연속 폭격합니다' },
  { id: 'f_hyper_rift', name: '초전자 시공 균열', icon: '🔮⚡', reqTypes: ['psychic', 'electric'], unlockSec: 90, cdBase: 1.32, dmgBase: 76, color: '#e888ff', desc: '시공을 가르는 광선이 적을 증발시킵니다' },
  { id: 'f_worldtree_flood', name: '세계수 범람', icon: '🌿💧', reqTypes: ['grass', 'water'], unlockSec: 120, cdBase: 1.45, dmgBase: 74, color: '#48f898', desc: '생명의 탁류로 체력을 회복하고 적을 휩씁니다' },
  { id: 'f_spacetime_meteor', name: '시공 유성군', icon: '🔮🐲', reqTypes: ['psychic', 'dragon'], unlockSec: 120, cdBase: 1.5, dmgBase: 92, color: '#9878ff', desc: '초신성 파동이 넓은 범위를 강타합니다' },
  { id: 'f_azure_roar', name: '청람 빙룡의 포효', icon: '💧🐲', reqTypes: ['water', 'dragon'], unlockSec: 150, cdBase: 1.25, dmgBase: 88, color: '#48b8ff', desc: '빙결 파편이 사방으로 터져 적을 얼립니다' },
  { id: 'f_thunder_forest', name: '황금 썬더포레스트', icon: '🌿⚡', reqTypes: ['grass', 'electric'], unlockSec: 150, cdBase: 1.22, dmgBase: 86, color: '#d8f838', desc: '전격 회오리가 퍼져나가며 적을 지집니다' },
  { id: 'f_magma_quake', name: '대지 열폭발', icon: '🔥💧', reqTypes: ['fire', 'water'], unlockSec: 180, cdBase: 1.3, dmgBase: 104, color: '#ff7858', desc: '수증기 폭발로 주변 적을 강타하고 얼립니다' },
  { id: 'f_mandala', name: '창세 만다라', icon: '🌿🔮', reqTypes: ['grass', 'psychic'], unlockSec: 240, cdBase: 1.35, dmgBase: 122, color: '#ffe858', desc: '성광 만다라가 사방에 유도탄을 뿌립니다' }
]

export const RELICS = [
  { id: 'twinRing', icon: '💍', name: '쌍둥이 성좌의 반지', tag: '투사체 x2', desc: '모든 스킬의 투사체 수가 2배가 됩니다', apply: (p) => { p.projMult *= 2 } },
  { id: 'meteorTablet', icon: '☄️', name: '종말의 메테오 서판', tag: '메테오 3연발', desc: '2.3초마다 거대 메테오 3개가 떨어집니다', apply: () => {} },
  { id: 'mjolnirShard', icon: '🔨', name: '천둥망치의 파편', tag: '적중 시 연쇄 번개', desc: '적중 시 45% 확률로 8연쇄 번개', apply: () => {} },
  { id: 'chronosWatch', icon: '⏳', name: '시간술사의 회중시계', tag: '쿨타임 -35%', desc: '재사용 대기시간 -35%, 이동속도 +20%', apply: (p) => { p.cdMult *= 0.65; p.speed *= 1.2 } },
  { id: 'worldTreeCore', icon: '🌳', name: '세계수의 심장핵', tag: '최대HP·치유 노바', desc: '최대 체력 +60, 재생 +4, 주기적 치유 충격파', apply: (p) => { p.maxHp += 60; p.hp = Math.min(p.maxHp, p.hp + 60); p.regen += 4 } },
  { id: 'voidMaw', icon: '🕳️', name: '공허 포식자의 아가리', tag: '블랙홀 · 20% 처형', desc: '3초마다 블랙홀 소환, 체력 20% 이하 일반 적 처형', apply: () => {} },
  { id: 'akashicRecords', icon: '📜', name: '현자의 기록서', tag: '경험치 +50% · 위력 +25%', desc: '경험치 +50%, 스킬 피해 +25%', apply: (p) => { p.xpMult *= 1.5; p.dmgMult += 0.25 } },
  { id: 'dragonScaleArmor', icon: '🛡️', name: '용왕의 비늘 갑주', tag: '회전 용검 · 피해 -25%', desc: '받는 피해 -25%, 회전하는 용검 4자루 소환', apply: (p) => { p.dmgTakenMult *= 0.75 } }
]

export const BOSS_TEMPLATES = [
  { sprite: 'thornbloom', name: '가시꽃 수호자', icon: '🌺', color: '#48b848', r: 36, hp: 780, spd: 72, dmg: 22 },
  { sprite: 'mantis', name: '낫사마귀 군주', icon: '⚔️', color: '#389848', r: 36, hp: 1650, spd: 108, dmg: 28 },
  { sprite: 'foxfire', name: '아홉꼬리 여우불', icon: '🦊', color: '#f88828', r: 36, hp: 2900, spd: 92, dmg: 35 },
  { sprite: 'fairy', name: '시간의 숲요정', icon: '🧚', color: '#78d858', r: 34, hp: 4500, spd: 98, dmg: 42 }
]

export const ENEMY_TABLE = {
  caterpillar: { r: 13, hp: 14, spd: 102, dmg: 8, col: '#78d858' },
  sprout: { r: 14, hp: 20, spd: 98, dmg: 10, col: '#48b848' },
  spider: { r: 14, hp: 25, spd: 114, dmg: 12, col: '#9858d8' },
  viper: { r: 14, hp: 32, spd: 126, dmg: 14, col: '#c068e8' },
  hornet: { r: 15, hp: 42, spd: 138, dmg: 16, col: '#f8d838' },
  golem: { r: 20, hp: 94, spd: 65, dmg: 20, col: '#889890' }
}
