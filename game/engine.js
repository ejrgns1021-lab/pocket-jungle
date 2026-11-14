// 게임 엔진 — 원본 단일 HTML의 로직을 그대로 옮기고, 화면 UI(HUD·선택창·게임오버)는
// Vue 컴포넌트가 그리도록 콜백(ui.onHud 등)으로 분리했다.
import { buildAtlas } from './sprites.js'
import { SoundFX, vibrate } from './sound.js'
import {
  TYPES, SKILLS_60, MAX_SKILL_SLOTS, PASSIVES, FUSIONS, RELICS, BOSS_TEMPLATES, ENEMY_TABLE
} from './data.js'
import { combineMutators } from './mutators.js'
import { drawGlow, jaggedPoints, strokePts, easeOutBack, easeOutCubic, RAINBOW } from './fx.js'

const CHUNK_SIZE = 128
const GRID_CELL = 48

export function createGame(canvas, ui) {
  const ctx = canvas.getContext('2d')
  const ATLAS = buildAtlas()
  const isMobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 760
  const MAX_ENEMIES = isMobile ? 300 : 420
  const MAX_PARTICLES = isMobile ? 110 : 180

  let width = 0
  let height = 0
  let dpr = 1

  function handleResize() {
    width = window.innerWidth
    height = window.innerHeight
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.imageSmoothingEnabled = false
  }
  window.addEventListener('resize', handleResize)
  handleResize()

  // ---------------------------------------------------------------------------
  // 숲 타일맵 (청크 단위로 생성해 캐시)
  // ---------------------------------------------------------------------------
  const chunkCache = new Map()
  const chunkPropsCache = new Map()
  let worldSalt = 0

  function chunkHash(cx, cy, n) {
    return Math.abs(Math.sin(cx * 127.1 + cy * 311.7 + n * 74.7 + worldSalt) * 43758.5453) % 1
  }

  function getForestChunk(cx, cy) {
    const key = cx + ',' + cy
    if (chunkCache.has(key)) return chunkCache.get(key)
    if (chunkCache.size > 96) chunkCache.delete(chunkCache.keys().next().value)
    const c = document.createElement('canvas')
    c.width = CHUNK_SIZE
    c.height = CHUNK_SIZE
    const g = c.getContext('2d')
    g.imageSmoothingEnabled = false
    g.fillStyle = '#489848'
    g.fillRect(0, 0, CHUNK_SIZE, CHUNK_SIZE)
    for (let ty = 0; ty < 8; ty++) {
      for (let tx = 0; tx < 8; tx++) {
        const h = chunkHash(cx, cy, ty * 8 + tx)
        const px = tx * 16
        const py = ty * 16
        if (h < 0.34) {
          g.fillStyle = '#307838'
          g.fillRect(px + 4, py + 8, 2, 4)
          g.fillRect(px + 9, py + 6, 2, 6)
          g.fillStyle = '#68c060'
          g.fillRect(px + 6, py + 7, 2, 3)
        } else if (h > 0.89) {
          g.fillStyle = '#286830'
          g.fillRect(px + 6, py + 9, 4, 3)
          g.fillStyle = h > 0.945 ? '#f8d838' : '#f85848'
          g.fillRect(px + 6, py + 6, 4, 4)
          g.fillStyle = '#ffffff'
          g.fillRect(px + 7, py + 7, 2, 2)
        }
      }
    }
    if (chunkHash(cx, cy, 99) < 0.16) {
      g.fillStyle = '#b89050'; g.fillRect(26, 30, 76, 68)
      g.fillStyle = '#d0b070'; g.fillRect(30, 34, 68, 60)
      g.fillStyle = '#788880'; g.fillRect(42, 46, 18, 12); g.fillRect(68, 66, 18, 12)
      g.fillStyle = '#389848'; g.fillRect(44, 46, 8, 4); g.fillRect(72, 66, 8, 4)
    }
    chunkCache.set(key, c)
    return c
  }

  function getChunkProps(cx, cy) {
    const key = cx + ',' + cy
    if (chunkPropsCache.has(key)) return chunkPropsCache.get(key)
    if (chunkPropsCache.size > 96) chunkPropsCache.delete(chunkPropsCache.keys().next().value)
    const list = []
    if (!(Math.abs(cx) <= 1 && Math.abs(cy) <= 1)) {
      const h1 = chunkHash(cx, cy, 201)
      const wx = cx * CHUNK_SIZE + 24 + Math.floor(chunkHash(cx, cy, 202) * 80)
      const wy = cy * CHUNK_SIZE + 24 + Math.floor(chunkHash(cx, cy, 203) * 80)
      if (h1 < 0.34) list.push({ kind: 'tree', x: wx, y: wy, sortY: wy + 12 })
      else if (h1 < 0.54) list.push({ kind: 'stump', x: wx, y: wy, sortY: wy + 6 })
      else if (h1 < 0.72) list.push({ kind: 'stone', x: wx, y: wy, sortY: wy + 6 })
    }
    chunkPropsCache.set(key, list)
    return list
  }

  // ---------------------------------------------------------------------------
  // 공간 해시 (몬스터 수백 마리에서도 60fps)
  // ---------------------------------------------------------------------------
  const spatialGrid = new Map()
  const tempNearby = []

  function buildSpatialGrid() {
    spatialGrid.clear()
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]
      if (e.hp <= 0) continue
      const key = Math.floor(e.x / GRID_CELL) + ',' + Math.floor(e.y / GRID_CELL)
      let bucket = spatialGrid.get(key)
      if (!bucket) { bucket = []; spatialGrid.set(key, bucket) }
      bucket.push(e)
    }
  }

  function queryNearbyEnemies(x, y, radius, out) {
    out.length = 0
    const c0 = Math.floor((x - radius) / GRID_CELL)
    const c1 = Math.floor((x + radius) / GRID_CELL)
    const r0 = Math.floor((y - radius) / GRID_CELL)
    const r1 = Math.floor((y + radius) / GRID_CELL)
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const bucket = spatialGrid.get(c + ',' + r)
        if (bucket) for (let i = 0; i < bucket.length; i++) out.push(bucket[i])
      }
    }
    return out
  }

  // ---------------------------------------------------------------------------
  // 상태
  // ---------------------------------------------------------------------------
  const getXpNeeded = (level) => Math.floor(20 * Math.pow(1.16, Math.max(0, level - 1)))

  let gameState = 'MENU' // MENU | PLAYING | MODAL | PAUSED | GAMEOVER
  let pausedFrom = 'PLAYING'
  let monsterMult = 1
  let peakMonsterMult = 1
  let gameTime = 0
  let kills = 0
  let bossCount = 0
  let bossKills = 0
  let autoLevelCount = 0
  let modalQueue = []
  let currentChoice = null
  let hitstopTimer = 0
  let shakeTimer = 0
  let shakeAmount = 0
  let spawnTimer = 0
  let hudTimer = 0
  let stormTimer = 5
  let chestTimer = 0
  let rerollsLeft = 0
  let revivesLeft = 0
  let mods = combineMutators([])
  let cfg = { mutators: [], bossTitle: '', night: false, spiritStage: 0, upgrades: {} }
  let spiritPowMult = 1
  let echoQueue = []

  // ── 이펙트 상태 ──
  let fxLevel = isMobile ? 2 : 2 // 2 = 화려, 1 = 가볍게 (프레임이 떨어지면 자동으로 1)
  let fxAuto = true
  let dmgTexts = []      // 데미지 숫자
  let floatTexts = []    // LEVEL UP! 같은 큰 글씨
  let flashes = []       // 화면 전체 번쩍임
  let decals = []        // 바닥 그을림 자국
  let pillars = []       // 레벨업 빛기둥
  let ambient = []       // 화면 공간 반딧불/낙엽
  let combo = 0
  let comboTimer = 0
  let comboPop = 0
  let bestCombo = 0
  let bossIntro = null   // 보스 등장 레터박스 연출
  let slowmo = { f: 1, t: 0 }
  let camZoom = 1
  let sparkBudget = 0
  let fpsAcc = 0
  let fpsFrames = 0
  let lowFpsStreak = 0
  let simSpeed = 1

  const keys = {}
  const stick = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0, maxR: 56 }

  const player = { relics: {} }
  let enemies = []
  let projectiles = []
  let orbitShields = []
  let zones = []
  let blackHoles = []
  let meteors = []
  let beams = []
  let shockwaves = []
  let xpGems = []
  let chests = []
  let particles = []

  function resetPlayer() {
    Object.assign(player, {
      x: 0, y: 0, spiritX: -22, spiritY: 14, spiritTimer: 0.85, radius: 13,
      speed: 230, hp: 120, maxHp: 120, regen: 1.0, dmgTakenMult: 1.0,
      xp: 0, level: 1, xpMult: 1.0, magnetRange: 118, invuln: 0.5,
      facingLeft: false, facingAngle: 0, walkAnim: 0,
      projMult: 1, cdMult: 1.0, dmgMult: 1.0, areaMult: 1.0,
      critChance: 0.14, critMult: 2.0, bonusPierce: 0,
      shellBellRank: 0, shellBellCounter: 0, dragonBladeAngle: 0,
      activeSkills: [], activeFusions: [], activePassives: [], ownedRelics: [],
      relics: {}, meteorTimer: 0.8, blackHoleTimer: 1.2, seedPulseTimer: 2.0
    })
  }
  resetPlayer()

  const banner = (msg) => ui.onBanner && ui.onBanner(msg)

  // ---------------------------------------------------------------------------
  // 선택창 큐 (레벨업이 연달아 일어나도 하나씩)
  // ---------------------------------------------------------------------------
  function pushModal(entry) {
    modalQueue.push(entry)
    if (gameState === 'PLAYING') flushModalQueue()
  }

  function flushModalQueue() {
    if (gameState !== 'PLAYING' || modalQueue.length === 0) return
    const item = modalQueue.shift()
    if (item.type === 'levelup') showSkillChoice(item)
    else if (item.type === 'relic') showRelicChoice()
  }

  function closeChoiceAndResume() {
    currentChoice = null
    ui.onChoice && ui.onChoice(null)
    gameState = 'PLAYING'
    emitHud(true)
    flushModalQueue()
  }

  // ---------------------------------------------------------------------------
  // 스킬 인벤토리
  // ---------------------------------------------------------------------------
  const totalSlots = () => player.activeSkills.length + player.activeFusions.length + player.activePassives.length

  function addBaseSkill(def) {
    const found = player.activeSkills.find((s) => s.skill.id === def.id)
    if (found) found.level++
    else if (totalSlots() < MAX_SKILL_SLOTS) player.activeSkills.push({ skill: def, level: 1, timer: 0.05 })
    rebuildOrbitShields()
    emitDock()
  }

  function addPassive(def) {
    const found = player.activePassives.find((p) => p.passive.id === def.id)
    if (found) { found.level++; def.applyRank(player, api) }
    else if (totalSlots() < MAX_SKILL_SLOTS) { player.activePassives.push({ passive: def, level: 1 }); def.applyRank(player, api) }
    emitDock()
  }

  function addFusion(def) {
    let sum = 0
    let consumed = 0
    def.reqTypes.forEach((t) => {
      let bi = -1
      let bl = -1
      player.activeSkills.forEach((s, i) => { if (s.skill.type === t && s.level > bl) { bl = s.level; bi = i } })
      if (bi !== -1) { sum += player.activeSkills[bi].level; player.activeSkills.splice(bi, 1); consumed++ }
    })
    const inherited = Math.max(1, sum - Math.max(0, consumed - 1))
    const found = player.activeFusions.find((f) => f.fusion.id === def.id)
    if (found) found.level += inherited
    else player.activeFusions.push({ fusion: def, level: inherited, timer: 0.05 })
    rebuildOrbitShields()
    emitDock()
    banner('✨ 조합 진화! 빈 슬롯 확보 (' + totalSlots() + '/' + MAX_SKILL_SLOTS + ')')
  }

  function rebuildOrbitShields() {
    orbitShields = []
    player.activeSkills.forEach((entry, idx) => {
      if (entry.skill.pattern !== 'orbit') return
      const count = Math.min(12, (entry.skill.countBase + Math.floor(entry.level / 2)) * player.projMult)
      const orbitR = (60 + idx * 8 + entry.level * 3) * player.areaMult
      for (let i = 0; i < count; i++) {
        orbitShields.push({ entry, angle: (i / count) * Math.PI * 2, orbitR, bladeR: 11 * player.areaMult, hitMap: new WeakMap() })
      }
    })
  }

  // ---------------------------------------------------------------------------
  // 전투
  // ---------------------------------------------------------------------------
  // kind: 'pixel'(기본 빛 조각) | 'spark'(빛줄기) | 'debris'(튀어 떨어지는 파편) | 'ember'(위로 오르는 불씨)
  function spawnParticles(x, y, color, count, maxSpd, kind = 'pixel') {
    const cap = fxLevel === 2 ? MAX_PARTICLES * 2 : MAX_PARTICLES
    const n = fxLevel === 2 ? count : Math.ceil(count / 2)
    for (let i = 0; i < n; i++) {
      if (particles.length >= cap) particles.shift()
      const a = Math.random() * Math.PI * 2
      const sp = 24 + Math.random() * (maxSpd || 130)
      const life = kind === 'ember' ? 0.6 + Math.random() * 0.5 : kind === 'debris' ? 0.45 + Math.random() * 0.3 : 0.22 + Math.random() * 0.25
      particles.push({
        x, y, kind, color,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'debris' ? 90 : 0),
        g: kind === 'debris' ? 520 : kind === 'ember' ? -60 : 0,
        size: kind === 'debris' ? 3 + Math.floor(Math.random() * 3) : Math.random() < 0.5 ? 3 : 4,
        life, maxLife: life
      })
    }
  }

  function addRing(x, y, color, maxR, life = 0.35, width = 3, fill = false) {
    shockwaves.push({ x, y, radius: Math.min(12, maxR * 0.1), maxRadius: maxR, color, life, maxLife: life, width, fill })
  }

  function flash(color, alpha, decay = 3) {
    if (fxLevel < 2) alpha *= 0.6
    flashes.push({ color, a: alpha, decay })
  }

  function slow(f, t) {
    if (t > slowmo.t || f < slowmo.f) slowmo = { f, t }
  }

  function zoomPunch(z) { camZoom = Math.max(camZoom, z) }

  function addDecal(x, y, r, color = '#201810') {
    if (decals.length > 24) decals.shift()
    decals.push({ x, y, r, color, life: 4, maxLife: 4 })
  }

  function floatText(text, x, y, color, size = 22, life = 1.1) {
    floatTexts.push({ text, x, y, color, size, life, maxLife: life })
  }

  function dmgNumber(e, dmg, crit, color) {
    if (!fxLevel) return
    const cap = fxLevel === 2 ? 60 : 22
    if (!crit && dmgTexts.length > cap * 0.7 && Math.random() < 0.6) return
    if (dmgTexts.length >= cap) dmgTexts.shift()
    dmgTexts.push({
      x: e.x + (Math.random() - 0.5) * 14, y: e.y - e.radius,
      vx: (Math.random() - 0.5) * 40, vy: -70 - Math.random() * 30,
      v: Math.round(dmg), crit, color: crit ? '#ffe040' : color === '#ffffff' ? '#ffffff' : '#ffffff',
      life: crit ? 0.9 : 0.6, maxLife: crit ? 0.9 : 0.6
    })
  }

  function resetFx() {
    dmgTexts = []; floatTexts = []; flashes = []; decals = []; pillars = []
    combo = 0; comboTimer = 0; comboPop = 0; bestCombo = 0
    bossIntro = null; slowmo = { f: 1, t: 0 }; camZoom = 1
    initAmbient()
  }

  function initAmbient() {
    ambient = []
    const n = fxLevel === 2 ? (isMobile ? 18 : 30) : 0
    for (let i = 0; i < n; i++) {
      ambient.push({ x: Math.random() * width, y: Math.random() * height, ph: Math.random() * 6.28, sp: 10 + Math.random() * 25, s: 2 + Math.random() * 3 })
    }
  }

  function getNearestEnemy(x, y, maxRange) {
    let best = null
    let bestD2 = (maxRange || 650) ** 2
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]
      if (e.hp <= 0) continue
      const d2 = (e.x - x) ** 2 + (e.y - y) ** 2
      if (d2 < bestD2) { bestD2 = d2; best = e }
    }
    return best
  }

  function getRandomEnemyNear(x, y, maxRange) {
    const r2 = (maxRange || 480) ** 2
    const pool = []
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]
      if (e.hp > 0 && (e.x - x) ** 2 + (e.y - y) ** 2 <= r2) pool.push(e)
    }
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null
  }

  function triggerLightningChain(sx, sy, first, dmg, jumps, color) {
    const visited = new Set()
    let px = sx
    let py = sy
    let curr = first
    for (let step = 0; step < jumps; step++) {
      if (!curr) {
        let best = null
        let bestD2 = 235 * 235
        queryNearbyEnemies(px, py, 235, tempNearby)
        for (const cand of tempNearby) {
          if (cand.hp <= 0 || visited.has(cand)) continue
          const d2 = (cand.x - px) ** 2 + (cand.y - py) ** 2
          if (d2 < bestD2) { bestD2 = d2; best = cand }
        }
        curr = best
      }
      if (!curr) break
      visited.add(curr)
      beams.push({ x1: px, y1: py, x2: curr.x, y2: curr.y, color: color || '#f8d830', width: 3, isLaser: false, life: 0.18, maxLife: 0.18 })
      if (fxLevel === 2) spawnParticles(curr.x, curr.y, color || '#f8d830', 2, 160, 'spark')
      px = curr.x
      py = curr.y
      hitEnemy(curr, dmg, color || '#f8d830', false)
      curr = null
    }
  }

  function hitEnemy(enemy, baseDmg, color, allowMjolnir) {
    if (!enemy || enemy.hp <= 0) return
    const isCrit = Math.random() < player.critChance
    const dmg = baseDmg * player.dmgMult * (isCrit ? player.critMult : 1)
    enemy.hp -= dmg
    enemy.hitFlash = 0.065
    dmgNumber(enemy, dmg, isCrit, color)
    if (sparkBudget > 0) {
      sparkBudget -= 1
      spawnParticles(enemy.x, enemy.y, color || '#ffffff', isCrit ? 4 : 2, isCrit ? 260 : 180, 'spark')
    }
    if (isCrit && enemy.isBoss) zoomPunch(1.012)
    if (player.relics.voidMaw && !enemy.isBoss && enemy.hp > 0 && enemy.hp <= enemy.maxHp * 0.2) {
      enemy.hp = 0
      spawnParticles(enemy.x, enemy.y, '#c068e8', 6, 110)
    }
    SoundFX.play('hit')
    if (allowMjolnir !== false && player.relics.mjolnirShard && Math.random() < 0.45) {
      triggerLightningChain(enemy.x, enemy.y, null, dmg * 0.55, 8, '#58c8ff')
    }
    if (enemy.hp <= 0) onEnemyKilled(enemy)
  }

  function onEnemyKilled(enemy) {
    if (enemy.deadHandled) return
    enemy.deadHandled = true
    kills++

    if (mods.lifesteal > 0 && !enemy.isBoss) player.hp = Math.min(player.maxHp, player.hp + mods.lifesteal)

    if (player.shellBellRank > 0 && ++player.shellBellCounter >= 15) {
      player.shellBellCounter = 0
      player.hp = Math.min(player.maxHp, player.hp + 6 * player.shellBellRank)
      spawnParticles(player.x, player.y, '#48f898', 8, 90)
    }

    // ── 처치 연출 + 콤보 ──
    combo++
    comboTimer = 1.6
    comboPop = 1
    if (combo > bestCombo) bestCombo = combo
    if (combo % 100 === 0) {
      banner('🔥 ' + combo + ' COMBO! 황금 보석 소나기!')
      flash('#ffd040', 0.35)
      addRing(player.x, player.y, '#ffd040', 260, 0.5, 6, true)
      zoomPunch(1.04)
      vibrate([20, 20, 20])
      for (let g = 0; g < 10; g++) {
        const a = (g / 10) * Math.PI * 2
        xpGems.push({ x: player.x + Math.cos(a) * 90, y: player.y + Math.sin(a) * 90, val: 12 * monsterMult, tier: 'gold', magnet: true })
      }
    }
    if (enemy.isBoss) {
      spawnParticles(enemy.x, enemy.y, enemy.color, 40, 320, 'debris')
      spawnParticles(enemy.x, enemy.y, '#ffffff', 30, 380, 'spark')
      spawnParticles(enemy.x, enemy.y, '#ffd040', 24, 120, 'ember')
      for (let k = 0; k < 4; k++) addRing(enemy.x, enemy.y, RAINBOW[k * 2], 140 + k * 70, 0.5 + k * 0.12, 6 - k, k === 0)
      flash('#ffffff', 0.7, 2)
      slow(0.22, 0.9)
      zoomPunch(1.08)
      shakeTimer = 0.45; shakeAmount = 12
      addDecal(enemy.x, enemy.y, 70)
      floatText('BOSS DOWN!', enemy.x, enemy.y - 50, '#ffd040', 30, 1.6)
    } else {
      spawnParticles(enemy.x, enemy.y, enemy.color, enemy.elite ? 14 : 5, 150, 'debris')
      if (fxLevel === 2) {
        spawnParticles(enemy.x, enemy.y, '#ffffff', 2, 60, 'ember')
        addRing(enemy.x, enemy.y, enemy.color, enemy.radius * (enemy.elite ? 4 : 2.2), 0.22, 2)
      }
      if (enemy.elite) { flash('#ffd040', 0.12); zoomPunch(1.015) }
    }
    const multFactor = enemy.xpFactor || monsterMult

    // [변이] 분열의 숲: 쓰러진 적이 작은 적 둘로 갈라짐
    if (!enemy.isBoss && !enemy.mini && mods.splitChance > 0 && Math.random() < mods.splitChance && enemies.length < MAX_ENEMIES) {
      for (let k = 0; k < 2; k++) {
        const hp = Math.max(4, Math.round(enemy.maxHp * 0.35))
        enemies.push({ ...enemy, x: enemy.x + (k ? 10 : -10), y: enemy.y, hp, maxHp: hp, radius: enemy.radius * 0.7, scale: (enemy.scale || 1) * 0.7, mini: true, elite: false, deadHandled: false, xpFactor: multFactor * 0.4 })
      }
    }

    if (enemy.isBoss) {
      bossKills++
      chests.push({ x: enemy.x, y: enemy.y, bob: 0 })
      vibrate([40, 30, 60])
      for (let g = 0; g < 8; g++) {
        const a = (g / 8) * Math.PI * 2
        xpGems.push({ x: enemy.x + Math.cos(a) * 24, y: enemy.y + Math.sin(a) * 24, val: 25 * multFactor, tier: 'gold', magnet: false })
      }
      return
    }

    if (enemy.elite && Math.random() < 0.12) chests.push({ x: enemy.x, y: enemy.y, bob: 0 })

    if (xpGems.length > 260) {
      const t = xpGems[Math.floor(Math.random() * 80)]
      if (t) { t.val += 4 * multFactor; t.tier = 'gold'; return }
    }
    const goldProb = Math.min(0.5, 0.04 + gameTime * 0.0012 + mods.goldBonus)
    const blueProb = Math.min(0.55, 0.22 + gameTime * 0.0018)
    const r = Math.random()
    let tier = 'green'
    let baseVal = 3
    if (r < goldProb || enemy.kind === 'golem' || enemy.elite) { tier = 'gold'; baseVal = 25 }
    else if (r < goldProb + blueProb || enemy.kind === 'hornet' || enemy.kind === 'viper') { tier = 'blue'; baseVal = 8 }
    xpGems.push({ x: enemy.x, y: enemy.y, val: baseVal * multFactor, tier, magnet: false })
  }

  function fireBaseSkill(entry) {
    const sk = entry.skill
    const lvl = entry.level
    const dmg = sk.dmgBase * (1 + (lvl - 1) * 0.28)
    const area = player.areaMult * (1 + (lvl - 1) * 0.1)
    const count = (sk.countBase + Math.floor((lvl - 1) / 2)) * player.projMult
    SoundFX.play('shoot')

    if (sk.pattern === 'projectile') {
      const t = getNearestEnemy(player.x, player.y, 650)
      const base = t ? Math.atan2(t.y - player.y, t.x - player.x) : player.facingAngle
      for (let i = 0; i < count; i++) {
        const a = base + (i - (count - 1) / 2) * 0.12
        projectiles.push({ kind: 'bolt', x: player.x, y: player.y, vx: Math.cos(a) * 530, vy: Math.sin(a) * 530, radius: 6 * area, dmg, pierce: 1 + Math.floor(lvl / 3) + player.bonusPierce, color: sk.color, life: 1.2, hitSet: new WeakSet() })
      }
    } else if (sk.pattern === 'boomerang') {
      const t = getNearestEnemy(player.x, player.y, 580)
      const base = t ? Math.atan2(t.y - player.y, t.x - player.x) : player.facingAngle
      for (let i = 0; i < count; i++) {
        const a = base + (i - (count - 1) / 2) * 0.28
        projectiles.push({ kind: 'boomerang', x: player.x, y: player.y, vx: Math.cos(a) * 440, vy: Math.sin(a) * 440, radius: 8 * area, dmg, pierce: 99, color: sk.color, life: 1.5, age: 0, hitSet: new WeakSet() })
      }
    } else if (sk.pattern === 'lightning') {
      const t = getNearestEnemy(player.x, player.y, 520)
      if (t) triggerLightningChain(player.x, player.y, t, dmg, 2 + count, sk.color)
    } else if (sk.pattern === 'homing') {
      for (let i = 0; i < count; i++) {
        const a = player.facingAngle + (i - (count - 1) / 2) * 0.45
        projectiles.push({ kind: 'homing', x: player.x, y: player.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, radius: 8 * area, dmg, pierce: 1 + player.bonusPierce, color: sk.color, life: 2.0, hitSet: new WeakSet() })
      }
    } else if (sk.pattern === 'nova') {
      const maxR = 118 * area
      const kb = 18 + player.bonusPierce * 6
      addRing(player.x, player.y, sk.color, maxR, 0.32, 5, true)
      if (fxLevel === 2) spawnParticles(player.x, player.y, sk.color, 8, maxR * 2.2, 'spark')
      queryNearbyEnemies(player.x, player.y, maxR + 40, tempNearby)
      for (const e of tempNearby.slice()) {
        if (e.hp <= 0) continue
        const dist = Math.hypot(e.x - player.x, e.y - player.y)
        if (dist <= maxR + e.radius) {
          hitEnemy(e, dmg, sk.color, true)
          if (dist > 0.001 && !e.isBoss) {
            e.x += ((e.x - player.x) / dist) * kb
            e.y += ((e.y - player.y) / dist) * kb
          }
        }
      }
    }
  }

  function pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
    if (l2 < 0.0001) return Math.hypot(px - x1, py - y1)
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)))
  }

  function radialHit(cx, cy, maxR, dmg, color, onHit) {
    queryNearbyEnemies(cx, cy, maxR + 40, tempNearby)
    const list = tempNearby.slice()
    for (const e of list) {
      if (e.hp > 0 && Math.hypot(e.x - cx, e.y - cy) <= maxR + e.radius) {
        hitEnemy(e, dmg, color, true)
        if (onHit) onHit(e)
      }
    }
  }

  function laser(ang, len, bw, dmg, color) {
    const ex = player.x + Math.cos(ang) * len
    const ey = player.y + Math.sin(ang) * len
    beams.push({ x1: player.x, y1: player.y, x2: ex, y2: ey, color, width: bw, isLaser: true, life: 0.24, maxLife: 0.24 })
    for (let j = 0; j < enemies.length; j++) {
      const e = enemies[j]
      if (e.hp > 0 && pointToSegmentDist(e.x, e.y, player.x, player.y, ex, ey) <= e.radius + bw * 0.65) hitEnemy(e, dmg, color, true)
    }
  }

  function fireFusionSkill(entry) {
    const f = entry.fusion
    const lvl = entry.level
    const dmg = f.dmgBase * (1 + (lvl - 1) * 0.35)
    const area = player.areaMult * (1 + (lvl - 1) * 0.14)
    const mult = player.projMult
    SoundFX.play('shoot')

    if (f.id === 'f_solar_beam') {
      const t = getNearestEnemy(player.x, player.y, 600)
      const base = t ? Math.atan2(t.y - player.y, t.x - player.x) : player.facingAngle
      const n = 2 * mult
      for (let i = 0; i < n; i++) laser(base + (i - (n - 1) / 2) * 0.25, 600, 20 * area, dmg, f.color)
    } else if (f.id === 'f_storm_tsunami') {
      const maxR = 195 * area
      shockwaves.push({ x: player.x, y: player.y, radius: 16, maxRadius: maxR, color: '#4898f8', life: 0.34, maxLife: 0.34 })
      radialHit(player.x, player.y, maxR, dmg * 0.85, '#4898f8')
      const t = getNearestEnemy(player.x, player.y, 560)
      if (t) triggerLightningChain(player.x, player.y, t, dmg, 7 * mult, '#f8d830')
    } else if (f.id === 'f_crimson_dragon') {
      const t = getNearestEnemy(player.x, player.y, 560)
      const a = t ? Math.atan2(t.y - player.y, t.x - player.x) : player.facingAngle
      for (let i = 0; i < 3 * mult; i++) {
        const d = 70 + i * 78
        const tx = player.x + Math.cos(a) * d
        const ty = player.y + Math.sin(a) * d
        const br = 90 * area
        addRing(tx, ty, f.color, br, 0.32, 6, true)
        spawnParticles(tx, ty, '#f8d838', 8, 180, 'ember')
        addDecal(tx, ty, br * 0.4)
        radialHit(tx, ty, br, dmg, f.color)
      }
    } else if (f.id === 'f_hyper_rift') {
      const n = 3 * mult
      for (let i = 0; i < n; i++) {
        const t = getRandomEnemyNear(player.x, player.y, 580)
        const a = t ? Math.atan2(t.y - player.y, t.x - player.x) : (i / n) * Math.PI * 2 + gameTime
        laser(a, 580, 18 * area, dmg, f.color)
      }
    } else if (f.id === 'f_worldtree_flood') {
      const maxR = 205 * area
      player.hp = Math.min(player.maxHp, player.hp + 10 * lvl)
      shockwaves.push({ x: player.x, y: player.y, radius: 16, maxRadius: maxR, color: f.color, life: 0.36, maxLife: 0.36 })
      radialHit(player.x, player.y, maxR, dmg, f.color)
    } else if (f.id === 'f_spacetime_meteor') {
      const maxR = 325 * area
      SoundFX.play('meteor')
      shakeTimer = 0.2; shakeAmount = 6
      addRing(player.x, player.y, f.color, maxR, 0.5, 8, true)
      addRing(player.x, player.y, '#ffffff', maxR * 0.7, 0.35, 3)
      spawnParticles(player.x, player.y, f.color, 20, maxR * 2, 'spark')
      flash(f.color, 0.18)
      zoomPunch(1.025)
      radialHit(player.x, player.y, maxR, dmg, f.color)
    } else if (f.id === 'f_azure_roar') {
      const total = 12 * mult
      for (let i = 0; i < total; i++) {
        const a = (i / total) * Math.PI * 2 + Math.random() * 0.2
        projectiles.push({ kind: 'iceShard', x: player.x, y: player.y, vx: Math.cos(a) * 490, vy: Math.sin(a) * 490, radius: 9 * area, dmg, pierce: 3 + player.bonusPierce, color: f.color, life: 1.15, hitSet: new WeakSet() })
      }
    } else if (f.id === 'f_thunder_forest') {
      const n = 3 * mult
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + gameTime * 1.5
        zones.push({ x: player.x + Math.cos(a) * 32, y: player.y + Math.sin(a) * 32, vx: Math.cos(a) * 195, vy: Math.sin(a) * 195, radius: 48 * area, dmg, tickTimer: 0, color: f.color, life: 2.2, rot: 0 })
      }
    } else if (f.id === 'f_magma_quake') {
      const maxR = 255 * area
      addRing(player.x, player.y, f.color, maxR, 0.42, 7, true)
      addRing(player.x, player.y, '#68d8f8', maxR * 0.8, 0.5, 3)
      spawnParticles(player.x, player.y, '#ffd0a0', 16, 200, 'ember')
      addDecal(player.x, player.y, maxR * 0.35, '#302018')
      radialHit(player.x, player.y, maxR, dmg, f.color, (e) => { e.freezeTimer = 1.2 })
    } else if (f.id === 'f_mandala') {
      const n = 8 * mult
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + gameTime * 3
        projectiles.push({ kind: 'homing', x: player.x + Math.cos(a) * 28, y: player.y + Math.sin(a) * 28, vx: Math.cos(a) * 440, vy: Math.sin(a) * 440, radius: 10 * area, dmg, pierce: 2 + player.bonusPierce, color: '#ffe858', life: 2.2, hitSet: new WeakSet() })
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 선택창 (레벨업 / 조합 / 유물)
  // ---------------------------------------------------------------------------
  function fusionUnlockSec(f) {
    return f.unlockSec * mods.fusionTimeMult
  }

  function getReadyFusions() {
    const owned = new Set(player.activeSkills.map((s) => s.skill.type))
    const list = []
    for (const f of FUSIONS) {
      if (gameTime < fusionUnlockSec(f)) continue
      if (!f.reqTypes.every((t) => owned.has(t))) continue
      const mats = f.reqTypes.map((t) => {
        const s = player.activeSkills.find((x) => x.skill.type === t)
        return s ? s.skill.name + ' Lv.' + s.level : TYPES[t].name
      })
      list.push({ fusion: f, materials: mats.join(' + '), owned: player.activeFusions.find((a) => a.fusion.id === f.id) || null })
    }
    list.sort((a, b) => (a.owned ? 1 : 0) - (b.owned ? 1 : 0))
    return list
  }

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  function showSkillChoice(info, isReroll) {
    gameState = 'MODAL'
    const secIdx = Math.floor(gameTime) % 60
    const synced = SKILLS_60[secIdx]
    const ready = getReadyFusions()
    const used = totalSlots()
    const full = used >= MAX_SKILL_SLOTS
    if (!isReroll) {
      SoundFX.play(ready.length ? 'fusion' : 'levelup')
      vibrate(25)
    }

    const slots = []
    const usedBase = new Set()
    if (ready.length) slots.push({ kind: 'fusion', data: ready[Math.floor(Math.random() * Math.min(ready.length, isReroll ? ready.length : 1))] })
    const ownsSynced = player.activeSkills.some((s) => s.skill.id === synced.id)
    if (!isReroll && (!full || ownsSynced)) { slots.push({ kind: 'base', skill: synced, isSynced: true }); usedBase.add(synced.id) }

    const baseC = shuffle((full ? player.activeSkills.map((s) => s.skill) : SKILLS_60.slice()).filter((s) => !usedBase.has(s.id)))
    const passC = shuffle(full ? player.activePassives.map((p) => p.passive) : PASSIVES.slice())
    while (slots.length < 3 && (baseC.length || passC.length)) {
      if (passC.length && (!baseC.length || Math.random() < 0.36)) slots.push({ kind: 'passive', passive: passC.pop() })
      else { const b = baseC.pop(); slots.push({ kind: 'base', skill: b, isSynced: b.id === synced.id }) }
    }

    const cards = []
    const handlers = []
    for (const slot of slots) {
      if (slot.kind === 'fusion') {
        const f = slot.data.fusion
        cards.push({ kind: 'fusion', icon: f.icon, title: f.name, tag: '✨ 조합 진화 (빈칸 +1)', tagBg: '#202830', tagFg: '#f8d838', lv: slot.data.owned ? '강화 합체' : 'EVOLVE', desc: f.desc, note: '재료: ' + slot.data.materials })
        handlers.push(() => {
          addFusion(f)
          SoundFX.play('fusion')
          vibrate([30, 40, 30])
          for (let k = 0; k < RAINBOW.length; k++) addRing(player.x, player.y, RAINBOW[k], 120 + k * 40, 0.4 + k * 0.08, 5)
          spawnParticles(player.x, player.y, '#f8b818', 30, 260, 'spark')
          spawnParticles(player.x, player.y, '#ffffff', 16, 90, 'ember')
          flash('#ffe8a0', 0.5, 2.5)
          slow(0.35, 0.5)
          zoomPunch(1.06)
          floatText('EVOLUTION!', player.x, player.y - 46, '#ff78d8', 26, 1.4)
        })
      } else if (slot.kind === 'passive') {
        const ps = slot.passive
        const owned = player.activePassives.find((p) => p.passive.id === ps.id)
        cards.push({ kind: 'passive', icon: ps.icon, title: ps.name, tag: '패시브 · ' + ps.tag, tagBg: '#3868b8', tagFg: '#fff', lv: owned ? 'Lv.' + (owned.level + 1) : 'NEW', desc: ps.desc })
        handlers.push(() => addPassive(ps))
      } else {
        const sk = slot.skill
        const tp = TYPES[sk.type]
        const owned = player.activeSkills.find((s) => s.skill.id === sk.id)
        cards.push({ kind: 'base', synced: slot.isSynced, icon: sk.icon, title: sk.name, tag: tp.name + (slot.isSynced ? ' · ⏱' + String(secIdx).padStart(2, '0') + '초 동기화' : ' · #' + String(sk.id).padStart(2, '0')), tagBg: tp.bg, tagFg: tp.fg, lv: owned ? 'Lv.' + (owned.level + 1) : 'NEW', desc: sk.desc })
        handlers.push(() => addBaseSkill(sk))
      }
    }

    currentChoice = { type: 'levelup', info, handlers }
    const lv = info.levelSnapshot || player.level
    ui.onChoice && ui.onChoice({
      title: ready.length ? '✨ 조합 진화 가능!' : '▲ LEVEL ' + lv + '!',
      sub: full ? '슬롯 가득 (조합하면 칸 확보)' : '스킬 ' + used + '/' + MAX_SKILL_SLOTS,
      auto: info.isAutoMinute ? '⏱ ' + info.minuteMark + '분 보너스' : '',
      gold: ready.length > 0,
      cards,
      rerolls: rerollsLeft
    })
  }

  function showRelicChoice(isReroll) {
    gameState = 'MODAL'
    if (!isReroll) { SoundFX.play('relic'); vibrate([20, 30, 20]) }
    const unowned = RELICS.filter((r) => !player.relics[r.id])
    const pool = unowned.length >= 3 ? unowned : RELICS
    const picks = shuffle(pool.slice()).slice(0, 3)
    const cards = picks.map((r) => ({ kind: 'relic', icon: r.icon, title: r.name, tag: r.tag, tagBg: '#7838b8', tagFg: '#fff', lv: player.relics[r.id] ? '중복' : '유물', desc: r.desc }))
    const handlers = picks.map((rel) => () => {
      rel.apply(player)
      player.relics[rel.id] = true
      player.ownedRelics.push(rel)
      rebuildOrbitShields()
      emitDock()
      addRing(player.x, player.y, '#c068e8', 240, 0.5, 7, true)
      addRing(player.x, player.y, '#f8d838', 160, 0.4, 3)
      spawnParticles(player.x, player.y, '#f8d838', 24, 220, 'spark')
      flash('#d8a0ff', 0.4, 2.5)
      zoomPunch(1.04)
      floatText(rel.icon + ' ' + rel.name, player.x, player.y - 46, '#e8c0ff', 16, 1.6)
    })
    currentChoice = { type: 'relic', handlers }
    ui.onChoice && ui.onChoice({ title: '🏺 고대 유물 각성!', sub: 'ANCIENT RELIC', auto: '', gold: true, cards, rerolls: rerollsLeft })
  }

  // ---------------------------------------------------------------------------
  // 몬스터 생성
  // ---------------------------------------------------------------------------
  function spawnEnemy(forcedKind) {
    const ang = Math.random() * Math.PI * 2
    const dist = Math.max(width, height) * 0.58 + 55
    const x = player.x + Math.cos(ang) * dist
    const y = player.y + Math.sin(ang) * dist
    const timeScale = 1 + gameTime / 75
    const nightHp = cfg.night ? 1.15 : 1
    const nightXp = cfg.night ? 1.25 : 1

    let kind = forcedKind
    if (!kind) {
      const r = Math.random()
      if (gameTime > 48 && r < 0.13) kind = 'golem'
      else if (gameTime > 32 && r < 0.3) kind = 'hornet'
      else if (gameTime > 20 && r < 0.48) kind = 'viper'
      else if (gameTime > 12 && r < 0.66) kind = 'spider'
      else if (gameTime > 5 && r < 0.84) kind = 'sprout'
      else kind = 'caterpillar'
    }

    if (kind === 'boss') {
      const tpl = BOSS_TEMPLATES[bossCount % BOSS_TEMPLATES.length]
      const loop = 1 + Math.floor(bossCount / BOSS_TEMPLATES.length) * 0.9
      const hp = Math.round(tpl.hp * loop * monsterMult * nightHp)
      SoundFX.play('boss')
      vibrate(80)
      const title = cfg.bossTitle ? cfg.bossTitle + ' ' : ''
      enemies.push({
        kind: 'boss', sprite: tpl.sprite, isBoss: true,
        bossName: (monsterMult > 1 ? '🔥x' + monsterMult + ' ' : '') + tpl.icon + ' ' + title + tpl.name,
        x, y, radius: tpl.r, hp, maxHp: hp, xpFactor: monsterMult * nightXp, speed: tpl.spd * Math.min(1.3, mods.enemySpeed),
        dmg: Math.round(tpl.dmg * loop), color: tpl.color, hitFlash: 0, freezeTimer: 0, animTime: 0,
        facingLeft: false, attackTimer: 2.5, telegraph: null, deadHandled: false, scale: 1
      })
      bossCount++
      bossIntro = { t: 0, dur: 2.2, name: title + tpl.name, icon: tpl.icon, color: tpl.color }
      flash('#ff3030', 0.35, 2)
      slow(0.4, 0.7)
      shakeTimer = 0.5; shakeAmount = 9
      return
    }

    const spec = ENEMY_TABLE[kind] || ENEMY_TABLE.caterpillar
    const elite = mods.eliteChance > 0 && Math.random() < mods.eliteChance
    const hp = Math.round(spec.hp * timeScale * monsterMult * mods.enemyHp * nightHp * (elite ? 4 : 1))
    const scale = mods.enemyScale * (elite ? 1.2 : 1)
    enemies.push({
      kind, sprite: kind, isBoss: false, elite, x, y,
      radius: spec.r * scale, scale, hp, maxHp: hp,
      xpFactor: monsterMult * mods.enemyXp * nightXp * (elite ? 3 : 1),
      speed: (spec.spd + Math.min(45, gameTime * 0.22)) * mods.enemySpeed * (elite ? 0.85 : 1),
      dmg: spec.dmg * (elite ? 1.5 : 1), color: elite ? '#f8d838' : spec.col,
      hitFlash: 0, freezeTimer: 0, animTime: Math.random() * 5, facingLeft: false, deadHandled: false
    })
  }

  // ---------------------------------------------------------------------------
  // HUD 전달 (Vue로 0.1초마다 스냅샷)
  // ---------------------------------------------------------------------------
  function emitDock() {
    if (!ui.onDock) return
    const items = []
    player.activeFusions.forEach((e) => items.push({ k: 'fusion', icon: e.fusion.icon, lv: e.level, title: e.fusion.name }))
    player.activeSkills.forEach((e) => items.push({ k: 'base', icon: e.skill.icon, lv: e.level, title: e.skill.name }))
    player.activePassives.forEach((e) => items.push({ k: 'passive', icon: e.passive.icon, lv: e.level, title: e.passive.name }))
    player.ownedRelics.forEach((r) => items.push({ k: 'relic', icon: r.icon, lv: '', title: r.name }))
    ui.onDock({ items, used: totalSlots(), max: MAX_SKILL_SLOTS })
  }

  function emitHud(force) {
    if (!ui.onHud) return
    if (!force && hudTimer > 0) return
    hudTimer = 0.1
    let boss = null
    for (const e of enemies) {
      if (e.isBoss && e.hp > 0) { boss = { name: e.bossName, pct: Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100)) }; break }
    }
    ui.onHud({
      hp: player.hp, maxHp: player.maxHp, xp: player.xp, xpNeed: getXpNeeded(player.level), level: player.level,
      time: gameTime, kills, nextBoss: 60 - (Math.floor(gameTime) % 60),
      fusionReady: getReadyFusions().some((r) => !r.owned), boss, mult: monsterMult, revives: revivesLeft
    })
  }

  function levelFx() {
    pillars.push({ x: player.x, y: player.y, life: 0.9, maxLife: 0.9 })
    flash('#fff0a0', 0.3, 3)
    floatText('LEVEL UP!', player.x, player.y - 40, '#ffe040', 24, 1.1)
    spawnParticles(player.x, player.y, '#ffe878', 14, 80, 'ember')
  }

  function triggerMinuteAutoLevelUp(minuteMark) {
    player.level++
    player.hp = Math.min(player.maxHp, player.hp + 15)
    SoundFX.play('levelup')
    hitstopTimer = 0.025
    shakeTimer = 0.2; shakeAmount = 6
    shockwaves.push({ x: player.x, y: player.y, radius: 14, maxRadius: 210, color: '#f8d838', life: 0.4, maxLife: 0.4 })
    spawnParticles(player.x, player.y, '#f8d838', 20, 175)
    banner('★ ' + minuteMark + '분 경과! 자동 레벨업 ★')
    levelFx()
    pushModal({ type: 'levelup', isAutoMinute: true, minuteMark, levelSnapshot: player.level })
  }

  function triggerGameOver() {
    // 영구 업그레이드 '불사조의 깃' — 한 번 되살아남
    if (revivesLeft > 0) {
      revivesLeft--
      player.hp = Math.round(player.maxHp * 0.5)
      player.invuln = 2.2
      SoundFX.play('revive')
      vibrate([60, 40, 120])
      shakeTimer = 0.3; shakeAmount = 9
      shockwaves.push({ x: player.x, y: player.y, radius: 20, maxRadius: 320, color: '#f8b818', life: 0.5, maxLife: 0.5 })
      spawnParticles(player.x, player.y, '#f8b818', 30, 240)
      queryNearbyEnemies(player.x, player.y, 320, tempNearby)
      for (const e of tempNearby) {
        if (e.isBoss) continue
        const d = Math.hypot(e.x - player.x, e.y - player.y) || 1
        e.x += ((e.x - player.x) / d) * 160
        e.y += ((e.y - player.y) / d) * 160
      }
      banner('🪽 불사조의 깃이 타오른다! 부활!')
      flash('#ffc040', 0.8, 1.5)
      slow(0.3, 0.8)
      zoomPunch(1.08)
      spawnParticles(player.x, player.y, '#ff8030', 30, 140, 'ember')
      pillars.push({ x: player.x, y: player.y, life: 1.4, maxLife: 1.4, color: '#ff9030' })
      return
    }
    gameState = 'GAMEOVER'
    vibrate([100, 50, 100])
    ui.onGameOver && ui.onGameOver({
      time: gameTime, level: player.level, kills, peakMult: peakMonsterMult, bossKills,
      fusions: player.activeFusions.length, relics: player.ownedRelics.length,
      build: [
        ...player.activeFusions.map((e) => e.fusion.icon),
        ...player.activeSkills.slice().sort((a, b) => b.level - a.level).slice(0, 5).map((e) => e.skill.icon),
        ...player.ownedRelics.map((r) => r.icon)
      ].slice(0, 10)
    })
  }

  function damagePlayer(amount) {
    if (player.invuln > 0) return
    const d = Math.max(1, Math.round(amount * player.dmgTakenMult))
    player.hp = Math.max(0, player.hp - d)
    player.invuln = 0.55
    shakeTimer = 0.16; shakeAmount = 5
    SoundFX.play('hurt')
    vibrate(30)
    flash('#ff2020', 0.22, 4)
    spawnParticles(player.x, player.y, '#e83830', 8, 160, 'spark')
    if (player.hp <= 0) triggerGameOver()
  }

  function updateFx(dt) {
    for (let i = dmgTexts.length - 1; i >= 0; i--) {
      const t = dmgTexts[i]
      t.life -= dt
      t.vy += 160 * dt
      t.x += t.vx * dt
      t.y += t.vy * dt
      if (t.life <= 0) dmgTexts.splice(i, 1)
    }
    for (let i = floatTexts.length - 1; i >= 0; i--) {
      const t = floatTexts[i]
      t.life -= dt
      t.y -= 28 * dt
      if (t.life <= 0) floatTexts.splice(i, 1)
    }
    for (let i = decals.length - 1; i >= 0; i--) if ((decals[i].life -= dt) <= 0) decals.splice(i, 1)
    for (let i = pillars.length - 1; i >= 0; i--) {
      pillars[i].x = player.x; pillars[i].y = player.y
      if ((pillars[i].life -= dt) <= 0) pillars.splice(i, 1)
    }
  }

  // ---------------------------------------------------------------------------
  // 메인 업데이트
  // ---------------------------------------------------------------------------
  function update(dt) {
    if (gameState !== 'PLAYING') return
    if (hitstopTimer > 0) { hitstopTimer -= dt; return }

    gameTime += dt
    hudTimer -= dt
    sparkBudget = fxLevel === 2 ? 14 : 4
    if (comboTimer > 0) { comboTimer -= dt; if (comboTimer <= 0) combo = 0 }
    comboPop = Math.max(0, comboPop - dt * 6)
    updateFx(dt)
    if (shakeTimer > 0) shakeTimer = Math.max(0, shakeTimer - dt)
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt)
    const regen = player.regen * mods.regenMult
    if (player.hp < player.maxHp && regen > 0) player.hp = Math.min(player.maxHp, player.hp + regen * dt)

    const minuteMark = Math.floor(gameTime / 60)
    if (minuteMark > autoLevelCount) { autoLevelCount++; triggerMinuteAutoLevelUp(autoLevelCount) }
    if (minuteMark > bossCount) spawnEnemy('boss')

    // 이동
    let mx = 0
    let my = 0
    if (keys.KeyW || keys.ArrowUp) my -= 1
    if (keys.KeyS || keys.ArrowDown) my += 1
    if (keys.KeyA || keys.ArrowLeft) mx -= 1
    if (keys.KeyD || keys.ArrowRight) mx += 1
    if (stick.active) { mx += stick.dx; my += stick.dy }
    const mag = Math.hypot(mx, my)
    if (mag > 0.08) {
      const inv = mag > 1 ? 1 / mag : 1
      player.x += mx * inv * player.speed * dt
      player.y += my * inv * player.speed * dt
      player.facingAngle = Math.atan2(my, mx)
      if (mx < -0.05) player.facingLeft = true
      else if (mx > 0.05) player.facingLeft = false
      player.walkAnim += dt * 10
    }

    // 동료 정령 (영구 진화 단계에 따라 색·위력 변화)
    const goalSX = player.x + (player.facingLeft ? 22 : -22)
    const goalSY = player.y + 12 + Math.sin(gameTime * 6) * 2
    player.spiritX += (goalSX - player.spiritX) * Math.min(1, 8 * dt)
    player.spiritY += (goalSY - player.spiritY) * Math.min(1, 8 * dt)
    player.spiritTimer -= dt
    if (player.spiritTimer <= 0) {
      player.spiritTimer = Math.max(0.32, (1.0 - cfg.spiritStage * 0.15) * player.cdMult)
      const t = getNearestEnemy(player.spiritX, player.spiritY, 450)
      if (t) {
        const a = Math.atan2(t.y - player.spiritY, t.x - player.spiritX)
        const shots = 1 + cfg.spiritStage
        const col = ['#78d858', '#68d8f8', '#f8d838'][cfg.spiritStage] || '#78d858'
        for (let s = 0; s < shots; s++) {
          const aa = a + (s - (shots - 1) / 2) * 0.18
          projectiles.push({ kind: 'bolt', x: player.spiritX, y: player.spiritY, vx: Math.cos(aa) * 470, vy: Math.sin(aa) * 470, radius: 5, dmg: (13 + player.level * 2) * spiritPowMult, pierce: 1, color: col, life: 1.0, hitSet: new WeakSet() })
        }
      }
    }

    buildSpatialGrid()

    // [변이] 뇌우
    if (mods.storm) {
      stormTimer -= dt
      if (stormTimer <= 0) {
        stormTimer = 5
        for (let s = 0; s < 4; s++) {
          const t = getRandomEnemyNear(player.x, player.y, 520)
          if (!t) break
          beams.push({ x1: t.x + 30, y1: t.y - 340, x2: t.x, y2: t.y, color: '#c8e8ff', width: 7, isLaser: true, life: 0.22, maxLife: 0.22 })
          addRing(t.x, t.y, '#c8e8ff', 70, 0.3, 5, true)
          addDecal(t.x, t.y, 22, '#182028')
          radialHit(t.x, t.y, 60, 40 + player.level * 6, '#c8e8ff')
        }
        shakeTimer = 0.1; shakeAmount = 4
        flash('#e0f0ff', 0.25, 5)
        SoundFX.play('meteor')
      }
    }

    // [변이] 보물 사냥
    if (mods.chestEvery > 0) {
      chestTimer += dt
      if (chestTimer >= mods.chestEvery) {
        chestTimer = 0
        const a = Math.random() * Math.PI * 2
        chests.push({ x: player.x + Math.cos(a) * 280, y: player.y + Math.sin(a) * 280, bob: 0 })
        banner('🗝️ 근처에 보물 상자가 나타났다!')
      }
    }

    // 유물: 메테오
    if (player.relics.meteorTablet) {
      player.meteorTimer -= dt
      if (player.meteorTimer <= 0) {
        player.meteorTimer = Math.max(1.05, 2.3 * player.cdMult)
        for (let m = 0; m < 3; m++) {
          const t = getRandomEnemyNear(player.x, player.y, 440) || { x: player.x + (Math.random() - 0.5) * 280, y: player.y + (Math.random() - 0.5) * 280 }
          meteors.push({ tx: t.x + (Math.random() - 0.5) * 26, ty: t.y + (Math.random() - 0.5) * 26, timer: 0.4 + m * 0.14, maxTimer: 0.4 + m * 0.14, radius: 84 * player.areaMult, dmg: 115 })
        }
      }
    }
    // 유물: 블랙홀
    if (player.relics.voidMaw) {
      player.blackHoleTimer -= dt
      if (player.blackHoleTimer <= 0) {
        player.blackHoleTimer = Math.max(1.4, 3.0 * player.cdMult)
        const t = getRandomEnemyNear(player.x, player.y, 380) || { x: player.x + Math.cos(player.facingAngle) * 140, y: player.y + Math.sin(player.facingAngle) * 140 }
        blackHoles.push({ x: t.x, y: t.y, radius: 125 * player.areaMult, dmg: 32 + player.level * 4, tickTimer: 0, life: 2.5, rot: 0 })
      }
    }
    // 유물: 세계수
    if (player.relics.worldTreeCore) {
      player.seedPulseTimer -= dt
      if (player.seedPulseTimer <= 0) {
        player.seedPulseTimer = 3.8
        player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * 0.14))
        const pr = 160 * player.areaMult
        shockwaves.push({ x: player.x, y: player.y, radius: 14, maxRadius: pr, color: '#48f898', life: 0.35, maxLife: 0.35 })
        spawnParticles(player.x, player.y, '#48f898', 10, 120)
        queryNearbyEnemies(player.x, player.y, pr + 40, tempNearby)
        for (const e of tempNearby.slice()) {
          if (e.hp > 0 && Math.hypot(e.x - player.x, e.y - player.y) <= pr + e.radius) hitEnemy(e, 26 + player.level * 3, '#48f898', false)
        }
      }
    }
    // 유물: 용검
    if (player.relics.dragonScaleArmor) {
      player.dragonBladeAngle += 5.4 * dt
      const oR = 72 * player.areaMult
      const bR = 13 * player.areaMult
      const dd = 26 + player.level * 3
      queryNearbyEnemies(player.x, player.y, oR + 45, tempNearby)
      const list = tempNearby.slice()
      for (let b = 0; b < 4; b++) {
        const a = player.dragonBladeAngle + (b * Math.PI) / 2
        const bx = player.x + Math.cos(a) * oR
        const by = player.y + Math.sin(a) * oR
        for (const e of list) {
          if (e.hp <= 0) continue
          if (e.dragonHitCooldown && gameTime - e.dragonHitCooldown < 0.22) continue
          const rs = e.radius + bR
          if ((e.x - bx) ** 2 + (e.y - by) ** 2 <= rs * rs) { e.dragonHitCooldown = gameTime; hitEnemy(e, dd, '#f85830', true) }
        }
      }
    }

    // 몬스터 스폰
    const baseGap = Math.max(0.22, 0.95 - gameTime * 0.007)
    const gap = Math.max(0.045, baseGap / Math.min(16, monsterMult) / mods.spawnRate)
    const batch = Math.min(28, Math.max(1, Math.ceil(monsterMult / 4)))
    spawnTimer -= dt
    if (spawnTimer <= 0 && enemies.length < MAX_ENEMIES) {
      spawnTimer = gap
      for (let b = 0; b < batch && enemies.length < MAX_ENEMIES; b++) spawnEnemy()
    }

    // 스킬 자동 발사 (+ [변이] 메아리)
    for (const entry of player.activeSkills) {
      if (entry.skill.pattern === 'orbit') continue
      entry.timer -= dt
      if (entry.timer <= 0) {
        entry.timer = Math.max(0.15, entry.skill.cdBase * Math.pow(0.92, entry.level - 1) * player.cdMult)
        fireBaseSkill(entry)
        if (mods.echoChance > 0 && Math.random() < mods.echoChance) echoQueue.push({ t: 0.18, entry, fusion: false })
      }
    }
    for (const entry of player.activeFusions) {
      entry.timer -= dt
      if (entry.timer <= 0) {
        entry.timer = Math.max(0.24, entry.fusion.cdBase * Math.pow(0.9, entry.level - 1) * player.cdMult)
        fireFusionSkill(entry)
        if (mods.echoChance > 0 && Math.random() < mods.echoChance) echoQueue.push({ t: 0.22, entry, fusion: true })
      }
    }
    for (let i = echoQueue.length - 1; i >= 0; i--) {
      const q = echoQueue[i]
      q.t -= dt
      if (q.t <= 0) {
        echoQueue.splice(i, 1)
        if (q.fusion) fireFusionSkill(q.entry)
        else fireBaseSkill(q.entry)
      }
    }

    // 회전 잎날
    for (const ob of orbitShields) {
      ob.angle += 4.6 * dt
      const bx = player.x + Math.cos(ob.angle) * ob.orbitR
      const by = player.y + Math.sin(ob.angle) * ob.orbitR
      const dmg = ob.entry.skill.dmgBase * (1 + (ob.entry.level - 1) * 0.28)
      queryNearbyEnemies(bx, by, ob.bladeR + 38, tempNearby)
      const list = tempNearby.slice()
      for (const e of list) {
        if (e.hp <= 0) continue
        if (gameTime - (ob.hitMap.get(e) || 0) < 0.23) continue
        const rs = e.radius + ob.bladeR
        if ((e.x - bx) ** 2 + (e.y - by) ** 2 <= rs * rs) { ob.hitMap.set(e, gameTime); hitEnemy(e, dmg, ob.entry.skill.color, true) }
      }
    }

    // 블랙홀
    for (let i = blackHoles.length - 1; i >= 0; i--) {
      const bh = blackHoles[i]
      bh.life -= dt
      bh.rot += 6 * dt
      if (bh.life <= 0) { blackHoles.splice(i, 1); continue }
      bh.tickTimer -= dt
      const tick = bh.tickTimer <= 0
      if (tick) bh.tickTimer = 0.25
      queryNearbyEnemies(bh.x, bh.y, bh.radius + 40, tempNearby)
      for (const e of tempNearby.slice()) {
        if (e.hp <= 0) continue
        const dx = bh.x - e.x
        const dy = bh.y - e.y
        const d = Math.hypot(dx, dy)
        if (d <= bh.radius + e.radius) {
          if (!e.isBoss && d > 4) { e.x += (dx / d) * 195 * dt; e.y += (dy / d) * 195 * dt }
          if (tick) hitEnemy(e, bh.dmg * 0.48, '#c068e8', false)
        }
      }
    }

    // 메테오
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i]
      m.timer -= dt
      if (m.timer <= 0) {
        SoundFX.play('meteor')
        shakeTimer = 0.18; shakeAmount = 6
        shockwaves.push({ x: m.tx, y: m.ty, radius: 10, maxRadius: m.radius, color: '#f85830', life: 0.28, maxLife: 0.28 })
        spawnParticles(m.tx, m.ty, '#f88828', 12, 220, 'debris')
        spawnParticles(m.tx, m.ty, '#ffd040', 8, 90, 'ember')
        addRing(m.tx, m.ty, '#ff9030', m.radius, 0.36, 7, true)
        addDecal(m.tx, m.ty, m.radius * 0.45)
        radialHit(m.tx, m.ty, m.radius, m.dmg, '#f85830')
        meteors.splice(i, 1)
      }
    }

    // 투사체
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]
      p.life -= dt
      if (p.life <= 0) { projectiles.splice(i, 1); continue }
      if (p.kind === 'boomerang') {
        p.age += dt
        if (p.age > 0.42) {
          const a = Math.atan2(player.y - p.y, player.x - p.x)
          p.vx += Math.cos(a) * 1450 * dt
          p.vy += Math.sin(a) * 1450 * dt
          const s = Math.hypot(p.vx, p.vy)
          if (s > 530) { p.vx = (p.vx / s) * 530; p.vy = (p.vy / s) * 530 }
          if (Math.hypot(player.x - p.x, player.y - p.y) < 20) { projectiles.splice(i, 1); continue }
        }
      } else if (p.kind === 'homing') {
        const t = getNearestEnemy(p.x, p.y, 460)
        if (t) {
          const desired = Math.atan2(t.y - p.y, t.x - p.x)
          const curr = Math.atan2(p.vy, p.vx)
          let diff = desired - curr
          while (diff > Math.PI) diff -= Math.PI * 2
          while (diff < -Math.PI) diff += Math.PI * 2
          const na = curr + diff * Math.min(1, 9 * dt)
          p.vx = Math.cos(na) * 390
          p.vy = Math.sin(na) * 390
        }
      }
      if (fxLevel === 2) {
        if (!p.trail) p.trail = []
        p.trail.push(p.x, p.y)
        if (p.trail.length > 10) p.trail.splice(0, 2)
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      queryNearbyEnemies(p.x, p.y, p.radius + 38, tempNearby)
      const list = tempNearby.slice()
      for (const e of list) {
        if (e.hp <= 0 || p.hitSet.has(e)) continue
        const rs = e.radius + p.radius
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= rs * rs) {
          p.hitSet.add(e)
          if (p.kind === 'iceShard') e.freezeTimer = 1.4
          hitEnemy(e, p.dmg, p.color, true)
          if (--p.pierce <= 0) { projectiles.splice(i, 1); break }
        }
      }
    }

    // 회오리 지대
    for (let i = zones.length - 1; i >= 0; i--) {
      const z = zones[i]
      z.life -= dt
      z.rot += 8 * dt
      z.x += z.vx * dt
      z.y += z.vy * dt
      if (z.life <= 0) { zones.splice(i, 1); continue }
      z.tickTimer -= dt
      if (z.tickTimer <= 0) { z.tickTimer = 0.28; radialHit(z.x, z.y, z.radius, z.dmg * 0.55, z.color) }
    }

    // 몬스터 이동·충돌
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i]
      if (e.hp <= 0) { enemies.splice(i, 1); continue }
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt)
      if (e.freezeTimer > 0) e.freezeTimer = Math.max(0, e.freezeTimer - dt)
      e.animTime += dt * 6
      const dx = player.x - e.x
      const dy = player.y - e.y
      const dist = Math.hypot(dx, dy)
      if (!e.isBoss && dist > 1650) { enemies.splice(i, 1); continue }
      const inv = dist > 0.001 ? 1 / dist : 0
      if (dx < -2) e.facingLeft = true
      else if (dx > 2) e.facingLeft = false
      const sf = e.freezeTimer > 0 ? 0.35 : 1

      if (e.isBoss) {
        if (e.telegraph) {
          e.telegraph.timer -= dt
          if (e.telegraph.timer <= 0) {
            const t = e.telegraph
            e.telegraph = null
            shakeTimer = 0.2; shakeAmount = 8
            shockwaves.push({ x: t.tx, y: t.ty, radius: 12, maxRadius: t.radius, color: '#e83830', life: 0.3, maxLife: 0.3 })
            spawnParticles(t.tx, t.ty, '#e83830', 14, 220, 'debris')
            addRing(t.tx, t.ty, '#ff6040', t.radius * 1.3, 0.4, 6, true)
            addDecal(t.tx, t.ty, t.radius * 0.7)
            if (Math.hypot(player.x - t.tx, player.y - t.ty) <= t.radius + player.radius) {
              damagePlayer(e.dmg)
              if (gameState === 'GAMEOVER') return
            }
          }
        } else {
          e.x += dx * inv * e.speed * sf * dt
          e.y += dy * inv * e.speed * sf * dt
          e.attackTimer -= dt
          if (e.attackTimer <= 0 && dist < 310) {
            e.attackTimer = 2.9
            e.telegraph = { tx: player.x, ty: player.y, radius: 90, timer: 0.9, maxTimer: 0.9 }
          }
        }
      } else {
        e.x += dx * inv * e.speed * sf * dt
        e.y += dy * inv * e.speed * sf * dt
      }

      const cx = Math.floor(e.x / GRID_CELL)
      const cy = Math.floor(e.y / GRID_CELL)
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const bucket = spatialGrid.get((cx + ox) + ',' + (cy + oy))
          if (!bucket) continue
          for (const o of bucket) {
            if (o === e || o.hp <= 0) continue
            const sdx = e.x - o.x
            const sdy = e.y - o.y
            const d2 = sdx * sdx + sdy * sdy
            const minD = e.radius + o.radius
            if (d2 > 0.0001 && d2 < minD * minD) {
              const sd = Math.sqrt(d2)
              const push = (minD - sd) * 0.25
              e.x += (sdx / sd) * push; e.y += (sdy / sd) * push
              o.x -= (sdx / sd) * push; o.y -= (sdy / sd) * push
            }
          }
        }
      }

      const hitR = e.radius + player.radius - 2
      if (dx * dx + dy * dy < hitR * hitR) {
        damagePlayer(e.dmg)
        if (gameState === 'GAMEOVER') return
      }
    }

    // 경험치 보석
    for (let i = xpGems.length - 1; i >= 0; i--) {
      const g = xpGems[i]
      const dx = player.x - g.x
      const dy = player.y - g.y
      const d2 = dx * dx + dy * dy
      if (d2 <= player.magnetRange * player.magnetRange) g.magnet = true
      if (g.magnet && d2 > 0.0001) {
        const d = Math.sqrt(d2)
        g.x += (dx / d) * 490 * dt
        g.y += (dy / d) * 490 * dt
      }
      const pr = player.radius + 14
      if (d2 < pr * pr) {
        SoundFX.play('xp')
        player.xp += g.val * player.xpMult
        xpGems.splice(i, 1)
        let leveled = false
        while (player.xp >= getXpNeeded(player.level)) {
          player.xp -= getXpNeeded(player.level)
          player.level++
          player.hp = Math.min(player.maxHp, player.hp + 10)
          leveled = true
          pushModal({ type: 'levelup', isAutoMinute: false, levelSnapshot: player.level })
        }
        if (leveled) {
          levelFx()
          hitstopTimer = 0.02
          shakeTimer = 0.14; shakeAmount = 4
          shockwaves.push({ x: player.x, y: player.y, radius: 10, maxRadius: 165, color: '#f8d838', life: 0.28, maxLife: 0.28 })
          spawnParticles(player.x, player.y, '#f8d838', 12, 155)
        }
      }
    }

    // 보물 상자
    for (let i = chests.length - 1; i >= 0; i--) {
      const c = chests[i]
      c.bob += dt * 5
      const d = Math.hypot(player.x - c.x, player.y - c.y)
      if (d < player.magnetRange && d > 0.001) {
        c.x += ((player.x - c.x) / d) * 320 * dt
        c.y += ((player.y - c.y) / d) * 320 * dt
      }
      if (d < player.radius + 18) { chests.splice(i, 1); pushModal({ type: 'relic' }) }
    }

    // 이펙트
    for (let i = beams.length - 1; i >= 0; i--) if ((beams[i].life -= dt) <= 0) beams.splice(i, 1)
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i]
      sw.life -= dt
      sw.radius += (sw.maxRadius - sw.radius) * 11 * dt
      if (sw.life <= 0) shockwaves.splice(i, 1)
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i]
      pt.life -= dt
      pt.vy += pt.g * dt
      if (pt.kind !== 'ember') { pt.vx *= 1 - 2.2 * dt; if (pt.kind !== 'debris') pt.vy *= 1 - 2.2 * dt }
      pt.x += pt.vx * dt
      pt.y += pt.vy * dt
      if (pt.life <= 0) particles.splice(i, 1)
    }

    emitHud(false)
    flushModalQueue()
  }

  // ---------------------------------------------------------------------------
  // 렌더링
  // ---------------------------------------------------------------------------
  function blitSprite(img, x, y, flipX, scale = 1) {
    ctx.save()
    ctx.translate(Math.round(x), Math.round(y))
    if (flipX) ctx.scale(-1, 1)
    if (scale !== 1) {
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      ctx.drawImage(img, Math.round(-w / 2), Math.round(-h / 2), w, h)
    } else {
      ctx.drawImage(img, Math.round(-img.width / 2), Math.round(-img.height / 2))
    }
    ctx.restore()
  }

  function render(realDt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#1c3a24'
    ctx.fillRect(0, 0, width, height)
    const T = performance.now() * 0.001
    const hi = fxLevel === 2

    camZoom += (1 - camZoom) * Math.min(1, realDt * 4)
    const sx = shakeTimer > 0 ? Math.round((Math.random() - 0.5) * shakeAmount * 2) : 0
    const sy = shakeTimer > 0 ? Math.round((Math.random() - 0.5) * shakeAmount * 2) : 0
    const camX = Math.round(player.x - width / 2 + sx)
    const camY = Math.round(player.y - height / 2 + sy)

    ctx.save()
    if (camZoom > 1.0005) {
      ctx.translate(width / 2, height / 2)
      ctx.scale(camZoom, camZoom)
      ctx.translate(-width / 2, -height / 2)
    }
    ctx.translate(-camX, -camY)
    const onScreen = (x, y, m = 40) => x > camX - m && x < camX + width + m && y > camY - m && y < camY + height + m

    // 1) 바닥 타일
    const c0 = Math.floor(camX / CHUNK_SIZE) - 1
    const c1 = Math.ceil((camX + width) / CHUNK_SIZE) + 1
    const r0 = Math.floor(camY / CHUNK_SIZE) - 1
    const r1 = Math.ceil((camY + height) / CHUNK_SIZE) + 1
    const visibleProps = []
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        ctx.drawImage(getForestChunk(c, r), c * CHUNK_SIZE, r * CHUNK_SIZE)
        for (const p of getChunkProps(c, r)) visibleProps.push(p)
      }
    }

    // 2) 바닥 그을림 자국
    for (const d of decals) {
      const a = Math.min(1, (d.life / d.maxLife) * 1.6) * 0.42
      ctx.globalAlpha = a
      ctx.fillStyle = d.color
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.62, 0, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = a * 0.8
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r * 0.55, d.r * 0.34, 0, 0, Math.PI * 2); ctx.fill()
    }
    ctx.globalAlpha = 1

    // 3) 블랙홀 · 회오리
    for (const bh of blackHoles) {
      ctx.save()
      ctx.translate(Math.round(bh.x), Math.round(bh.y))
      ctx.fillStyle = 'rgba(16,6,28,0.82)'
      ctx.beginPath(); ctx.arc(0, 0, bh.radius * 0.42, 0, Math.PI * 2); ctx.fill()
      for (let k = 0; k < 3; k++) {
        ctx.rotate(bh.rot * (0.6 + k * 0.3))
        ctx.strokeStyle = k === 1 ? '#f8a8ff' : '#c068e8'
        ctx.lineWidth = 3 - k * 0.6
        ctx.beginPath(); ctx.arc(0, 0, bh.radius * (0.55 + k * 0.22), 0, Math.PI * 1.1); ctx.stroke()
      }
      ctx.restore()
    }
    for (const z of zones) {
      ctx.save()
      ctx.translate(Math.round(z.x), Math.round(z.y))
      ctx.rotate(z.rot)
      ctx.strokeStyle = z.color; ctx.lineWidth = 3
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath(); ctx.arc(0, 0, z.radius * (0.38 + ring * 0.28), ring, ring + Math.PI * 1.25); ctx.stroke()
      }
      ctx.restore()
    }

    // 4) 경험치 보석
    for (const g of xpGems) {
      if (!onScreen(g.x, g.y, 24)) continue
      const gx = Math.round(g.x)
      const gy = Math.round(g.y + Math.sin(T * 5 + g.x * 0.05) * 1.5)
      const col = g.tier === 'gold' ? '#f8d838' : g.tier === 'blue' ? '#4898f8' : '#48d858'
      const hw = g.tier === 'gold' ? 4 : 3
      const hh = g.tier === 'gold' ? 5 : 4
      ctx.fillStyle = '#182018'; ctx.fillRect(gx - hw - 1, gy - hh - 1, (hw + 1) * 2, (hh + 1) * 2)
      ctx.fillStyle = col; ctx.fillRect(gx - hw, gy - hh, hw * 2, hh * 2)
      ctx.fillStyle = '#fff'; ctx.fillRect(gx - hw + 1, gy - hh + 1, 2, 2)
    }

    // 5) 보물상자 (빛기둥)
    for (const c of chests) {
      const bobY = Math.round(Math.sin(c.bob) * 3)
      const pulse = 0.5 + Math.sin(T * 4) * 0.2
      const grad = ctx.createLinearGradient(0, c.y - 90, 0, c.y)
      grad.addColorStop(0, 'rgba(248,216,56,0)')
      grad.addColorStop(1, `rgba(248,216,56,${pulse})`)
      ctx.fillStyle = grad
      ctx.fillRect(Math.round(c.x) - 12, Math.round(c.y) - 90, 24, 90)
      blitSprite(ATLAS.chest, c.x, c.y + bobY, false)
    }

    // 6) 보스 공격 예고
    for (const e of enemies) {
      if (e.isBoss && e.telegraph) {
        const t = e.telegraph
        const prog = 1 - t.timer / t.maxTimer
        ctx.fillStyle = `rgba(232,56,48,${0.16 + 0.14 * Math.abs(Math.sin(T * 18))})`
        ctx.beginPath(); ctx.arc(t.tx, t.ty, t.radius, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#ff5040'; ctx.lineWidth = 3
        ctx.beginPath(); ctx.arc(t.tx, t.ty, t.radius, 0, Math.PI * 2); ctx.stroke()
        ctx.lineWidth = 5
        ctx.beginPath(); ctx.arc(t.tx, t.ty, t.radius * prog, 0, Math.PI * 2); ctx.stroke()
      }
    }

    // 7) 깊이 정렬: 소품·몬스터·트레이너·정령
    const dq = []
    for (const pr of visibleProps) dq.push({ sortY: pr.sortY, kind: 'prop', prop: pr })
    for (const e of enemies) {
      if (e.hp <= 0 || !onScreen(e.x, e.y, 64)) continue
      dq.push({ sortY: e.y + e.radius, kind: 'enemy', enemy: e })
    }
    dq.push({ sortY: player.spiritY + 8, kind: 'spirit' })
    dq.push({ sortY: player.y + 12, kind: 'player' })
    dq.sort((a, b) => a.sortY - b.sortY)

    for (const item of dq) {
      if (item.kind === 'prop') {
        const pr = item.prop
        if (pr.kind === 'tree') {
          ctx.fillStyle = 'rgba(24,32,24,0.32)'; ctx.fillRect(pr.x - 16, pr.y + 10, 32, 7)
          blitSprite(ATLAS.tree, pr.x, pr.y, false)
        } else if (pr.kind === 'stump') {
          ctx.fillStyle = '#182018'; ctx.fillRect(pr.x - 14, pr.y - 8, 28, 18)
          ctx.fillStyle = '#885028'; ctx.fillRect(pr.x - 12, pr.y - 2, 24, 10)
          ctx.fillStyle = '#d8a868'; ctx.fillRect(pr.x - 12, pr.y - 6, 24, 7)
        } else {
          ctx.fillStyle = '#182018'; ctx.fillRect(pr.x - 12, pr.y - 6, 24, 14)
          ctx.fillStyle = '#788880'; ctx.fillRect(pr.x - 10, pr.y - 4, 20, 10)
          ctx.fillStyle = '#389848'; ctx.fillRect(pr.x - 8, pr.y - 4, 10, 4)
        }
      } else if (item.kind === 'enemy') {
        const e = item.enemy
        const ex = Math.round(e.x)
        const ey = Math.round(e.y)
        ctx.fillStyle = 'rgba(24,32,24,0.38)'
        ctx.fillRect(ex - e.radius + 2, ey + e.radius - 5, (e.radius - 2) * 2, 6)
        const flashOn = e.hitFlash > 0
        if (e.isBoss) {
          const bob = Math.round(Math.sin(e.animTime) * 2)
          // 보스 뒤 붉은 오라
          ctx.globalCompositeOperation = 'lighter'
          drawGlow(ctx, e.color, ex, ey, e.radius * 2.6, 0.45 + Math.sin(T * 6) * 0.15)
          ctx.globalCompositeOperation = 'source-over'
          blitSprite(flashOn ? ATLAS.bossesFlash[e.sprite] : ATLAS.bosses[e.sprite], ex, ey + bob, e.facingLeft)
        } else {
          const frame = Math.floor(e.animTime) % 2
          const sp = flashOn ? ATLAS.enemiesFlash[e.sprite][frame] : ATLAS.enemies[e.sprite][frame]
          if (e.elite) {
            ctx.globalCompositeOperation = 'lighter'
            drawGlow(ctx, '#f8d838', ex, ey, e.radius * 2.2, 0.55 + Math.sin(T * 8) * 0.2)
            ctx.globalCompositeOperation = 'source-over'
          }
          blitSprite(sp, ex, ey, e.facingLeft, e.scale || 1)
        }
        if (e.freezeTimer > 0) {
          ctx.fillStyle = 'rgba(104,216,248,0.45)'
          ctx.fillRect(ex - e.radius, ey - e.radius, e.radius * 2, e.radius * 2)
        }
      } else if (item.kind === 'spirit') {
        const spX = Math.round(player.spiritX)
        const spY = Math.round(player.spiritY)
        const scol = ['#78d858', '#68d8f8', '#f8d838'][cfg.spiritStage] || '#78d858'
        ctx.globalCompositeOperation = 'lighter'
        drawGlow(ctx, scol, spX, spY, 18 + cfg.spiritStage * 6, 0.5 + Math.sin(T * 5) * 0.15)
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = 'rgba(24,32,24,0.35)'; ctx.fillRect(spX - 8, spY + 8, 16, 4)
        blitSprite(ATLAS.spirits[cfg.spiritStage] || ATLAS.spirits[0], spX, spY, player.facingLeft, 1 + cfg.spiritStage * 0.15)
      } else {
        const px = Math.round(player.x)
        const py = Math.round(player.y)
        // 발밑 오라
        ctx.globalCompositeOperation = 'lighter'
        drawGlow(ctx, player.invuln > 1 ? '#ffb040' : '#68f0a0', px, py + 8, 30, 0.28 + Math.sin(T * 3) * 0.08)
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = 'rgba(24,32,24,0.45)'; ctx.fillRect(px - 10, py + 11, 20, 5)
        if (player.invuln <= 0 || Math.floor(player.invuln * 20) % 2 === 0) {
          blitSprite(ATLAS.trainer[Math.floor(player.walkAnim) % 2], px, py, player.facingLeft)
        }
        if (gameState !== 'MENU') {
          const w = 32
          const ratio = Math.max(0, player.hp / player.maxHp)
          ctx.fillStyle = '#182018'; ctx.fillRect(px - w / 2 - 1, py + 18, w + 2, 6)
          ctx.fillStyle = '#485058'; ctx.fillRect(px - w / 2, py + 19, w, 4)
          ctx.fillStyle = ratio > 0.5 ? '#38b848' : ratio > 0.25 ? '#f8c820' : '#e83830'
          ctx.fillRect(px - w / 2, py + 19, Math.round(w * ratio), 4)
        }
      }
    }

    // 8) 튀어 떨어지는 파편 (일반 합성)
    for (const pt of particles) {
      if (pt.kind !== 'debris') continue
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife)
      ctx.fillStyle = '#182018'
      ctx.fillRect(Math.round(pt.x) - 1, Math.round(pt.y) - 1, pt.size + 2, pt.size + 2)
      ctx.fillStyle = pt.color
      ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size)
    }
    ctx.globalAlpha = 1

    // ===================== 빛 레이어 (가산 합성) =====================
    ctx.globalCompositeOperation = 'lighter'

    if (hi) {
      for (const g of xpGems) {
        if (!onScreen(g.x, g.y, 24)) continue
        const col = g.tier === 'gold' ? '#f8d838' : g.tier === 'blue' ? '#4898f8' : '#48d858'
        drawGlow(ctx, col, g.x, g.y, g.tier === 'gold' ? 18 : 12, 0.55 + Math.sin(T * 6 + g.x) * 0.2)
      }
    }
    for (const c of chests) drawGlow(ctx, '#f8d838', c.x, c.y, 46, 0.6 + Math.sin(T * 4) * 0.2)
    for (const bh of blackHoles) drawGlow(ctx, '#a040e0', bh.x, bh.y, bh.radius * 1.1, 0.5)
    for (const z of zones) drawGlow(ctx, z.color, z.x, z.y, z.radius * 1.3, 0.4)

    // 레벨업 빛기둥
    for (const pl of pillars) {
      const k = pl.life / pl.maxLife
      const w = 46 * (0.4 + k * 0.6)
      const col = pl.color || '#ffe878'
      const grad = ctx.createLinearGradient(0, pl.y - 420, 0, pl.y + 20)
      grad.addColorStop(0, 'rgba(255,240,160,0)')
      grad.addColorStop(0.7, `rgba(255,240,160,${0.45 * k})`)
      grad.addColorStop(1, `rgba(255,255,255,${0.8 * k})`)
      ctx.fillStyle = grad
      ctx.fillRect(pl.x - w / 2, pl.y - 420, w, 440)
      drawGlow(ctx, col, pl.x, pl.y + 6, 70, k)
    }

    // 회전 잎날 + 잔상
    for (const ob of orbitShields) {
      for (let k = hi ? 3 : 1; k >= 1; k--) {
        const a = ob.angle - k * 0.16
        drawGlow(ctx, '#48d858', player.x + Math.cos(a) * ob.orbitR, player.y + Math.sin(a) * ob.orbitR, 14 - k * 2, 0.5 / k)
      }
      drawGlow(ctx, '#88ff98', player.x + Math.cos(ob.angle) * ob.orbitR, player.y + Math.sin(ob.angle) * ob.orbitR, 16, 0.7)
    }
    if (player.relics.dragonScaleArmor) {
      const oR = 72 * player.areaMult
      for (let b = 0; b < 4; b++) {
        const a = player.dragonBladeAngle + (b * Math.PI) / 2
        for (let k = 0; k < (hi ? 3 : 1); k++) {
          const aa = a - k * 0.18
          drawGlow(ctx, '#ff6030', player.x + Math.cos(aa) * oR, player.y + Math.sin(aa) * oR, 20 - k * 4, 0.6 - k * 0.15)
        }
      }
    }

    // 투사체 꼬리 + 빛
    for (const p of projectiles) {
      if (!onScreen(p.x, p.y)) continue
      if (p.trail) {
        const n = p.trail.length / 2
        for (let k = 0; k < n; k++) {
          const f = (k + 1) / (n + 1)
          drawGlow(ctx, p.color, p.trail[k * 2], p.trail[k * 2 + 1], p.radius * (1.2 + f), f * 0.55)
        }
      }
      drawGlow(ctx, p.color, p.x, p.y, p.radius * 3.4, 0.85)
    }

    // 레이저 · 번개
    ctx.lineCap = 'round'
    for (const b of beams) {
      const alpha = Math.max(0, b.life / b.maxLife)
      if (b.isLaser) {
        const flick = 0.85 + Math.random() * 0.3
        ctx.globalAlpha = alpha * 0.35
        ctx.strokeStyle = b.color; ctx.lineWidth = b.width * 2.4 * flick
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke()
        ctx.globalAlpha = alpha * 0.85
        ctx.lineWidth = b.width * flick
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke()
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(2, b.width * 0.3)
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke()
        ctx.globalAlpha = 1
        drawGlow(ctx, b.color, b.x2, b.y2, b.width * 2, alpha)
        drawGlow(ctx, '#ffffff', b.x1, b.y1, b.width * 1.6, alpha * 0.8)
      } else {
        const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1)
        const pts = jaggedPoints(b.x1, b.y1, b.x2, b.y2, Math.max(3, Math.min(8, Math.round(len / 24))), Math.min(18, len * 0.15))
        ctx.globalAlpha = alpha * 0.45
        ctx.strokeStyle = b.color; ctx.lineWidth = 7
        strokePts(ctx, pts)
        ctx.globalAlpha = alpha
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2
        strokePts(ctx, pts)
        if (hi && len > 60) {
          const m = pts[Math.floor(pts.length / 2)]
          const br = jaggedPoints(m[0], m[1], m[0] + (Math.random() - 0.5) * 50, m[1] + (Math.random() - 0.5) * 50, 3, 8)
          ctx.globalAlpha = alpha * 0.6; ctx.strokeStyle = b.color; ctx.lineWidth = 2
          strokePts(ctx, br)
        }
        ctx.globalAlpha = 1
        drawGlow(ctx, b.color, b.x2, b.y2, 22, alpha)
      }
    }

    // 충격파
    for (const sw of shockwaves) {
      const a = Math.max(0, sw.life / sw.maxLife)
      if (sw.fill) drawGlow(ctx, sw.color, sw.x, sw.y, sw.radius * 1.05, a * 0.55)
      ctx.globalAlpha = a * 0.45
      ctx.strokeStyle = sw.color; ctx.lineWidth = (sw.width || 3) * 2.6 * a + 2
      ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = a
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.max(1, (sw.width || 3) * 0.6 * a)
      ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.globalAlpha = 1

    // 빛 파티클
    for (const pt of particles) {
      if (pt.kind === 'debris') continue
      const a = Math.max(0, pt.life / pt.maxLife)
      if (pt.kind === 'spark') {
        ctx.globalAlpha = a
        ctx.strokeStyle = pt.color; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x - pt.vx * 0.05, pt.y - pt.vy * 0.05); ctx.stroke()
        ctx.globalAlpha = 1
      } else if (pt.kind === 'ember') {
        drawGlow(ctx, pt.color, pt.x + Math.sin(T * 6 + pt.y * 0.1) * 3, pt.y, 8, a)
      } else {
        if (hi) drawGlow(ctx, pt.color, pt.x, pt.y, 9, a * 0.7)
        ctx.globalAlpha = a
        ctx.fillStyle = pt.color
        ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size)
        ctx.globalAlpha = 1
      }
    }

    // 메테오 불꽃
    for (const m of meteors) {
      const prog = 1 - m.timer / m.maxTimer
      const mx = m.tx + 120 * (1 - prog)
      const my = m.ty - 360 * (1 - prog)
      for (let k = 1; k <= 4; k++) drawGlow(ctx, '#ff7020', mx + k * 14, my - k * 40, 26 - k * 4, 0.5 - k * 0.1)
      drawGlow(ctx, '#ffb040', mx, my, 40, 0.9)
      drawGlow(ctx, '#ff3020', m.tx, m.ty, m.radius * prog, 0.25)
    }

    ctx.globalCompositeOperation = 'source-over'
    // ================================================================

    // 투사체 본체
    for (const p of projectiles) {
      if (!onScreen(p.x, p.y)) continue
      const rx = Math.round(p.x)
      const ry = Math.round(p.y)
      const inner = Math.max(3, Math.round(p.radius * 0.8))
      ctx.fillStyle = p.color; ctx.fillRect(rx - p.radius, ry - p.radius, p.radius * 2, p.radius * 2)
      ctx.fillStyle = '#fff'; ctx.fillRect(rx - Math.floor(inner / 2), ry - Math.floor(inner / 2), inner, inner)
    }
    // 잎날 본체
    for (const ob of orbitShields) {
      const bx = Math.round(player.x + Math.cos(ob.angle) * ob.orbitR)
      const by = Math.round(player.y + Math.sin(ob.angle) * ob.orbitR)
      ctx.save(); ctx.translate(bx, by); ctx.rotate(ob.angle * 2)
      ctx.fillStyle = '#182018'; ctx.fillRect(-9, -5, 18, 10)
      ctx.fillStyle = '#48d858'; ctx.fillRect(-8, -4, 16, 8)
      ctx.fillStyle = '#d8ffc8'; ctx.fillRect(-5, -2, 10, 3)
      ctx.restore()
    }
    if (player.relics.dragonScaleArmor) {
      const oR = 72 * player.areaMult
      for (let b = 0; b < 4; b++) {
        const a = player.dragonBladeAngle + (b * Math.PI) / 2
        ctx.save()
        ctx.translate(Math.round(player.x + Math.cos(a) * oR), Math.round(player.y + Math.sin(a) * oR))
        ctx.rotate(a + Math.PI / 2)
        ctx.fillStyle = '#182018'; ctx.fillRect(-5, -13, 10, 26)
        ctx.fillStyle = '#f85830'; ctx.fillRect(-4, -12, 8, 24)
        ctx.fillStyle = '#ffe878'; ctx.fillRect(-2, -9, 4, 18)
        ctx.restore()
      }
    }
    // 메테오 본체
    for (const m of meteors) {
      const prog = 1 - m.timer / m.maxTimer
      ctx.strokeStyle = '#ff5030'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(m.tx, m.ty, m.radius * prog, 0, Math.PI * 2); ctx.stroke()
      const mx = Math.round(m.tx + 120 * (1 - prog))
      const my = Math.round(m.ty - 360 * (1 - prog))
      ctx.fillStyle = '#182018'; ctx.fillRect(mx - 14, my - 14, 28, 28)
      ctx.fillStyle = '#f85830'; ctx.fillRect(mx - 12, my - 12, 24, 24)
      ctx.fillStyle = '#f8d838'; ctx.fillRect(mx - 7, my - 7, 14, 14)
      ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - 3, my - 3, 6, 6)
    }

    // 데미지 숫자
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    for (const t of dmgTexts) {
      const a = Math.min(1, (t.life / t.maxLife) * 2)
      const age = 1 - t.life / t.maxLife
      const sc = t.crit ? 1 + Math.max(0, 0.6 - age * 3) : 1
      const size = Math.round((t.crit ? 17 : 12) * sc)
      ctx.globalAlpha = a
      ctx.font = `900 ${size}px 'Courier New', monospace`
      ctx.lineWidth = 3; ctx.strokeStyle = '#182018'
      const label = t.crit ? t.v + '!' : String(t.v)
      ctx.strokeText(label, t.x, t.y)
      ctx.fillStyle = t.crit ? '#ffe040' : '#ffffff'
      ctx.fillText(label, t.x, t.y)
    }
    // 큰 글씨 (LEVEL UP 등)
    for (const t of floatTexts) {
      const age = 1 - t.life / t.maxLife
      const sc = easeOutBack(Math.min(1, age * 4))
      ctx.globalAlpha = Math.min(1, (t.life / t.maxLife) * 2.5)
      ctx.font = `900 ${Math.round(t.size * sc)}px -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`
      ctx.lineWidth = 5; ctx.strokeStyle = '#182018'
      ctx.strokeText(t.text, t.x, t.y)
      ctx.fillStyle = t.color
      ctx.fillText(t.text, t.x, t.y)
    }
    ctx.globalAlpha = 1
    ctx.restore()

    // ===================== 화면 공간 레이어 =====================
    for (const t of mods.tints) { ctx.fillStyle = t; ctx.fillRect(0, 0, width, height) }
    if (gameState !== 'MENU' && (cfg.night || mods.fog)) {
      const pxs = player.x - camX
      const pys = player.y - camY
      const inner = mods.fog ? 70 : 120
      const outer = mods.fog ? Math.min(width, height) * 0.42 : Math.max(width, height) * 0.62
      const dark = mods.fog && cfg.night ? 0.82 : mods.fog ? 0.72 : 0.55
      const col = mods.fog ? '200,210,205' : '8,14,40'
      const grad = ctx.createRadialGradient(pxs, pys, inner, pxs, pys, outer)
      grad.addColorStop(0, `rgba(${col},0)`)
      grad.addColorStop(1, `rgba(${col},${dark})`)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, width, height)
    }

    // 분위기 파티클: 낮=흩날리는 잎, 밤=반딧불
    if (ambient.length) {
      const nightMode = cfg.night
      if (nightMode) ctx.globalCompositeOperation = 'lighter'
      for (const a of ambient) {
        a.ph += realDt
        if (nightMode) {
          a.x += Math.cos(a.ph * 0.7) * 12 * realDt
          a.y += Math.sin(a.ph * 0.9) * 10 * realDt
          drawGlow(ctx, '#d8ff70', a.x, a.y, 10 + a.s * 2, 0.35 + Math.sin(a.ph * 3) * 0.3)
        } else {
          a.y += a.sp * realDt
          a.x += Math.sin(a.ph) * 14 * realDt - 6 * realDt
          ctx.save()
          ctx.translate(a.x, a.y); ctx.rotate(a.ph * 2)
          ctx.fillStyle = a.s > 3.5 ? 'rgba(248,216,56,0.6)' : 'rgba(120,216,88,0.6)'
          ctx.fillRect(-a.s, -a.s / 2, a.s * 2, a.s)
          ctx.restore()
        }
        if (a.y > height + 10) { a.y = -10; a.x = Math.random() * width }
        if (a.x < -10) a.x = width + 10
        if (a.x > width + 10) a.x = -10
        if (a.y < -10) a.y = height + 10
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    // 체력 낮을 때 붉은 테두리 맥박
    if (gameState === 'PLAYING' && player.hp / player.maxHp < 0.3) {
      const pulse = 0.35 + Math.sin(T * 7) * 0.15
      const g2 = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75)
      g2.addColorStop(0, 'rgba(200,0,0,0)')
      g2.addColorStop(1, `rgba(200,0,0,${pulse})`)
      ctx.fillStyle = g2
      ctx.fillRect(0, 0, width, height)
    }

    // 화면 번쩍임
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]
      ctx.globalAlpha = Math.max(0, f.a)
      ctx.fillStyle = f.color
      ctx.fillRect(0, 0, width, height)
      f.a -= f.decay * realDt
      if (f.a <= 0) flashes.splice(i, 1)
    }
    ctx.globalAlpha = 1

    // 콤보 카운터
    if (combo >= 5 && gameState !== 'MENU') {
      const a = Math.min(1, comboTimer / 0.5)
      const sc = 1 + comboPop * 0.35
      const col = combo >= 100 ? RAINBOW[Math.floor(T * 10) % RAINBOW.length] : combo >= 50 ? '#ffe040' : combo >= 25 ? '#7fe0ff' : '#ffffff'
      const cx = width - 14
      const cy = Math.max(170, height * 0.3)
      ctx.save()
      ctx.globalAlpha = a
      ctx.translate(cx, cy); ctx.scale(sc, sc)
      ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'
      ctx.font = "900 34px 'Courier New', monospace"
      ctx.lineWidth = 6; ctx.strokeStyle = '#182018'; ctx.lineJoin = 'round'
      ctx.strokeText(String(combo), 0, 0)
      ctx.fillStyle = col; ctx.fillText(String(combo), 0, 0)
      ctx.font = "900 12px 'Courier New', monospace"
      ctx.lineWidth = 4
      ctx.strokeText('COMBO', 0, 16)
      ctx.fillStyle = '#ffffff'; ctx.fillText('COMBO', 0, 16)
      ctx.fillStyle = col
      ctx.fillRect(-70, 22, 70 * Math.min(1, comboTimer / 1.6), 3)
      ctx.restore()
    }

    // 보스 등장 연출 (레터박스 + 이름 카드)
    if (bossIntro) {
      bossIntro.t += realDt
      const t = bossIntro.t
      const d = bossIntro.dur
      const inK = easeOutCubic(Math.min(1, t / 0.35))
      const outK = t > d - 0.4 ? easeOutCubic(Math.min(1, (t - (d - 0.4)) / 0.4)) : 0
      const k = inK * (1 - outK)
      const bar = height * 0.11 * k
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, width, bar)
      ctx.fillRect(0, height - bar, width, bar)
      const slide = (1 - easeOutBack(Math.min(1, t / 0.5))) * width
      ctx.save()
      ctx.globalAlpha = k
      const by = height * 0.42
      const grad = ctx.createLinearGradient(0, by - 40, 0, by + 40)
      grad.addColorStop(0, 'rgba(120,0,0,0)')
      grad.addColorStop(0.5, 'rgba(120,0,0,0.75)')
      grad.addColorStop(1, 'rgba(120,0,0,0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, by - 40, width, 80)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.font = "900 14px 'Courier New', monospace"
      ctx.fillStyle = Math.floor(t * 6) % 2 ? '#ff5050' : '#ffffff'
      ctx.fillText('⚠ WARNING ⚠  BOSS APPROACHING', width / 2 + slide * 0.3, by - 22)
      ctx.font = `900 ${Math.min(30, width / 13)}px -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`
      ctx.lineWidth = 6; ctx.strokeStyle = '#000'; ctx.lineJoin = 'round'
      const label = bossIntro.icon + ' ' + bossIntro.name
      ctx.strokeText(label, width / 2 + slide, by + 10)
      ctx.fillStyle = '#ffe8a0'
      ctx.fillText(label, width / 2 + slide, by + 10)
      ctx.restore()
      if (t >= d) bossIntro = null
    }

    // 화면 밖 보물상자 방향 표시
    for (const c of chests) {
      const scX = c.x - camX
      const scY = c.y - camY
      if (scX < 28 || scX > width - 28 || scY < 90 || scY > height - 90) {
        const a = Math.atan2(c.y - player.y, c.x - player.x)
        const ax = Math.round(Math.max(32, Math.min(width - 32, width / 2 + Math.cos(a) * width * 0.42)))
        const ay = Math.round(Math.max(110, Math.min(height - 110, height / 2 + Math.sin(a) * height * 0.42)))
        const bob = Math.round(Math.sin(T * 8) * 2)
        ctx.globalCompositeOperation = 'lighter'
        drawGlow(ctx, '#f8d838', ax, ay + bob, 34, 0.7)
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = '#f8f8f0'; ctx.fillRect(ax - 15, ay - 15 + bob, 30, 30)
        ctx.strokeStyle = '#202830'; ctx.lineWidth = 2; ctx.strokeRect(ax - 15, ay - 15 + bob, 30, 30)
        blitSprite(ATLAS.chest, ax, ay + bob, false)
      }
    }

    // 가상 조이스틱
    if (stick.active && gameState === 'PLAYING') {
      const ox = Math.round(stick.ox)
      const oy = Math.round(stick.oy)
      const kx = Math.round(ox + stick.dx * stick.maxR)
      const ky = Math.round(oy + stick.dy * stick.maxR)
      ctx.save()
      ctx.fillStyle = 'rgba(248,248,240,0.18)'
      ctx.strokeStyle = 'rgba(248,248,240,0.55)'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.arc(ox, oy, stick.maxR, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.globalCompositeOperation = 'lighter'
      drawGlow(ctx, '#f8d838', kx, ky, 34, 0.5)
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#f8d838'; ctx.strokeStyle = '#202830'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(kx, ky, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
      ctx.restore()
    }
  }

  // ---------------------------------------------------------------------------
  // 입력
  // ---------------------------------------------------------------------------
  function onPointerDown(e) {
    if (gameState !== 'PLAYING' || stick.active) return
    SoundFX.unlock()
    Object.assign(stick, { active: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 })
  }
  function onPointerMove(e) {
    if (!stick.active || e.pointerId !== stick.id) return
    let rx = e.clientX - stick.ox
    let ry = e.clientY - stick.oy
    const dist = Math.hypot(rx, ry)
    // 손가락이 원 밖으로 멀리 나가면 조이스틱 중심이 따라온다 (모바일에서 훨씬 편함)
    if (dist > stick.maxR * 1.4) {
      const k = (dist - stick.maxR) / dist
      stick.ox += rx * k
      stick.oy += ry * k
      rx = e.clientX - stick.ox
      ry = e.clientY - stick.oy
    }
    const d2 = Math.hypot(rx, ry)
    if (d2 > 0.001) {
      const cl = Math.min(d2, stick.maxR)
      stick.dx = (rx / d2) * (cl / stick.maxR)
      stick.dy = (ry / d2) * (cl / stick.maxR)
    } else { stick.dx = 0; stick.dy = 0 }
  }
  function releaseStick(e) {
    if (stick.active && (!e || e.pointerId === undefined || e.pointerId === stick.id)) {
      stick.active = false; stick.id = null; stick.dx = 0; stick.dy = 0
    }
  }
  function onKeyDown(e) {
    keys[e.code] = true
    if (gameState === 'MODAL') {
      const idx = { Digit1: 0, Numpad1: 0, Digit2: 1, Numpad2: 1, Digit3: 2, Numpad3: 2 }[e.code]
      if (idx !== undefined) { e.preventDefault(); api.choose(idx) }
      if (e.code === 'KeyR') api.reroll()
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (gameState === 'PLAYING') api.pause()
      else if (gameState === 'PAUSED') api.resume()
    }
  }
  const onKeyUp = (e) => { keys[e.code] = false }

  canvas.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', releaseStick)
  window.addEventListener('pointercancel', releaseStick)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  // ---------------------------------------------------------------------------
  // 루프
  // ---------------------------------------------------------------------------
  let lastTime = performance.now()
  let rafId = 0
  let sleeping = false // 카드 모드일 때 서바이벌 화면은 그리지 않음
  function loop(now) {
    const realDt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000))
    lastTime = now
    // 슬로모션 (보스 처치·진화 순간)
    let dt = realDt
    if (slowmo.t > 0) {
      slowmo.t -= realDt
      dt *= slowmo.f
      if (slowmo.t <= 0) slowmo.f = 1
    }
    // 테스트용 배속 (?speed=3) — 한 프레임을 여러 번 나눠 계산해서 충돌 판정이 깨지지 않게 함
    if (sleeping) { rafId = requestAnimationFrame(loop); return }
    for (let s = 0; s < simSpeed; s++) update(dt)
    render(realDt)
    autoQuality(realDt)
    rafId = requestAnimationFrame(loop)
  }

  // 프레임이 계속 40 아래로 떨어지면 이펙트를 자동으로 가볍게
  function autoQuality(realDt) {
    if (!fxAuto || fxLevel < 2 || gameState !== 'PLAYING') { fpsAcc = 0; fpsFrames = 0; return }
    fpsAcc += realDt
    fpsFrames++
    if (fpsAcc >= 2) {
      const fps = fpsFrames / fpsAcc
      lowFpsStreak = fps < 40 ? lowFpsStreak + 1 : 0
      fpsAcc = 0; fpsFrames = 0
      if (lowFpsStreak >= 2) {
        fxLevel = 1
        initAmbient()
        banner('⚙️ 부드러운 플레이를 위해 이펙트를 가볍게 조정했어요')
        ui.onFx && ui.onFx(fxLevel)
      }
    }
  }
  rafId = requestAnimationFrame(loop)

  // ---------------------------------------------------------------------------
  // 외부(Vue)에서 쓰는 API
  // ---------------------------------------------------------------------------
  const api = {
    rebuildOrbitShields,
    get state() { return gameState },

    /**
     * cfg: { mutators: string[], bossTitle, night, spiritStage, upgrades: {id: lv} }
     */
    start(config) {
      SoundFX.unlock()
      cfg = { mutators: [], bossTitle: '', night: false, spiritStage: 0, upgrades: {}, ...config }
      mods = combineMutators(cfg.mutators)
      simSpeed = Math.max(1, Math.min(8, Math.floor(cfg.timeScale || 1)))
      worldSalt = (cfg.seed || 0) % 1000
      chunkCache.clear(); chunkPropsCache.clear()

      gameTime = 0; kills = 0; bossCount = 0; bossKills = 0; autoLevelCount = 0
      modalQueue = []; currentChoice = null; echoQueue = []
      hitstopTimer = 0; shakeTimer = 0; shakeAmount = 0; spawnTimer = 0.15; stormTimer = 5; chestTimer = 0
      peakMonsterMult = monsterMult
      resetPlayer()
      resetFx()

      // 영구 업그레이드 적용
      const u = cfg.upgrades || {}
      player.maxHp += (u.vit || 0) * 10
      player.dmgMult += (u.might || 0) * 0.05
      player.speed *= 1 + (u.swift || 0) * 0.04
      player.magnetRange *= 1 + (u.magnet || 0) * 0.12
      player.xpMult += (u.wisdom || 0) * 0.06
      player.critChance += (u.luck || 0) * 0.02
      rerollsLeft = u.reroll || 0
      revivesLeft = u.revive || 0
      spiritPowMult = 1 + (u.spiritPow || 0) * 0.2

      // 오늘의 변이 적용
      player.speed *= mods.playerSpeed
      player.cdMult *= mods.cdMult
      player.magnetRange *= mods.magnetMult
      player.dmgMult += mods.playerDmg
      player.maxHp = Math.round(player.maxHp * mods.playerHpMult)
      player.hp = player.maxHp

      addBaseSkill(SKILLS_60[0])

      enemies = []; projectiles = []; orbitShields = []; zones = []; blackHoles = []
      meteors = []; beams = []; shockwaves = []; xpGems = []; chests = []; particles = []
      releaseStick()

      const init = Math.min(80, 10 * monsterMult)
      for (let i = 0; i < init; i++) spawnEnemy('caterpillar')

      rebuildOrbitShields()
      emitDock()
      gameState = 'PLAYING'
      emitHud(true)
    },

    choose(idx) {
      if (gameState !== 'MODAL' || !currentChoice || !currentChoice.handlers[idx]) return
      currentChoice.handlers[idx]()
      closeChoiceAndResume()
    },

    reroll() {
      if (gameState !== 'MODAL' || !currentChoice || rerollsLeft <= 0) return
      rerollsLeft--
      SoundFX.play('double')
      if (currentChoice.type === 'relic') showRelicChoice(true)
      else showSkillChoice(currentChoice.info, true)
    },

    pause() {
      if (gameState !== 'PLAYING' && gameState !== 'MODAL') return
      pausedFrom = gameState
      gameState = 'PAUSED'
      releaseStick()
      ui.onPause && ui.onPause(true)
    },

    resume() {
      if (gameState !== 'PAUSED') return
      gameState = pausedFrom
      lastTime = performance.now()
      ui.onPause && ui.onPause(false)
    },

    quit() {
      if (gameState === 'PAUSED' || gameState === 'PLAYING') {
        gameState = 'PLAYING'
        player.hp = 0
        revivesLeft = 0
        triggerGameOver()
        ui.onPause && ui.onPause(false)
      }
    },

    doubleMult() {
      SoundFX.unlock()
      if (monsterMult >= 1024) { banner('🔥 이미 최대 x1024!'); return monsterMult }
      monsterMult *= 2
      if (monsterMult > peakMonsterMult) peakMonsterMult = monsterMult
      for (const e of enemies) {
        if (e.hp > 0 && !e.isBoss) { e.hp *= 2; e.maxHp *= 2; e.xpFactor = (e.xpFactor || 1) * 2 }
      }
      if (gameState === 'PLAYING') {
        const wave = Math.min(48, Math.max(4, monsterMult * 2))
        for (let w = 0; w < wave && enemies.length < MAX_ENEMIES; w++) spawnEnemy()
      }
      SoundFX.play('double')
      vibrate(20)
      banner('🔥 몬스터 x' + monsterMult + '! 리젠·체력·경험치 ' + monsterMult + '배')
      emitHud(true)
      return monsterMult
    },

    resetMult() {
      monsterMult = 1
      SoundFX.play('hit')
      banner('⚔️ 몬스터 배율 x1로 초기화')
      emitHud(true)
      return monsterMult
    },

    setMuted(m) { SoundFX.unlock(); SoundFX.muted = m },
    sleep(v) { sleeping = !!v; lastTime = performance.now() },

    /** 이펙트 품질: 2=화려, 1=가볍게. 사용자가 직접 고르면 자동 조절은 끔 */
    setFx(level) {
      fxLevel = level === 1 ? 1 : 2
      fxAuto = false
      initAmbient()
      ui.onFx && ui.onFx(fxLevel)
    },
    get fx() { return fxLevel },

    destroy() {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', handleResize)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', releaseStick)
      window.removeEventListener('pointercancel', releaseStick)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }
  return api
}
