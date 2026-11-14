// 카드 배틀 규칙 엔진 — 화면과 분리된 순수 로직.
// Vue가 reactive()로 감싼 run 객체를 그대로 바꾸면 화면이 자동 갱신된다.
// 연출이 필요한 순간마다 emit({type, ...})로 이벤트를 보내고, 전투 장면(scene.js)이 그걸 그린다.
import { CARDS, FUSION_CARDS, STARTER_DECK, ENEMIES, BOSSES, CARD_RELICS, CARD_MUTATORS, EVENTS } from './data.js'
import { seedFrom } from '../mutators.js'

let emit = () => {}
export function setEmitter(fn) { emit = fn || (() => {}) }

let uidSeq = 1
const uid = () => uidSeq++
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ─────────────────────────────────────────────────────────────
// 카드 정의 조회
// ─────────────────────────────────────────────────────────────
export function cardDef(inst) {
  if (inst.fusion) {
    const f = FUSION_CARDS[inst.fusion]
    return { id: inst.fusion, name: f.name, icon: f.icon, type: 'fusion', kind: f.fx.dmg ? 'attack' : 'skill', cost: inst.cost, rarity: 'fusion', fx: { ...f.fx, exhaust: true }, up: { ...f.fx, exhaust: true }, color: f.color, upgraded: false }
  }
  const d = CARDS[inst.id]
  const upgraded = !!inst.upgraded
  const cost = upgraded && d.up && d.up.cost0 ? 0 : d.cost
  return { ...d, cost, upgraded }
}
export const cardFx = (def) => (def.upgraded ? def.up : def.fx) || {}
const newCard = (id, upgraded = false) => ({ uid: uid(), id, upgraded })

// ─────────────────────────────────────────────────────────────
// 런 시작
// ─────────────────────────────────────────────────────────────
export function combineCardMods(ids) {
  const m = { enemyHp: 1, gold: 1, extraEnemy: 0, enemyStr: 0, restHeal: 1, split: 0, storm: 0, dmg: 1, maxHp: 1, draw: 0, enemyAtk: 0, rewardCount: 3, hideIntent: false, eliteBonus: false, lifesteal: 0, echo: false, treasure: false, fusionDiscount: 0 }
  for (const id of ids || []) {
    const c = CARD_MUTATORS[id]
    if (!c) continue
    for (const [k, v] of Object.entries(c)) {
      if (k === 'desc') continue
      if (typeof v === 'boolean') m[k] = m[k] || v
      else if (['extraEnemy', 'enemyStr', 'split', 'storm', 'draw', 'enemyAtk', 'lifesteal', 'fusionDiscount'].includes(k)) m[k] += v
      else if (k === 'rewardCount') m[k] = Math.max(m[k], v)
      else if (k === 'restHeal') m[k] = Math.min(m[k], v)
      else m[k] *= v
    }
  }
  return m
}

export function newRun({ day, mutators = [], bossTitle = '', upgrades = {}, spiritStage = 0 }) {
  const mods = combineCardMods(mutators)
  const maxHp = Math.round((70 + (upgrades.vit || 0) * 4) * mods.maxHp)
  const run = {
    day, mutators, bossTitle, mods, upgrades, spiritStage,
    act: 1, map: null, pos: null, totalFloors: 0,
    hp: maxHp, maxHp, gold: 99, deck: STARTER_DECK.map((id) => newCard(id)), relics: [],
    revives: upgrades.revive || 0, rerolls: upgrades.reroll || 0,
    screen: 'map', battle: null, reward: null, shop: null, event: null, rest: null,
    stats: { kills: 0, elites: 0, bosses: 0, startedAt: Date.now() },
    shopRemoveUsed: false
  }
  run.map = genMap(run)
  return run
}

// ─────────────────────────────────────────────────────────────
// 지도 (오늘 날짜로 시드 → 모두에게 같은 지도)
// ─────────────────────────────────────────────────────────────
const ROWS = 12
const COLS = 4

function genMap(run) {
  const rng = seedFrom('map:' + run.day + ':' + run.act)
  const ri = (n) => Math.floor(rng() * n)
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null))
  const ensure = (r, c) => (grid[r][c] ||= { row: r, col: c, type: 'battle', next: [], visited: false })
  const starts = []
  for (let p = 0; p < 4; p++) {
    let c = p < 2 ? (p === 0 ? ri(2) : 2 + ri(2)) : ri(COLS)
    starts.push(c)
    for (let r = 0; r < ROWS; r++) {
      const node = ensure(r, c)
      if (r < ROWS - 1) {
        const nc = Math.max(0, Math.min(COLS - 1, c + ri(3) - 1))
        if (!node.next.includes(nc)) node.next.push(nc)
        c = nc
      }
    }
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const n = grid[r][c]
      if (!n) continue
      if (r === 0) n.type = 'battle'
      else if (r === ROWS - 1) n.type = 'rest'
      else if (r === 6) n.type = 'treasure'
      else {
        const w = [
          ['battle', 45], ['event', 20], ['elite', r >= 4 ? (run.mods.eliteBonus ? 20 : 12) : 0],
          ['rest', r >= 5 ? 10 : 0], ['shop', r >= 3 ? 10 : 0], ['treasure', run.mods.treasure ? 8 : 0]
        ]
        const total = w.reduce((s, x) => s + x[1], 0)
        let roll = rng() * total
        for (const [t, v] of w) { if ((roll -= v) < 0) { n.type = t; break } }
      }
    }
  }
  const rows = grid.map((row) => row.filter(Boolean))
  rows.push([{ row: ROWS, col: 1.5, type: 'boss', next: [], visited: false }])
  for (const n of rows[ROWS - 1]) n.next = [1.5]
  const bossIdx = Math.floor(rng() * BOSSES.length)
  return { rows, bossIdx }
}

export function availableNodes(run) {
  if (!run.pos) return run.map.rows[0]
  const cur = run.map.rows[run.pos.row].find((n) => n.col === run.pos.col)
  const nextRow = run.map.rows[run.pos.row + 1] || []
  return nextRow.filter((n) => cur.next.includes(n.col))
}

export function enterNode(run, node) {
  node.visited = true
  run.pos = { row: node.row, col: node.col }
  run.totalFloors++
  emit({ type: 'enterNode', node: node.type })
  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') startBattle(run, node.type, node.row)
  else if (node.type === 'rest') { run.rest = { done: false }; run.screen = 'rest' }
  else if (node.type === 'shop') openShop(run)
  else if (node.type === 'event') { run.event = { ...pick(EVENTS), result: null }; run.screen = 'event' }
  else if (node.type === 'treasure') { run.reward = { gold: rand(20, 40), cards: null, relics: relicChoices(run, 1), from: 'treasure' }; run.screen = 'reward' }
}

// ─────────────────────────────────────────────────────────────
// 전투
// ─────────────────────────────────────────────────────────────
function makeEnemy(run, key, row, opts = {}) {
  const base = ENEMIES[key]
  const actMul = 1 + (run.act - 1) * 0.7
  const hp = Math.max(4, Math.round(base.hp * actMul * (1 + row * 0.04) * run.mods.enemyHp * (opts.hpMul || 1) * (0.9 + Math.random() * 0.2)))
  return {
    uid: uid(), key, name: (opts.prefix || '') + base.name, sprite: base.sprite, color: opts.elite ? '#f8d838' : base.color,
    hp, maxHp: hp, block: 0, str: run.mods.enemyStr + (opts.str || 0) + (run.act - 1) * 2, burn: 0, poison: 0, freeze: 0, shock: 0,
    moves: base.moves, moveIdx: rand(0, base.moves.length - 1), isBoss: false, elite: !!opts.elite, mini: !!opts.mini,
    scale: opts.scale || 1, dead: false
  }
}

function makeBoss(run) {
  const b = BOSSES[(run.map.bossIdx + run.act - 1) % BOSSES.length]
  const hp = Math.round(b.hp * (1 + (run.act - 1) * 0.8) * Math.max(0.85, run.mods.enemyHp))
  return {
    uid: uid(), key: 'boss', name: (run.bossTitle ? run.bossTitle + ' ' : '') + b.name, icon: b.icon, sprite: b.sprite, color: b.color,
    hp, maxHp: hp, block: 0, str: run.mods.enemyStr + (run.act - 1) * 2, burn: 0, poison: 0, freeze: 0, shock: 0,
    moves: b.moves, moveIdx: 0, isBoss: true, elite: false, mini: false, scale: 1, dead: false
  }
}

function encounter(run, type, row) {
  if (type === 'boss') return [makeBoss(run)]
  if (type === 'elite') {
    const r = Math.random()
    if (r < 0.4) return [makeEnemy(run, 'golem', row, { elite: true, prefix: '정예 ', hpMul: 1.1 })]
    if (r < 0.7) return [makeEnemy(run, 'hornet', row, { elite: true, prefix: '정예 ', hpMul: 1.6, str: 1 }), makeEnemy(run, 'hornet', row, { elite: true, prefix: '정예 ', hpMul: 1.6, str: 1 })]
    return [makeEnemy(run, 'viper', row, { elite: true, prefix: '거대 ', hpMul: 2.6, str: 2, scale: 1.3 })]
  }
  const weak = ['caterpillar', 'sprout', 'spider']
  const all = ['caterpillar', 'sprout', 'spider', 'viper', 'hornet']
  let n = row === 0 ? 1 : row < 3 ? rand(1, 2) : rand(2, 3)
  n = Math.min(4, n + run.mods.extraEnemy)
  const pool = row < 3 ? weak : all
  return Array.from({ length: n }, () => makeEnemy(run, pick(pool), row))
}

export function startBattle(run, type, row) {
  const enemies = encounter(run, type, row)
  const b = {
    type, enemies, turn: 0, target: 0,
    player: { block: 0, str: 0, burn: 0, poison: 0, freeze: 0, shock: 0, thorns: 0, drawPerTurn: 0 },
    draw: shuffle(run.deck.map((c) => ({ ...c }))), hand: [], discard: [], exhaust: [],
    energy: 0, maxEnergy: 3, chainType: null, chain: 0, cardsThisTurn: 0, firstAttackDone: false,
    phase: 'player', busy: false
  }
  run.battle = b
  run.screen = 'battle'
  for (const e of enemies) setIntent(run, e)
  emit({ type: 'battleStart', boss: type === 'boss', elite: type === 'elite', name: enemies[0]?.name, icon: enemies[0]?.icon })
  startPlayerTurn(run, true)
}

export const aliveEnemies = (run) => run.battle.enemies.filter((e) => !e.dead)

function setIntent(run, e) {
  const m = e.moves[e.moveIdx % e.moves.length]
  const atk = m.a ? Math.max(0, Math.floor((m.a + e.str + run.mods.enemyAtk) * (e.freeze > 0 ? 0.75 : 1))) : 0
  e.intent = { ...m, atk, hidden: run.mods.hideIntent && !e.isBoss }
}

function drawCards(run, n) {
  const b = run.battle
  for (let i = 0; i < n; i++) {
    if (b.hand.length >= 10) break
    if (b.draw.length === 0) {
      if (b.discard.length === 0) break
      b.draw = shuffle(b.discard)
      b.discard = []
      emit({ type: 'shuffle' })
    }
    b.hand.push(b.draw.pop())
  }
}

export function startPlayerTurn(run, first = false) {
  const b = run.battle
  const p = b.player
  b.turn++
  b.phase = 'player'
  b.chainType = null
  b.chain = 0
  b.cardsThisTurn = 0
  b.firstAttackDone = false
  p.block = 0
  if (run.relics.includes('dragonScaleArmor')) p.block += 4
  if (first && run.upgrades.swift) p.block += 3 * run.upgrades.swift

  // 플레이어 상태이상 피해
  if (p.poison > 0) { hurtPlayer(run, p.poison, '#68e858', true); p.poison-- }
  if (p.burn > 0) { hurtPlayer(run, p.burn, '#ff7030', true); p.burn-- }
  if (run.screen !== 'battle') return

  b.energy = b.maxEnergy + (first && run.relics.includes('chronosWatch') ? 2 : 0)
  let n = 5 + p.drawPerTurn + run.mods.draw + (run.relics.includes('akashicRecords') ? 1 : 0)
  drawCards(run, n)
  emit({ type: 'turn', who: 'player', turn: b.turn })

  // 동료 정령 지원 사격
  const alive = aliveEnemies(run)
  if (alive.length) {
    const t = pick(alive)
    const dmg = Math.round((3 + run.spiritStage * 2) * (1 + (run.upgrades.spiritPow || 0) * 0.2))
    emit({ type: 'spirit', to: t.uid })
    dealDamage(run, t, dmg, ['#78d858', '#68d8f8', '#f8d838'][run.spiritStage] || '#78d858', { raw: true })
  }
  // 메테오 서판
  if (run.relics.includes('meteorTablet') && b.turn % 3 === 0) {
    emit({ type: 'meteor' })
    for (const e of aliveEnemies(run)) dealDamage(run, e, 12, '#ff8030', { raw: true })
  }
  // 변이: 뇌우
  if (run.mods.storm) {
    const t = pick(aliveEnemies(run))
    if (t) {
      emit({ type: 'storm', to: t.uid })
      dealDamage(run, t, run.mods.storm, '#c8e8ff', { raw: true })
      if (!t.dead) t.shock += 1
    }
  }
  fixTarget(run)
  checkWin(run)
}

function fixTarget(run) {
  const b = run.battle
  if (!b) return
  const alive = aliveEnemies(run)
  if (!alive.find((e) => e.uid === b.target)) b.target = alive[0]?.uid ?? 0
}

export function setTarget(run, euid) {
  const e = run.battle?.enemies.find((x) => x.uid === euid && !x.dead)
  if (e) run.battle.target = euid
}

/** 플레이어가 적에게 주는 피해 계산 */
function playerDamage(run, base, target, extra = 0) {
  const b = run.battle
  let d = base + b.player.str + extra
  d *= run.mods.dmg * (1 + (run.upgrades.might || 0) * 0.05)
  if (b.player.freeze > 0) d *= 0.75
  if (target.shock > 0) d *= 1.25
  return Math.max(0, Math.floor(d))
}

function dealDamage(run, e, amount, color, opts = {}) {
  if (!e || e.dead) return 0
  let dmg = amount
  if (!opts.raw && opts.calc !== false) dmg = amount
  const absorbed = Math.min(e.block, dmg)
  e.block -= absorbed
  const hpLoss = dmg - absorbed
  e.hp -= hpLoss
  emit({ type: 'hit', to: e.uid, amount: dmg, blocked: absorbed, color, crit: dmg >= 20, ignoreBlock: false })
  if (run.relics.includes('voidMaw') && !e.isBoss && e.hp > 0 && e.hp <= e.maxHp * 0.15) {
    e.hp = 0
    emit({ type: 'execute', to: e.uid })
  }
  if (e.hp <= 0) killEnemy(run, e)
  return hpLoss
}

function killEnemy(run, e) {
  if (e.dead) return
  e.dead = true
  e.hp = 0
  run.stats.kills++
  emit({ type: 'kill', to: e.uid, boss: e.isBoss, color: e.color })
  if (run.mods.lifesteal) healPlayer(run, run.mods.lifesteal)
  // 변이: 분열
  if (!e.isBoss && !e.mini && run.mods.split && Math.random() < run.mods.split && run.battle.enemies.filter((x) => !x.dead).length < 4) {
    const m = makeEnemy(run, e.key === 'boss' ? 'caterpillar' : e.key, run.pos?.row || 0, { mini: true, hpMul: 0.45, scale: 0.7 })
    m.name = '작은 ' + ENEMIES[e.key].name
    setIntent(run, m)
    run.battle.enemies.push(m)
    emit({ type: 'spawn', to: m.uid })
  }
}

function hurtPlayer(run, amount, color, ignoreBlock = false) {
  const p = run.battle.player
  let dmg = Math.max(0, Math.floor(amount))
  let absorbed = 0
  if (!ignoreBlock) {
    absorbed = Math.min(p.block, dmg)
    p.block -= absorbed
  }
  const loss = dmg - absorbed
  run.hp -= loss
  emit({ type: 'playerHit', amount: dmg, blocked: absorbed, color })
  if (run.hp <= 0) {
    if (run.revives > 0) {
      run.revives--
      run.hp = Math.ceil(run.maxHp * 0.5)
      emit({ type: 'revive' })
    } else {
      run.hp = 0
      endRun(run, false)
    }
  }
  return loss
}

function healPlayer(run, n) {
  const before = run.hp
  run.hp = Math.min(run.maxHp, run.hp + n)
  if (run.hp > before) emit({ type: 'heal', amount: run.hp - before })
}

// ─────────────────────────────────────────────────────────────
// 카드 사용
// ─────────────────────────────────────────────────────────────
export function canPlay(run, idx) {
  const b = run.battle
  if (!b || b.phase !== 'player' || b.busy) return false
  const inst = b.hand[idx]
  if (!inst) return false
  return cardDef(inst).cost <= b.energy
}

export function playCard(run, idx) {
  if (!canPlay(run, idx)) return false
  const b = run.battle
  const inst = b.hand[idx]
  const def = cardDef(inst)
  b.energy -= def.cost
  b.hand.splice(idx, 1)

  // 속성 체인: 같은 속성을 연달아 쓰면 피해·방어 +2씩 누적
  if (def.type !== 'fusion') {
    b.chain = def.type === b.chainType ? b.chain + 1 : 1
    b.chainType = def.type
  }
  const bonus = def.type === 'fusion' ? 0 : (b.chain - 1) * 2
  emit({ type: 'cast', card: def, chain: b.chain, chainType: b.chainType })

  let times = 1
  if (run.mods.echo && b.cardsThisTurn === 0) times++
  if (def.kind === 'attack' && !b.firstAttackDone && run.relics.includes('twinRing')) times++
  if (def.kind === 'attack') b.firstAttackDone = true
  b.cardsThisTurn++

  for (let t = 0; t < times && run.screen === 'battle'; t++) {
    applyFx(run, def, bonus, t > 0)
    if (aliveEnemies(run).length === 0) break
  }

  if (def.kind === 'attack' && run.relics.includes('mjolnirShard') && Math.random() < 0.3) {
    const e = pick(aliveEnemies(run))
    if (e) { emit({ type: 'zap', to: e.uid }); dealDamage(run, e, 5, '#58c8ff', { raw: true }) }
  }

  const fx = cardFx(def)
  if (def.kind === 'power') { /* 파워는 사용 후 사라짐(효과는 지속) */ }
  else if (fx.exhaust || inst.fusion) b.exhaust.push(inst)
  else b.discard.push(inst)

  fixTarget(run)
  checkWin(run)
  return true
}

function applyFx(run, def, bonus, isEcho) {
  const b = run.battle
  const p = b.player
  const fx = cardFx(def)
  const color = def.color || (def.type && { grass: '#48d858', fire: '#f85830', water: '#48b8f8', electric: '#f8d830', psychic: '#d878f8', dragon: '#7888ff' }[def.type]) || '#ffffff'
  const alive = () => aliveEnemies(run)
  const main = () => alive().find((e) => e.uid === b.target) || alive()[0]
  const targets = () => (fx.aoe ? alive() : main() ? [main()] : [])

  if (fx.dmg || fx.dmgPerHand) {
    const hits = fx.hits || 1
    for (let h = 0; h < hits; h++) {
      const list = fx.rnd ? (alive().length ? [pick(alive())] : []) : targets()
      if (!list.length) break
      emit({ type: 'attack', kind: fx.aoe ? 'aoe' : fx.rnd ? 'rnd' : 'single', to: list.map((e) => e.uid), color, card: def.id, echo: isEcho })
      for (const e of list) {
        let base = fx.dmgPerHand ? fx.dmgPerHand * b.hand.length : fx.dmg
        let d = playerDamage(run, base, e, bonus)
        if (fx.burnX2 && e.burn > 0) d *= 2
        if (fx.shockX2 && e.shock > 0) d *= 2
        dealDamage(run, e, d, color)
      }
    }
    if (fx.chain) {
      const first = main()
      for (const e of alive()) {
        if (first && e.uid === first.uid) continue
        emit({ type: 'chain', to: e.uid })
        dealDamage(run, e, playerDamage(run, fx.chain, e), '#f8e858')
      }
    }
  }

  // 대상에게 거는 상태이상
  const statusTargets = fx.aoe ? alive() : main() ? [main()] : []
  for (const e of statusTargets) {
    if (e.dead) continue
    if (fx.poison) { e.poison += fx.poison; emit({ type: 'status', to: e.uid, s: 'poison' }) }
    if (fx.burn) { e.burn += fx.burn; emit({ type: 'status', to: e.uid, s: 'burn' }) }
    if (fx.freeze) { e.freeze += fx.freeze; emit({ type: 'status', to: e.uid, s: 'freeze' }); setIntent(run, e) }
    if (fx.shock) { e.shock += fx.shock; emit({ type: 'status', to: e.uid, s: 'shock' }) }
  }

  if (fx.block || fx.blockPerStr) {
    const amt = (fx.block || 0) + bonus + (fx.blockPerStr ? fx.blockPerStr * p.str : 0)
    p.block += amt
    emit({ type: 'block', amount: amt })
  }
  if (fx.heal) healPlayer(run, fx.heal)
  if (fx.str) { p.str += fx.str; emit({ type: 'buff', s: 'str' }) }
  if (fx.thorns) { p.thorns += fx.thorns; emit({ type: 'buff', s: 'thorns' }) }
  if (fx.drawPerTurn) { p.drawPerTurn += fx.drawPerTurn; emit({ type: 'buff', s: 'draw' }) }
  if (fx.energy) { b.energy += fx.energy; emit({ type: 'energy' }) }
  if (fx.draw) drawCards(run, fx.draw)
}

// ─────────────────────────────────────────────────────────────
// 조합: 손패의 두 속성 카드를 합쳐 조합 카드 만들기
// ─────────────────────────────────────────────────────────────
export function availableFusions(run) {
  const b = run.battle
  if (!b || b.phase !== 'player') return []
  const types = new Set(b.hand.map((c) => (c.fusion ? null : cardDef(c).type)))
  return Object.entries(FUSION_CARDS)
    .filter(([, f]) => f.req.every((t) => types.has(t)))
    .map(([id, f]) => ({ id, ...f }))
}

export function fuse(run, fusionId) {
  const b = run.battle
  const f = FUSION_CARDS[fusionId]
  if (!b || !f || b.phase !== 'player') return false
  const used = []
  for (const t of f.req) {
    const i = b.hand.findIndex((c) => !c.fusion && cardDef(c).type === t && !used.includes(c))
    if (i < 0) return false
    used.push(b.hand[i])
  }
  const costs = used.map((c) => cardDef(c).cost)
  for (const c of used) {
    b.hand.splice(b.hand.indexOf(c), 1)
    b.exhaust.push(c)
  }
  const cost = Math.max(0, Math.max(...costs) - run.mods.fusionDiscount)
  b.hand.push({ uid: uid(), fusion: fusionId, cost })
  emit({ type: 'fusion', name: f.name, color: f.color })
  return true
}

// ─────────────────────────────────────────────────────────────
// 적 턴 (화면이 한 마리씩 시간차를 두고 호출)
// ─────────────────────────────────────────────────────────────
export function endPlayerTurn(run) {
  const b = run.battle
  if (!b || b.phase !== 'player') return
  b.discard.push(...b.hand)
  b.hand = []
  const p = b.player
  if (p.freeze > 0) p.freeze--
  if (p.shock > 0) p.shock--
  b.phase = 'enemy'
  emit({ type: 'turn', who: 'enemy' })
}

export function enemyAct(run, i) {
  const b = run.battle
  if (!b || run.screen !== 'battle') return
  const e = b.enemies[i]
  if (!e || e.dead) return
  e.block = 0
  if (e.poison > 0) { dealDamage(run, e, e.poison, '#68e858', { raw: true }); e.poison-- }
  if (e.dead) return checkWin(run)
  if (e.burn > 0) { dealDamage(run, e, e.burn, '#ff7030', { raw: true }); e.burn-- }
  if (e.dead) return checkWin(run)

  const m = e.moves[e.moveIdx % e.moves.length]
  const p = b.player
  if (m.a) {
    emit({ type: 'enemyAttack', from: e.uid, n: m.n || 1, boss: e.isBoss })
    for (let k = 0; k < (m.n || 1); k++) {
      let d = (m.a + e.str + run.mods.enemyAtk) * (e.freeze > 0 ? 0.75 : 1) * (p.shock > 0 ? 1.25 : 1)
      hurtPlayer(run, d, '#ff4040')
      if (run.screen !== 'battle') return
      if (p.thorns > 0) { emit({ type: 'thorns', to: e.uid }); dealDamage(run, e, p.thorns, '#78d858', { raw: true }); if (e.dead) break }
    }
  }
  if (!e.dead) {
    if (m.b) { e.block += m.b; emit({ type: 'enemyBlock', from: e.uid, amount: m.b }) }
    if (m.s) { e.str += m.s; emit({ type: 'enemyBuff', from: e.uid }) }
    if (m.heal) { e.hp = Math.min(e.maxHp, e.hp + m.heal); emit({ type: 'enemyHeal', from: e.uid, amount: m.heal }) }
    for (const s of ['poison', 'burn', 'freeze', 'shock']) {
      if (m[s]) { p[s] += m[s]; emit({ type: 'playerStatus', s, from: e.uid }) }
    }
    if (e.freeze > 0) e.freeze--
    if (e.shock > 0) e.shock--
    e.moveIdx++
    setIntent(run, e)
  }
  checkWin(run)
}

export function enemyTurnDone(run) {
  if (run.screen !== 'battle' || !run.battle || run.battle.phase === 'won') return
  startPlayerTurn(run)
}

function checkWin(run) {
  const b = run.battle
  if (!b || b.phase === 'won' || run.screen !== 'battle') return
  if (aliveEnemies(run).length > 0) return
  b.phase = 'won'
  emit({ type: 'victory', boss: b.type === 'boss' })
  if (run.relics.includes('worldTreeCore')) healPlayer(run, 5)
  if (b.type === 'elite') run.stats.elites++
  if (b.type === 'boss') run.stats.bosses++
  const gm = run.mods.gold * (1 + (run.upgrades.magnet || 0) * 0.1)
  const gold = Math.round((b.type === 'boss' ? rand(90, 120) : b.type === 'elite' ? rand(30, 45) : rand(12, 22)) * gm)
  run.reward = {
    gold,
    cards: cardChoices(run, run.mods.rewardCount, b.type),
    relics: b.type === 'boss' ? relicChoices(run, 3) : b.type === 'elite' ? relicChoices(run, run.mods.eliteBonus ? 2 : 1) : null,
    from: b.type
  }
}

/** 전투 승리 연출이 끝난 뒤 화면이 호출 */
export function toReward(run) {
  run.battle = null
  run.screen = 'reward'
}

// ─────────────────────────────────────────────────────────────
// 보상·유물·상점·휴식·이벤트
// ─────────────────────────────────────────────────────────────
export function cardChoices(run, n, from = 'battle') {
  const luck = (run.upgrades.luck || 0) * 0.03
  const rareP = (from === 'boss' ? 0.5 : from === 'elite' ? 0.15 : 0.05) + luck
  const uncP = from === 'boss' ? 0.4 : 0.3
  const pool = Object.values(CARDS).filter((c) => c.rarity !== 'starter')
  const picks = []
  let guard = 0
  while (picks.length < n && guard++ < 100) {
    const r = Math.random()
    const rarity = r < rareP ? 'rare' : r < rareP + uncP ? 'uncommon' : 'common'
    const c = pick(pool.filter((x) => x.rarity === rarity))
    if (c && !picks.includes(c.id)) picks.push(c.id)
  }
  return picks.map((id) => newCard(id, Math.random() < 0.08 * run.act))
}

export function relicChoices(run, n) {
  const pool = shuffle(Object.keys(CARD_RELICS).filter((id) => !run.relics.includes(id)))
  return pool.slice(0, n)
}

export function takeGold(run) {
  if (!run.reward || !run.reward.gold) return
  run.gold += run.reward.gold
  emit({ type: 'gold', amount: run.reward.gold })
  run.reward.gold = 0
}

export function takeCard(run, inst) {
  if (!run.reward) return
  run.deck.push({ ...inst, uid: uid() })
  run.reward.cards = null
  emit({ type: 'cardGet' })
}

export function rerollCards(run) {
  if (!run.reward?.cards || run.rerolls <= 0) return
  run.rerolls--
  run.reward.cards = cardChoices(run, run.mods.rewardCount, run.reward.from)
}

export function takeRelic(run, id) {
  if (!run.reward) return
  addRelic(run, id)
  run.reward.relics = null
}

function addRelic(run, id) {
  if (!id || run.relics.includes(id)) return
  run.relics.push(id)
  if (id === 'worldTreeCore') { run.maxHp += 12; run.hp += 12 }
  emit({ type: 'relic', id })
}

export function leaveReward(run) {
  takeGold(run)
  const wasBoss = run.reward?.from === 'boss'
  run.reward = null
  if (wasBoss) nextAct(run)
  else run.screen = 'map'
}

function nextAct(run) {
  run.act++
  run.pos = null
  run.map = genMap(run)
  healPlayer(run, Math.round(run.maxHp * 0.3))
  run.screen = 'map'
  emit({ type: 'newAct', act: run.act })
}

export function restHeal(run) {
  const n = Math.round(run.maxHp * 0.3 * run.mods.restHeal)
  healPlayer(run, n)
  run.rest.done = 'heal'
}

export function restUpgrade(run, inst) {
  const c = run.deck.find((x) => x.uid === inst.uid)
  if (c && !c.upgraded && CARDS[c.id]?.up) { c.upgraded = true; run.rest.done = 'upgrade'; emit({ type: 'upgrade' }) }
}

function openShop(run) {
  const price = { common: 45, uncommon: 72, rare: 125 }
  const cards = cardChoices(run, 5, 'shop').map((c) => ({ card: c, price: Math.round(price[CARDS[c.id].rarity] * (0.9 + Math.random() * 0.2)), sold: false }))
  const relics = relicChoices(run, 2).map((id) => ({ id, price: rand(130, 170), sold: false }))
  run.shop = { cards, relics, removePrice: 60 + (run.shopRemoveUsed ? 25 : 0), removed: false }
  run.screen = 'shop'
}

export function buyCard(run, i) {
  const item = run.shop?.cards[i]
  if (!item || item.sold || run.gold < item.price) return false
  run.gold -= item.price
  item.sold = true
  run.deck.push({ ...item.card, uid: uid() })
  emit({ type: 'buy' })
  return true
}

export function buyRelic(run, i) {
  const item = run.shop?.relics[i]
  if (!item || item.sold || run.gold < item.price) return false
  run.gold -= item.price
  item.sold = true
  addRelic(run, item.id)
  return true
}

export function removeCard(run, inst) {
  if (!run.shop || run.shop.removed || run.gold < run.shop.removePrice || run.deck.length <= 5) return false
  const i = run.deck.findIndex((c) => c.uid === inst.uid)
  if (i < 0) return false
  run.gold -= run.shop.removePrice
  run.deck.splice(i, 1)
  run.shop.removed = true
  run.shopRemoveUsed = true
  emit({ type: 'remove' })
  return true
}

export function chooseEvent(run, opt) {
  const a = opt.act || {}
  const lines = []
  if (a.heal) { healPlayer(run, a.heal); lines.push('HP ' + a.heal + ' 회복') }
  if (a.gold) { run.gold += a.gold; lines.push('골드 +' + a.gold) }
  if (a.hp) { run.hp = Math.max(1, run.hp + a.hp); emit({ type: 'playerHitOut', amount: -a.hp }); lines.push('HP ' + a.hp) }
  if (a.maxHp) { run.maxHp += a.maxHp; run.hp += a.maxHp; lines.push('최대 HP +' + a.maxHp) }
  if (a.relic) { const r = relicChoices(run, 1)[0]; if (r) { addRelic(run, r); lines.push(CARD_RELICS[r].icon + ' ' + CARD_RELICS[r].name + ' 획득') } }
  if (a.upgrade) {
    const cands = shuffle(run.deck.filter((c) => !c.upgraded && CARDS[c.id]?.up)).slice(0, a.upgrade)
    for (const c of cands) c.upgraded = true
    if (cands.length) lines.push(cands.map((c) => CARDS[c.id].name).join(', ') + ' 강화')
  }
  if (a.removeStarter) {
    const i = run.deck.findIndex((c) => CARDS[c.id]?.rarity === 'starter')
    if (i >= 0) { lines.push(CARDS[run.deck[i].id].name + ' 제거'); run.deck.splice(i, 1) }
  }
  run.event.result = lines.length ? lines.join(' · ') : '아무 일도 일어나지 않았다.'
}

export function leaveEvent(run) { run.event = null; run.screen = 'map' }
export function leaveRest(run) { run.rest = null; run.screen = 'map' }
export function leaveShop(run) { run.shop = null; run.screen = 'map' }

// ─────────────────────────────────────────────────────────────
// 런 종료
// ─────────────────────────────────────────────────────────────
function endRun(run, won) {
  run.screen = 'over'
  if (run.battle) run.battle.phase = 'lost'
  const s = run.stats
  const time = Math.round((Date.now() - s.startedAt) / 1000)
  const score = run.totalFloors * 100 + s.kills * 12 + s.elites * 150 + s.bosses * 700 + Math.round(run.gold / 2)
  const essence = Math.floor((run.totalFloors * 2 + s.kills + s.elites * 8 + s.bosses * 30) * (1 + (run.upgrades.wisdom || 0) * 0.06))
  run.result = { won, score, essence, time, floors: run.totalFloors, act: run.act, kills: s.kills, elites: s.elites, bosses: s.bosses }
  emit({ type: 'runOver', won })
}

export function abandon(run) { endRun(run, false) }
