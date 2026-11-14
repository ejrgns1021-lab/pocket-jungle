// 카드 배틀 모드 데이터 — 서바이벌의 6속성·조합·유물·보스를 카드 규칙으로 옮김
// 효과 표기: dmg(피해) hits(타수) aoe(전체) rnd(무작위 대상) block(방어) heal(회복) draw(드로우) energy(에너지)
//           burn(화상) poison(독) freeze(빙결=약화) shock(감전=받는 피해↑) str(힘) thorns(가시) exhaust(소멸)
import { TYPES } from '../data.js'
export { TYPES }

const C = (id, name, icon, type, kind, cost, rarity, fx, up, extra = {}) => ({ id, name, icon, type, kind, cost, rarity, fx, up, ...extra })

export const CARDS = {
  // ── 풀: 방어·회복·독 ──
  g_strike: C('g_strike', '잎새칼날', '🍃', 'grass', 'attack', 1, 'starter', { dmg: 6 }, { dmg: 9 }),
  g_vine: C('g_vine', '넝쿨채찍', '🌿', 'grass', 'attack', 1, 'common', { dmg: 5, poison: 2 }, { dmg: 7, poison: 3 }),
  g_dew: C('g_dew', '이슬흡수', '🌱', 'grass', 'skill', 1, 'common', { block: 5, heal: 2 }, { block: 7, heal: 3 }),
  g_thorn: C('g_thorn', '가시덤불', '🌵', 'grass', 'power', 1, 'uncommon', { thorns: 3 }, { thorns: 5 }),
  g_petal: C('g_petal', '꽃잎회오리', '🌸', 'grass', 'attack', 2, 'uncommon', { dmg: 5, aoe: true, poison: 2 }, { dmg: 7, aoe: true, poison: 3 }),
  g_root: C('g_root', '세계수뿌리', '🌳', 'grass', 'skill', 2, 'rare', { block: 12, heal: 5, exhaust: true }, { block: 16, heal: 7, exhaust: true }),
  // ── 불꽃: 화상·폭딜 ──
  f_ember: C('f_ember', '불씨탄', '🔥', 'fire', 'attack', 1, 'starter', { dmg: 5, burn: 2 }, { dmg: 6, burn: 3 }),
  f_wheel: C('f_wheel', '화염바퀴', '🛞', 'fire', 'attack', 1, 'common', { dmg: 4, hits: 2 }, { dmg: 5, hits: 2 }),
  f_lava: C('f_lava', '용암구슬', '🌋', 'fire', 'attack', 1, 'common', { dmg: 7, burnX2: true }, { dmg: 9, burnX2: true }, { note: '화상 상태면 피해 2배' }),
  f_breath: C('f_breath', '홍염방사', '♨️', 'fire', 'attack', 2, 'uncommon', { dmg: 7, aoe: true, burn: 2 }, { dmg: 9, aoe: true, burn: 3 }),
  f_hell: C('f_hell', '업화', '🏮', 'fire', 'power', 1, 'uncommon', { str: 2 }, { str: 3 }),
  f_sun: C('f_sun', '태양폭발', '🌞', 'fire', 'attack', 3, 'rare', { dmg: 20, aoe: true, exhaust: true }, { dmg: 26, aoe: true, exhaust: true }),
  // ── 물: 방어·빙결·드로우 ──
  w_bubble: C('w_bubble', '거품방패', '🫧', 'water', 'skill', 1, 'starter', { block: 5 }, { block: 8 }),
  w_drop: C('w_drop', '물방울탄', '💧', 'water', 'attack', 1, 'common', { dmg: 5, draw: 1 }, { dmg: 7, draw: 1 }),
  w_ice: C('w_ice', '얼음조각', '🧊', 'water', 'attack', 1, 'common', { dmg: 4, freeze: 1 }, { dmg: 6, freeze: 2 }),
  w_wave: C('w_wave', '파도칼날', '🌊', 'water', 'attack', 2, 'common', { dmg: 9, block: 6 }, { dmg: 12, block: 8 }),
  w_frost: C('w_frost', '냉기숨결', '❄️', 'water', 'skill', 1, 'uncommon', { freeze: 2, aoe: true }, { freeze: 3, aoe: true }),
  w_tsunami: C('w_tsunami', '해일', '🐬', 'water', 'attack', 2, 'rare', { dmg: 10, aoe: true, freeze: 1 }, { dmg: 14, aoe: true, freeze: 2 }),
  // ── 전기: 감전·연쇄·에너지 ──
  e_static: C('e_static', '정전기', '⚡', 'electric', 'attack', 0, 'common', { dmg: 3, shock: 1 }, { dmg: 5, shock: 1 }),
  e_spark: C('e_spark', '스파크볼', '✨', 'electric', 'attack', 1, 'common', { dmg: 3, hits: 3, rnd: true }, { dmg: 4, hits: 3, rnd: true }),
  e_chain: C('e_chain', '번개사슬', '⛓️', 'electric', 'attack', 1, 'uncommon', { dmg: 6, chain: 3 }, { dmg: 8, chain: 4 }, { note: '다른 모든 적에게 튕김' }),
  e_discharge: C('e_discharge', '방전', '🔋', 'electric', 'skill', 0, 'uncommon', { energy: 1, exhaust: true }, { energy: 1, draw: 1 }),
  e_plasma: C('e_plasma', '플라즈마', '🔌', 'electric', 'skill', 1, 'common', { draw: 2, shock: 1, aoe: true }, { draw: 3, shock: 1, aoe: true }),
  e_god: C('e_god', '뇌신강림', '👑', 'electric', 'attack', 2, 'rare', { dmg: 14, shockX2: true }, { dmg: 18, shockX2: true }, { note: '감전 상태면 피해 2배' }),
  // ── 신비: 드로우·약화·손패 ──
  p_wave: C('p_wave', '염파', '🔮', 'psychic', 'attack', 1, 'common', { dmg: 6, freeze: 1 }, { dmg: 8, freeze: 1 }),
  p_moon: C('p_moon', '초승달칼날', '🌙', 'psychic', 'attack', 1, 'common', { dmg: 9 }, { dmg: 12 }),
  p_orb: C('p_orb', '환영구슬', '💫', 'psychic', 'skill', 1, 'common', { draw: 2, block: 3 }, { draw: 2, block: 6 }),
  p_storm: C('p_storm', '정신폭풍', '👁️', 'psychic', 'skill', 1, 'uncommon', { freeze: 1, shock: 1, aoe: true }, { freeze: 2, shock: 2, aoe: true }),
  p_future: C('p_future', '예지탄', '⏳', 'psychic', 'power', 1, 'uncommon', { drawPerTurn: 1 }, { drawPerTurn: 1, cost0: true }),
  p_galaxy: C('p_galaxy', '은하파동', '🌌', 'psychic', 'attack', 2, 'rare', { dmgPerHand: 4 }, { dmgPerHand: 5 }, { note: '손패 1장당 피해' }),
  // ── 용: 힘·강공 ──
  d_claw: C('d_claw', '용발톱', '🦖', 'dragon', 'attack', 1, 'starter', { dmg: 7, str: 1 }, { dmg: 9, str: 1 }),
  d_breath: C('d_breath', '용숨결', '🐲', 'dragon', 'attack', 2, 'common', { dmg: 13 }, { dmg: 17 }),
  d_tail: C('d_tail', '용꼬리', '🦎', 'dragon', 'attack', 1, 'common', { dmg: 6, block: 4 }, { dmg: 8, block: 6 }),
  d_roar: C('d_roar', '회오리포효', '🌪️', 'dragon', 'power', 1, 'uncommon', { str: 2 }, { str: 3 }),
  d_scale: C('d_scale', '용비늘폭풍', '💠', 'dragon', 'skill', 2, 'uncommon', { block: 8, blockPerStr: 3 }, { block: 12, blockPerStr: 3 }, { note: '힘 1당 방어 +3' }),
  d_time: C('d_time', '시간의포효', '🐉', 'dragon', 'attack', 3, 'rare', { dmg: 30 }, { dmg: 40 })
}

// 두 속성 카드를 손패에서 합치면 생기는 조합 카드 (서바이벌의 조합 진화와 같은 짝)
export const FUSION_CARDS = {
  f_solar_beam: { name: '태양광선', icon: '🌿🔥', req: ['grass', 'fire'], fx: { dmg: 18, aoe: true, burn: 3 }, color: '#ff9828' },
  f_storm_tsunami: { name: '폭풍 뇌우 해일', icon: '💧⚡', req: ['water', 'electric'], fx: { dmg: 12, aoe: true, shock: 2, freeze: 1 }, color: '#58c8ff' },
  f_crimson_dragon: { name: '홍련 드래곤 유성', icon: '🔥🐲', req: ['fire', 'dragon'], fx: { dmg: 26, burn: 4 }, color: '#ff4830' },
  f_hyper_rift: { name: '초전자 시공 균열', icon: '🔮⚡', req: ['psychic', 'electric'], fx: { dmg: 10, hits: 3, rnd: true, shock: 1 }, color: '#e888ff' },
  f_worldtree_flood: { name: '세계수 범람', icon: '🌿💧', req: ['grass', 'water'], fx: { block: 15, heal: 8 }, color: '#48f898' },
  f_spacetime_meteor: { name: '시공 유성군', icon: '🔮🐲', req: ['psychic', 'dragon'], fx: { dmg: 20, aoe: true }, color: '#9878ff' },
  f_azure_roar: { name: '청람 빙룡의 포효', icon: '💧🐲', req: ['water', 'dragon'], fx: { dmg: 18, freeze: 3, block: 10 }, color: '#48b8ff' },
  f_thunder_forest: { name: '황금 썬더포레스트', icon: '🌿⚡', req: ['grass', 'electric'], fx: { dmg: 8, aoe: true, poison: 4, shock: 2 }, color: '#d8f838' },
  f_magma_quake: { name: '대지 열폭발', icon: '🔥💧', req: ['fire', 'water'], fx: { dmg: 14, aoe: true, burn: 3, freeze: 1 }, color: '#ff7858' },
  f_mandala: { name: '창세 만다라', icon: '🌿🔮', req: ['grass', 'psychic'], fx: { draw: 3, energy: 2, heal: 6 }, color: '#ffe858' }
}

export const STARTER_DECK = ['g_strike', 'g_strike', 'g_strike', 'g_strike', 'w_bubble', 'w_bubble', 'w_bubble', 'w_bubble', 'd_claw', 'f_ember']

// ── 적 ── 행동 패턴을 순서대로 반복 (a: 공격 피해, n: 타수, b: 방어, s: 힘, 그 외 플레이어에게 거는 상태이상)
export const ENEMIES = {
  caterpillar: { name: '숲 애벌레', hp: 13, sprite: 'caterpillar', color: '#78d858', moves: [{ a: 5 }, { b: 5, a: 3 }] },
  sprout: { name: '독새싹몬', hp: 17, sprite: 'sprout', color: '#48b848', moves: [{ a: 4, poison: 2 }, { a: 7 }] },
  spider: { name: '정글 독거미', hp: 21, sprite: 'spider', color: '#9858d8', moves: [{ a: 3, n: 2 }, { freeze: 1, a: 4 }, { a: 8 }] },
  viper: { name: '정글 독사', hp: 25, sprite: 'viper', color: '#c068e8', moves: [{ a: 9 }, { poison: 3 }, { a: 5, b: 5 }] },
  hornet: { name: '황금 말벌', hp: 19, sprite: 'hornet', color: '#f8d838', moves: [{ a: 2, n: 4 }, { s: 2 }, { a: 6 }] },
  golem: { name: '이끼 골렘', hp: 52, sprite: 'golem', color: '#889890', elite: true, moves: [{ b: 12 }, { a: 15 }, { a: 7, b: 7 }] }
}

export const BOSSES = [
  { name: '가시꽃 수호자', icon: '🌺', hp: 150, sprite: 'thornbloom', color: '#48b848', moves: [{ a: 11 }, { poison: 4, b: 10 }, { s: 2, b: 15 }, { a: 6, n: 3 }] },
  { name: '낫사마귀 군주', icon: '⚔️', hp: 160, sprite: 'mantis', color: '#389848', moves: [{ a: 8, n: 2 }, { s: 3 }, { a: 20 }, { a: 5, n: 3 }] },
  { name: '아홉꼬리 여우불', icon: '🦊', hp: 165, sprite: 'foxfire', color: '#f88828', moves: [{ burn: 4 }, { a: 13, burn: 2 }, { a: 5, n: 4 }, { b: 20 }] },
  { name: '시간의 숲요정', icon: '🧚', hp: 145, sprite: 'fairy', color: '#78d858', moves: [{ heal: 20 }, { a: 15 }, { freeze: 2, shock: 2 }, { a: 9, n: 2 }] }
]

// ── 유물 (서바이벌과 같은 이름·아이콘, 카드 규칙으로 재해석) ──
export const CARD_RELICS = {
  twinRing: { icon: '💍', name: '쌍둥이 성좌의 반지', desc: '매 턴 첫 공격 카드가 두 번 발동' },
  meteorTablet: { icon: '☄️', name: '종말의 메테오 서판', desc: '3턴마다 모든 적에게 메테오 12 피해' },
  mjolnirShard: { icon: '🔨', name: '천둥망치의 파편', desc: '공격 카드 사용 시 30% 확률로 무작위 적에게 번개 5' },
  chronosWatch: { icon: '⏳', name: '시간술사의 회중시계', desc: '전투 첫 턴 에너지 +2' },
  worldTreeCore: { icon: '🌳', name: '세계수의 심장핵', desc: '최대 HP +12, 전투 승리 시 HP 5 회복' },
  voidMaw: { icon: '🕳️', name: '공허 포식자의 아가리', desc: '체력 15% 이하가 된 일반 적 즉시 처형' },
  akashicRecords: { icon: '📜', name: '현자의 기록서', desc: '매 턴 카드 1장 추가 드로우' },
  dragonScaleArmor: { icon: '🛡️', name: '용왕의 비늘 갑주', desc: '매 턴 시작 시 방어 4' }
}

// ── 오늘의 숲 변이 → 카드 규칙 (AI가 고른 같은 id를 그대로 사용) ──
export const CARD_MUTATORS = {
  giant: { desc: '적 체력 +40%, 골드 +50%', enemyHp: 1.4, gold: 1.5 },
  swarm: { desc: '전투마다 적 +1, 적 체력 -25%', extraEnemy: 1, enemyHp: 0.75 },
  bloodmoon: { desc: '적이 힘 1로 시작, 골드 +25%', enemyStr: 1, gold: 1.25 },
  greed: { desc: '골드 2배, 휴식 회복량 절반', gold: 2, restHeal: 0.5 },
  split: { desc: '쓰러진 적이 30% 확률로 작은 적으로 분열', split: 0.3 },
  storm: { desc: '내 턴마다 무작위 적에게 낙뢰 5 + 감전', storm: 5 },
  glass: { desc: '주는 피해 +30%, 최대 HP -30%', dmg: 1.3, maxHp: 0.7 },
  haste: { desc: '매 턴 드로우 +1, 적 공격 +1', draw: 1, enemyAtk: 1 },
  magnetic: { desc: '카드 보상 선택지 4장', rewardCount: 4 },
  fog: { desc: '적 의도가 가려지지만 골드 +30%', hideIntent: true, gold: 1.3 },
  elite: { desc: '정예 등장 증가, 정예 처치 시 유물 2개 중 선택+1', eliteBonus: true },
  vampire: { desc: '적 처치마다 HP 3 회복, 휴식 회복 없음', lifesteal: 3, restHeal: 0 },
  echo: { desc: '매 턴 첫 카드가 한 번 더 발동', echo: true },
  treasure: { desc: '보물 상자 칸이 늘어남', treasure: true },
  tiny: { desc: '전투마다 적 +1, 적 체력 -30%', extraEnemy: 1, enemyHp: 0.7 },
  rush: { desc: '조합 카드 비용 -1', fusionDiscount: 1 }
}

// 영구 업그레이드의 카드 모드 효과 설명 (id는 서바이벌과 공유)
export const CARD_META_DESC = {
  vit: '최대 HP +4', might: '공격 피해 +5%', swift: '전투 첫 턴 방어 +3', magnet: '골드 +10%',
  wisdom: '정수 +6%', luck: '희귀 카드 확률 +3%', reroll: '카드 보상 다시뽑기 +1', spiritPow: '정령 지원 피해 +20%',
  revive: '런마다 1회 부활 (HP 50%)'
}

export const EVENTS = [
  {
    id: 'mushroom', icon: '🍄', title: '빛나는 버섯 군락', text: '이상하게 빛나는 버섯이 잔뜩 자라 있다.',
    options: [{ label: '먹는다 (HP 12 회복)', act: { heal: 12 } }, { label: '채집한다 (골드 +35)', act: { gold: 35 } }]
  },
  {
    id: 'altar', icon: '🗿', title: '이끼 낀 고대 제단', text: '제단에서 낮은 웅웅거림이 들린다. 피를 바치면…',
    options: [{ label: 'HP 10을 바치고 유물 얻기', act: { hp: -10, relic: true } }, { label: '그냥 지나간다', act: {} }]
  },
  {
    id: 'spring', icon: '⛲', title: '맑은 정령의 샘', text: '정령이 반가워하며 샘으로 뛰어든다.',
    options: [{ label: '무작위 카드 2장 강화', act: { upgrade: 2 } }, { label: '최대 HP +5', act: { maxHp: 5 } }]
  },
  {
    id: 'merchant', icon: '🧙', title: '떠도는 약초상', text: '"카드 한 장을 버리면 값을 쳐 주지."',
    options: [{ label: '무작위 기본 카드 1장 제거 (+20골드)', act: { removeStarter: 1, gold: 20 } }, { label: '거절한다', act: {} }]
  }
]

export const NODE_INFO = {
  battle: { icon: '⚔️', name: '전투' },
  elite: { icon: '💀', name: '정예' },
  rest: { icon: '🔥', name: '모닥불' },
  shop: { icon: '🛒', name: '상점' },
  event: { icon: '❓', name: '이벤트' },
  treasure: { icon: '🎁', name: '보물' },
  boss: { icon: '👑', name: '보스' }
}

/** 카드 설명 문장 생성 (강화 여부 반영) */
export function cardText(card) {
  const f = card.upgraded ? card.up : card.fx
  if (!f) return ''
  const p = []
  const tgt = f.aoe ? '모든 적에게 ' : f.rnd ? '무작위 적에게 ' : ''
  if (f.dmg) p.push(tgt + '피해 ' + f.dmg + (f.hits > 1 ? ' ×' + f.hits : ''))
  if (f.dmgPerHand) p.push('손패 1장당 피해 ' + f.dmgPerHand)
  if (f.chain) p.push('다른 적에게 ' + f.chain + ' 연쇄')
  if (f.block) p.push('방어 ' + f.block)
  if (f.blockPerStr) p.push('힘 1당 방어 +' + f.blockPerStr)
  if (f.heal) p.push('HP ' + f.heal + ' 회복')
  if (f.poison) p.push((f.dmg ? '' : tgt) + '독 ' + f.poison)
  if (f.burn) p.push('화상 ' + f.burn)
  if (f.freeze) p.push((f.dmg ? '' : tgt) + '빙결 ' + f.freeze)
  if (f.shock) p.push((f.dmg ? '' : tgt) + '감전 ' + f.shock)
  if (f.str) p.push('힘 +' + f.str)
  if (f.thorns) p.push('가시 ' + f.thorns)
  if (f.drawPerTurn) p.push('매 턴 드로우 +' + f.drawPerTurn)
  if (f.draw) p.push(f.draw + '장 뽑기')
  if (f.energy) p.push('에너지 +' + f.energy)
  if (f.burnX2) p.push('화상이면 2배')
  if (f.shockX2) p.push('감전이면 2배')
  if (f.exhaust) p.push('소멸')
  return p.join(' · ')
}
