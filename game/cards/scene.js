// 카드 배틀 무대 — 픽셀 몬스터와 화려한 이펙트를 캔버스에 그린다.
// 엔진이 보내는 이벤트(hit, kill, cast …)를 받아 연출하고, 매 프레임 run 상태를 읽어 그린다.
import { buildAtlas } from '../sprites.js'
import { drawGlow, jaggedPoints, strokePts, easeOutBack, easeOutCubic, RAINBOW } from '../fx.js'
import { SoundFX, vibrate } from '../sound.js'

const TYPE_COLOR = { grass: '#48d858', fire: '#f85830', water: '#48b8f8', electric: '#f8d830', psychic: '#d878f8', dragon: '#7888ff', fusion: '#ffe858' }
const STATUS_COLOR = { burn: '#ff7030', poison: '#68e858', freeze: '#88e0ff', shock: '#f8e030' }

export function createScene(canvas, getRun, opts = {}) {
  const ctx = canvas.getContext('2d')
  const ATLAS = buildAtlas()
  const isMobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 760
  let W = 0, H = 0, dpr = 1
  let bg = null
  let night = !!opts.night

  // 무대 영역 (위 상태바 ~ 아래 손패 사이)
  const stage = { top: 0, bottom: 0 }
  function resize() {
    const v = opts.view ? opts.view() : null
    W = v ? v.w : window.innerWidth
    H = v ? v.h : window.innerHeight
    dpr = Math.min((window.devicePixelRatio || 1) * (v ? v.z : 1), 3)
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    stage.top = 64
    stage.bottom = Math.max(stage.top + 220, H - (isMobile ? 250 : 270))
    bg = null
  }
  if (!opts.view) window.addEventListener('resize', resize)
  resize()

  // ── 연출 상태 ──
  let particles = []
  let texts = []
  let rings = []
  let bolts = []      // 번개·레이저
  let projs = []      // 날아가는 빛 구슬
  let flashes = []
  let delayed = []    // 시간차 실행
  let meteors = []
  let shake = 0
  let zoom = 1
  let banner = null
  let intro = null
  const anim = new Map() // 적 uid → { flash, lunge, death, spawn }
  let playerAnim = { flash: 0, cast: 0, hurt: 0 }
  const pendingDelay = new Map()
  let ambient = []

  const A = (uid) => {
    let a = anim.get(uid)
    if (!a) { a = { flash: 0, lunge: 0, death: 0, spawn: 0, born: performance.now() }; anim.set(uid, a) }
    return a
  }
  const later = (t, fn) => delayed.push({ t, fn })

  // ── 배치 ──
  function enemySlots(list) {
    const n = list.length
    const xs = n === 1 ? [0.68] : n === 2 ? [0.53, 0.83] : n === 3 ? [0.42, 0.66, 0.89] : [0.36, 0.54, 0.72, 0.9]
    const base = stage.bottom - 34
    return list.map((e, i) => {
      const sc = e.isBoss ? (isMobile ? 1.35 : 1.7) : (isMobile ? 2 : 2.4) * (e.scale || 1) * (n >= 4 ? 0.85 : 1)
      const img = e.isBoss ? ATLAS.bosses[e.sprite] : ATLAS.enemies[e.sprite][0]
      const w = img.width * sc
      const h = img.height * sc
      const stagger = n >= 3 && i % 2 === 1 ? -16 : 0
      return { e, x: AX() + AW() * xs[Math.min(i, xs.length - 1)], y: base + stagger, w, h, sc }
    })
  }
  // 넓은 화면에서도 전투가 가운데 모이도록 최대 960px 무대
  const AW = () => Math.min(W, 960)
  const AX = () => (W - AW()) / 2
  function playerPos() { return { x: AX() + AW() * (isMobile ? 0.15 : 0.2), y: stage.bottom - 30 } }
  function spiritPos() { const p = playerPos(); return { x: p.x + 34, y: p.y - 52 + Math.sin(performance.now() / 300) * 4 } }
  function slotOf(uid) {
    const run = getRun()
    if (!run?.battle) return null
    return enemySlots(run.battle.enemies).find((s) => s.e.uid === uid) || null
  }
  function centerOf(uid) { const s = slotOf(uid); return s ? { x: s.x, y: s.y - s.h * 0.45 } : null }

  // ── 파티클 도우미 ──
  function burst(x, y, color, n, spd, kind = 'spark', life = 0.5) {
    const cap = isMobile ? 260 : 420
    for (let i = 0; i < n; i++) {
      if (particles.length > cap) particles.shift()
      const a = Math.random() * Math.PI * 2
      const s = spd * (0.3 + Math.random() * 0.7)
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'debris' ? 120 : 0), g: kind === 'debris' ? 600 : kind === 'ember' ? -80 : 0, color, kind, size: 2 + Math.random() * 3, life: life * (0.6 + Math.random() * 0.6), max: life })
    }
  }
  function num(x, y, text, color, size = 22, life = 0.9) {
    texts.push({ x: x + (Math.random() - 0.5) * 16, y, vy: -90, text: String(text), color, size, life, max: life })
  }
  function ring(x, y, color, r, life = 0.4, width = 5, fill = false) { rings.push({ x, y, color, r0: 8, r, life, max: life, width, fill }) }
  function flash(color, a, decay = 3) { flashes.push({ color, a, decay }) }
  function bannerText(text, color, sub = '') { banner = { text, sub, color, t: 0, dur: 1.1 } }

  // ── 엔진 이벤트 → 연출 ──
  function onEvent(ev) {
    const pp = playerPos()
    switch (ev.type) {
      case 'battleStart':
        anim.clear()
        if (ev.boss) {
          intro = { t: 0, dur: 2.4, name: ev.name, icon: ev.icon || '👑' }
          flash('#ff3030', 0.4, 2)
          shake = 0.5
          SoundFX.play('boss'); vibrate(80)
        } else if (ev.elite) {
          bannerText('⚠ ELITE', '#f8d838', ev.name)
          SoundFX.play('boss')
        }
        break
      case 'turn':
        if (ev.who === 'player') bannerText(ev.turn === 1 ? 'BATTLE START' : 'YOUR TURN', '#ffe878')
        else bannerText('ENEMY TURN', '#ff7060')
        break
      case 'cast': {
        playerAnim.cast = 0.3
        const col = TYPE_COLOR[ev.card.type] || '#fff'
        ring(pp.x, pp.y - 40, col, 70, 0.35, 4, true)
        burst(pp.x, pp.y - 40, col, 10, 160, 'ember', 0.6)
        if (ev.chain >= 2) {
          texts.push({ x: pp.x + 10, y: pp.y - 110, vy: -40, text: '×' + ev.chain + ' CHAIN', color: col, size: 20 + ev.chain * 3, life: 0.9, max: 0.9, big: true })
          if (ev.chain >= 3) { flash(col, 0.12, 4); zoom = Math.max(zoom, 1.02) }
        }
        SoundFX.play('shoot')
        break
      }
      case 'attack': {
        const from = { x: pp.x + 20, y: pp.y - 50 }
        for (const uid of ev.to) {
          const c = centerOf(uid)
          if (!c) continue
          const d = ev.kind === 'aoe' ? 0.12 : 0.16
          pendingDelay.set(uid, d)
          if (ev.kind === 'aoe') {
            later(0.05, () => { bolts.push({ x1: from.x, y1: from.y, x2: c.x, y2: c.y, color: ev.color, life: 0.25, max: 0.25, laser: true, w: 16 }) })
          } else {
            projs.push({ x: from.x, y: from.y, tx: c.x, ty: c.y, t: 0, dur: d, color: ev.color })
          }
        }
        if (ev.kind === 'aoe') { flash(ev.color, 0.12, 4); later(0.1, () => { for (const uid of ev.to) { const c = centerOf(uid); if (c) ring(c.x, c.y, ev.color, 70, 0.35, 6, true) } }) }
        break
      }
      case 'hit': {
        const d = pendingDelay.get(ev.to) ?? 0
        pendingDelay.delete(ev.to)
        later(d, () => {
          const c = centerOf(ev.to)
          if (!c) return
          const a = A(ev.to)
          a.flash = 0.12
          a.knock = 10
          burst(c.x, c.y, ev.color || '#fff', ev.crit ? 22 : 12, ev.crit ? 380 : 260, 'spark', 0.4)
          burst(c.x, c.y, '#ffffff', 4, 120, 'spark', 0.3)
          ring(c.x, c.y, ev.color || '#fff', ev.crit ? 70 : 42, 0.25, ev.crit ? 6 : 4)
          if (ev.blocked) num(c.x - 20, c.y - 30, '🛡' + ev.blocked, '#88c8ff', 16)
          if (ev.amount - ev.blocked > 0) num(c.x, c.y - 40, ev.amount - ev.blocked, ev.crit ? '#ffe040' : '#ffffff', ev.crit ? 34 : 24)
          shake = Math.max(shake, ev.crit ? 0.25 : 0.1)
          if (ev.crit) { zoom = Math.max(zoom, 1.03); vibrate(15) }
          SoundFX.play('hit')
        })
        break
      }
      case 'kill': {
        const d = (pendingDelay.get(ev.to) ?? 0) + 0.05
        later(d, () => {
          const c = centerOf(ev.to)
          const a = A(ev.to)
          a.death = 0.0001
          if (!c) return
          burst(c.x, c.y, ev.color, ev.boss ? 60 : 22, ev.boss ? 420 : 260, 'debris', 0.9)
          burst(c.x, c.y, '#ffffff', ev.boss ? 30 : 8, 200, 'ember', 1.0)
          ring(c.x, c.y, ev.color, ev.boss ? 260 : 90, 0.5, 8, true)
          if (ev.boss) {
            for (let k = 0; k < 5; k++) later(k * 0.12, () => ring(c.x, c.y, RAINBOW[k], 140 + k * 60, 0.6, 7))
            flash('#ffffff', 0.8, 1.6); shake = 0.6; zoom = 1.08
            SoundFX.play('fusion'); vibrate([40, 30, 80])
          } else { SoundFX.play('xp'); shake = Math.max(shake, 0.15) }
        })
        break
      }
      case 'execute': { const c = centerOf(ev.to); if (c) { burst(c.x, c.y, '#c068e8', 20, 220); num(c.x, c.y - 60, '처형!', '#e8a0ff', 22) } break }
      case 'chain': { const s = playerPos(); const c = centerOf(ev.to); if (c) later(0.18, () => bolts.push({ x1: s.x + AW() * 0.35, y1: c.y - 20, x2: c.x, y2: c.y, color: '#f8e858', life: 0.25, max: 0.25 })); break }
      case 'zap': { const c = centerOf(ev.to); if (c) bolts.push({ x1: c.x, y1: stage.top, x2: c.x, y2: c.y, color: '#58c8ff', life: 0.3, max: 0.3 }); pendingDelay.set(ev.to, 0.05); break }
      case 'spirit': {
        const s = spiritPos(); const c = centerOf(ev.to)
        if (c) { projs.push({ x: s.x, y: s.y, tx: c.x, ty: c.y, t: 0, dur: 0.22, color: '#88ff98', small: true }); pendingDelay.set(ev.to, 0.22) }
        break
      }
      case 'storm': {
        const c = centerOf(ev.to)
        if (c) { bolts.push({ x1: c.x + 30, y1: stage.top - 20, x2: c.x, y2: c.y, color: '#c8e8ff', life: 0.35, max: 0.35, w: 3 }); flash('#e0f0ff', 0.25, 5); pendingDelay.set(ev.to, 0.05) }
        break
      }
      case 'meteor': {
        const run = getRun()
        for (const s of enemySlots(run.battle.enemies.filter((e) => !e.dead))) {
          meteors.push({ x: s.x, y: s.y - s.h * 0.4, t: 0, dur: 0.5 })
          pendingDelay.set(s.e.uid, 0.5)
        }
        break
      }
      case 'status': {
        const c = centerOf(ev.to)
        if (!c) break
        const col = STATUS_COLOR[ev.s]
        later(0.18, () => {
          burst(c.x, c.y, col, 10, 140, ev.s === 'burn' ? 'ember' : 'spark', 0.7)
          num(c.x + 26, c.y - 10, { burn: '🔥', poison: '☠️', freeze: '❄️', shock: '⚡' }[ev.s], col, 22, 0.7)
        })
        break
      }
      case 'block': ring(pp.x, pp.y - 40, '#68b8ff', 60, 0.45, 6, true); num(pp.x, pp.y - 90, '🛡+' + ev.amount, '#9cd0ff', 20); SoundFX.play('relic'); break
      case 'buff': ring(pp.x, pp.y - 40, ev.s === 'str' ? '#ff6040' : '#78ff98', 80, 0.5, 5, true); burst(pp.x, pp.y - 40, ev.s === 'str' ? '#ff8060' : '#98ffb0', 16, 120, 'ember', 0.9); break
      case 'energy': ring(pp.x, pp.y - 40, '#f8e030', 70, 0.4, 5); break
      case 'heal': { const p = playerPos(); burst(p.x, p.y - 40, '#68f898', 16, 90, 'ember', 1); num(p.x, p.y - 100, '+' + ev.amount, '#68f898', 22); break }
      case 'enemyAttack': {
        const a = A(ev.from)
        a.lunge = 0.0001
        later(0.14, () => {
          const c = centerOf(ev.from)
          if (c) bolts.push({ x1: c.x, y1: c.y, x2: pp.x, y2: pp.y - 40, color: '#ff5040', life: 0.18, max: 0.18, laser: true, w: ev.boss ? 14 : 8 })
        })
        break
      }
      case 'playerHit':
        later(0.16, () => {
          playerAnim.hurt = 0.3
          burst(pp.x, pp.y - 40, '#ff4040', 14, 240, 'spark', 0.4)
          if (ev.blocked) num(pp.x - 20, pp.y - 80, '🛡' + ev.blocked, '#88c8ff', 16)
          if (ev.amount - ev.blocked > 0) { num(pp.x, pp.y - 90, '-' + (ev.amount - ev.blocked), '#ff6060', 26); flash('#ff2020', 0.22, 4); vibrate(30) }
          shake = Math.max(shake, 0.2)
          SoundFX.play('hurt')
        })
        break
      case 'thorns': { const c = centerOf(ev.to); if (c) later(0.2, () => burst(c.x, c.y, '#78d858', 10, 200)); pendingDelay.set(ev.to, 0.2); break }
      case 'enemyBlock': { const c = centerOf(ev.from); if (c) ring(c.x, c.y, '#68b8ff', 60, 0.4, 5, true); break }
      case 'enemyBuff': { const c = centerOf(ev.from); if (c) { ring(c.x, c.y, '#ff4040', 70, 0.5, 6, true); burst(c.x, c.y, '#ff6040', 14, 120, 'ember', 0.8) } break }
      case 'enemyHeal': { const c = centerOf(ev.from); if (c) { burst(c.x, c.y, '#68f898', 16, 100, 'ember', 1); num(c.x, c.y - 50, '+' + ev.amount, '#68f898', 22) } break }
      case 'playerStatus': later(0.2, () => { burst(pp.x, pp.y - 40, STATUS_COLOR[ev.s], 12, 140, ev.s === 'burn' ? 'ember' : 'spark', 0.7) }); break
      case 'fusion':
        for (let k = 0; k < RAINBOW.length; k++) later(k * 0.05, () => ring(pp.x, pp.y - 40, RAINBOW[k], 90 + k * 30, 0.5, 5))
        burst(pp.x, pp.y - 40, '#ffe878', 40, 300, 'spark', 0.6)
        flash('#fff0b0', 0.5, 2.2); zoom = 1.06
        texts.push({ x: W / 2, y: stage.top + (stage.bottom - stage.top) * 0.35, vy: -20, text: '✨ ' + ev.name + ' ✨', color: ev.color, size: 26, life: 1.4, max: 1.4, big: true })
        SoundFX.play('fusion'); vibrate([20, 30, 20])
        break
      case 'victory':
        later(0.5, () => {
          bannerText(ev.boss ? 'BOSS CLEAR!' : 'VICTORY!', '#ffe040')
          for (let k = 0; k < 40; k++) particles.push({ x: Math.random() * W, y: stage.top - 10, vx: (Math.random() - 0.5) * 60, vy: 60 + Math.random() * 120, g: 80, color: RAINBOW[k % RAINBOW.length], kind: 'confetti', size: 4, life: 2, max: 2, rot: Math.random() * 6 })
          SoundFX.play('levelup')
        })
        break
      case 'revive':
        flash('#ffc040', 0.8, 1.5); zoom = 1.08
        burst(pp.x, pp.y - 40, '#ff9030', 40, 200, 'ember', 1.2)
        bannerText('🪽 REVIVE!', '#ffb040')
        SoundFX.play('revive')
        break
      case 'spawn': { const a = A(ev.to); a.spawn = 0.0001; break }
      case 'newAct': bannerText('ACT ' + ev.act, '#ffe878', '숲이 더 깊어졌다'); break
      case 'relic': flash('#d8a0ff', 0.3, 3); SoundFX.play('relic'); break
      case 'gold': SoundFX.play('xp'); break
      case 'cardGet': case 'buy': case 'upgrade': SoundFX.play('relic'); break
      case 'runOver': flash('#000000', 0.5, 1); break
    }
  }

  // ── 배경 (한 번 그려 캐시) ──
  function buildBg() {
    const c = document.createElement('canvas')
    c.width = Math.floor(W * dpr)
    c.height = Math.floor(H * dpr)
    const g = c.getContext('2d')
    g.scale(dpr, dpr)
    g.imageSmoothingEnabled = false
    const sky = g.createLinearGradient(0, 0, 0, stage.bottom)
    if (night) { sky.addColorStop(0, '#0a1030'); sky.addColorStop(1, '#203a40') }
    else { sky.addColorStop(0, '#78c8e8'); sky.addColorStop(1, '#c8f0c0') }
    g.fillStyle = sky
    g.fillRect(0, 0, W, stage.bottom)
    // 먼 숲 실루엣
    for (let layer = 0; layer < 3; layer++) {
      g.globalAlpha = night ? 0.35 + layer * 0.2 : 0.3 + layer * 0.22
      const y = stage.bottom - 70 - (2 - layer) * 26
      for (let x = -40 + layer * 23; x < W + 40; x += 46 - layer * 4) {
        g.drawImage(ATLAS.tree, x, y - 20 + ((x * 7) % 13), 48 + layer * 6, 36 + layer * 6)
      }
    }
    g.globalAlpha = 1
    // 땅
    g.fillStyle = '#489848'
    g.fillRect(0, stage.bottom - 60, W, H - stage.bottom + 60)
    for (let y = stage.bottom - 60; y < H; y += 16) {
      for (let x = 0; x < W; x += 16) {
        const h = Math.abs(Math.sin(x * 12.9 + y * 78.2) * 43758.5) % 1
        if (h < 0.3) { g.fillStyle = '#307838'; g.fillRect(x + 4, y + 6, 2, 5); g.fillRect(x + 9, y + 4, 2, 7) }
        else if (h > 0.92) { g.fillStyle = h > 0.96 ? '#f8d838' : '#f85848'; g.fillRect(x + 6, y + 6, 4, 4) }
      }
    }
    // 아래쪽 어둡게 (카드 영역 가독성)
    const dark = g.createLinearGradient(0, stage.bottom, 0, H)
    dark.addColorStop(0, 'rgba(10,20,14,0)')
    dark.addColorStop(0.3, 'rgba(10,20,14,0.55)')
    dark.addColorStop(1, 'rgba(10,20,14,0.85)')
    g.fillStyle = dark
    g.fillRect(0, stage.bottom, W, H - stage.bottom)
    if (night) { g.fillStyle = 'rgba(10,14,50,0.25)'; g.fillRect(0, 0, W, H) }
    bg = c
    ambient = Array.from({ length: isMobile ? 14 : 24 }, () => ({ x: Math.random() * W, y: stage.top + Math.random() * (stage.bottom - stage.top), ph: Math.random() * 6, sp: 8 + Math.random() * 18, s: 2 + Math.random() * 3 }))
  }

  function blit(img, x, y, sc, flip = false, alpha = 1) {
    const w = img.width * sc
    const h = img.height * sc
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(Math.round(x), Math.round(y))
    if (flip) ctx.scale(-1, 1)
    ctx.drawImage(img, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h))
    ctx.restore()
  }

  // ── 그리기 ──
  function render(dt) {
    const run = getRun()
    const T = performance.now() / 1000
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
    if (!bg) buildBg()
    ctx.drawImage(bg, 0, 0, W, H)

    zoom += (1 - zoom) * Math.min(1, dt * 4)
    shake = Math.max(0, shake - dt)
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 30 : 0
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 30 : 0
    ctx.save()
    ctx.translate(W / 2 + sx, (stage.top + stage.bottom) / 2 + sy)
    ctx.scale(zoom, zoom)
    ctx.translate(-W / 2, -(stage.top + stage.bottom) / 2)

    // 분위기 파티클
    for (const a of ambient) {
      a.ph += dt
      a.x -= a.sp * dt * 0.4
      a.y += Math.sin(a.ph) * 6 * dt
      if (a.x < -10) a.x = W + 10
      if (night) { ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, '#d8ff70', a.x, a.y, 8 + a.s * 2, 0.4 + Math.sin(a.ph * 3) * 0.3); ctx.globalCompositeOperation = 'source-over' }
      else { ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.ph * 2); ctx.fillStyle = a.s > 3.5 ? 'rgba(248,216,56,0.7)' : 'rgba(120,216,88,0.7)'; ctx.fillRect(-a.s, -a.s / 2, a.s * 2, a.s); ctx.restore() }
    }

    const battle = run?.battle
    if (battle || run?.screen === 'battle') {
      // 플레이어
      const pp = playerPos()
      playerAnim.cast = Math.max(0, playerAnim.cast - dt)
      playerAnim.hurt = Math.max(0, playerAnim.hurt - dt)
      ctx.globalCompositeOperation = 'lighter'
      drawGlow(ctx, playerAnim.hurt > 0 ? '#ff4040' : '#68f0a0', pp.x, pp.y - 6, 60, 0.35 + Math.sin(T * 3) * 0.08)
      if (battle?.player.block > 0) drawGlow(ctx, '#68b8ff', pp.x, pp.y - 40, 70, 0.45)
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(pp.x - 22, pp.y - 4, 44, 8)
      const hop = playerAnim.cast > 0 ? Math.sin((playerAnim.cast / 0.3) * Math.PI) * 10 : 0
      const kx = playerAnim.hurt > 0 ? -Math.sin((playerAnim.hurt / 0.3) * Math.PI) * 10 : 0
      blit(ATLAS.trainer[Math.floor(T * 2) % 2], pp.x + kx, pp.y - hop, 3, false, playerAnim.hurt > 0 && Math.floor(T * 30) % 2 ? 0.5 : 1)
      const sp = spiritPos()
      ctx.globalCompositeOperation = 'lighter'
      drawGlow(ctx, ['#78d858', '#68d8f8', '#f8d838'][run.spiritStage] || '#78d858', sp.x, sp.y - 12, 26, 0.6)
      ctx.globalCompositeOperation = 'source-over'
      blit(ATLAS.spirits[run.spiritStage] || ATLAS.spirits[0], sp.x, sp.y, 2.4)

      // 적
      if (battle) {
        const slots = enemySlots(battle.enemies)
        for (const s of slots) {
          const e = s.e
          const a = A(e.uid)
          if (a.death > 0) a.death += dt
          if (a.death > 0.7) continue
          if (a.spawn > 0) a.spawn += dt
          a.flash = Math.max(0, (a.flash || 0) - dt)
          a.knock = Math.max(0, (a.knock || 0) - dt * 60)
          let lx = 0
          if (a.lunge > 0) { a.lunge += dt; const k = a.lunge / 0.35; lx = -Math.sin(Math.min(1, k) * Math.PI) * 50; if (k >= 1) a.lunge = 0 }
          const bob = Math.sin(T * 3 + e.uid) * (e.isBoss ? 3 : 2)
          const x = s.x + lx + a.knock
          const y = s.y + bob
          const alpha = a.death > 0 ? Math.max(0, 1 - a.death / 0.7) : a.spawn > 0 ? Math.min(1, a.spawn / 0.3) : 1
          const sc = s.sc * (a.death > 0 ? 1 + a.death * 0.6 : 1)
          const isTarget = battle.target === e.uid && !e.dead && battle.phase === 'player'

          ctx.globalCompositeOperation = 'lighter'
          if (e.elite || e.isBoss) drawGlow(ctx, e.isBoss ? e.color : '#f8d838', x, y - s.h * 0.45, s.w * 0.9, (0.45 + Math.sin(T * 5) * 0.15) * alpha)
          if (isTarget) drawGlow(ctx, '#ffe878', x, y - 6, s.w * 0.6, 0.35)
          ctx.globalCompositeOperation = 'source-over'
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - s.w * 0.35, y - 4, s.w * 0.7, 8)
          const img = e.isBoss ? (a.flash > 0 ? ATLAS.bossesFlash[e.sprite] : ATLAS.bosses[e.sprite]) : (a.flash > 0 ? ATLAS.enemiesFlash[e.sprite] : ATLAS.enemies[e.sprite])[Math.floor(T * 3 + e.uid) % 2]
          blit(img, x, y, sc, true, alpha)
          if (e.freeze > 0 && !e.dead) { ctx.fillStyle = 'rgba(136,224,255,0.28)'; ctx.fillRect(x - s.w / 2, y - s.h, s.w, s.h) }
          if (e.dead) continue

          // 타겟 표시
          if (isTarget) {
            ctx.strokeStyle = '#ffe878'; ctx.lineWidth = 3
            const r = s.w * 0.5 + Math.sin(T * 6) * 3
            const cy = y - s.h * 0.45
            for (let k = 0; k < 4; k++) {
              const ang = k * Math.PI / 2 + T
              ctx.beginPath(); ctx.arc(x, cy, r, ang, ang + 0.6); ctx.stroke()
            }
          }
          // 체력바
          const bw = Math.max(54, Math.min(110, s.w))
          const by = y + 8
          ctx.fillStyle = '#182018'; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 10)
          ctx.fillStyle = '#485058'; ctx.fillRect(x - bw / 2, by, bw, 8)
          const ratio = Math.max(0, e.hp / e.maxHp)
          ctx.fillStyle = e.poison > 0 ? '#68c848' : ratio > 0.5 ? '#38b848' : ratio > 0.25 ? '#f8c820' : '#e83830'
          ctx.fillRect(x - bw / 2, by, bw * ratio, 8)
          ctx.font = "900 10px 'Courier New', monospace"
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillStyle = '#fff'; ctx.fillText(Math.ceil(e.hp) + '/' + e.maxHp, x, by + 4)
          if (e.block > 0) {
            ctx.fillStyle = '#3868b8'; ctx.beginPath(); ctx.arc(x - bw / 2 - 8, by + 4, 10, 0, Math.PI * 2); ctx.fill()
            ctx.fillStyle = '#fff'; ctx.font = "900 10px 'Courier New', monospace"; ctx.fillText(e.block, x - bw / 2 - 8, by + 5)
          }
          // 상태이상 아이콘
          const st = [['burn', '🔥'], ['poison', '☠️'], ['freeze', '❄️'], ['shock', '⚡'], ['str', '💪']].filter(([k]) => e[k] > 0)
          ctx.font = '11px sans-serif'
          st.forEach(([k, ic], i) => {
            const ix = x - bw / 2 + 8 + i * 22
            ctx.fillText(ic, ix, by + 20)
            ctx.font = "900 10px 'Courier New', monospace"; ctx.fillStyle = '#fff'
            ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.strokeText(e[k], ix + 9, by + 24); ctx.fillText(e[k], ix + 9, by + 24)
            ctx.font = '11px sans-serif'
          })
          // 의도
          const it = e.intent
          if (it && battle.phase !== 'won') {
            const iy = y - s.h - 18 + Math.sin(T * 4) * 3
            let label = ''
            if (it.hidden) label = '❓'
            else {
              if (it.a) label += '⚔️' + it.atk + (it.n > 1 ? '×' + it.n : '')
              if (it.b) label += ' 🛡' + it.b
              if (it.s) label += ' 💪'
              if (it.heal) label += ' 💚'
              if (it.poison || it.burn || it.freeze || it.shock) label += ' 🌀'
            }
            ctx.font = "900 13px 'Courier New', monospace"
            const tw = ctx.measureText(label).width + 14
            ctx.fillStyle = it.a && !it.hidden ? 'rgba(160,20,20,0.85)' : 'rgba(20,30,40,0.8)'
            ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - tw / 2, iy - 11, tw, 22, 6) : ctx.rect(x - tw / 2, iy - 11, tw, 22); ctx.fill()
            ctx.fillStyle = '#fff'; ctx.fillText(label.trim(), x, iy + 1)
          }
        }
      }
    }

    // ── 빛 레이어 ──
    ctx.globalCompositeOperation = 'lighter'
    for (let i = projs.length - 1; i >= 0; i--) {
      const p = projs[i]
      p.t += dt
      const k = Math.min(1, p.t / p.dur)
      const e = easeOutCubic(k)
      const x = p.x + (p.tx - p.x) * e
      const y = p.y + (p.ty - p.y) * e - Math.sin(k * Math.PI) * 30
      for (let j = 1; j <= 5; j++) {
        const kk = Math.max(0, k - j * 0.05)
        const ee = easeOutCubic(kk)
        drawGlow(ctx, p.color, p.x + (p.tx - p.x) * ee, p.y + (p.ty - p.y) * ee - Math.sin(kk * Math.PI) * 30, (p.small ? 10 : 18) - j * 2, 0.5 - j * 0.08)
      }
      drawGlow(ctx, p.color, x, y, p.small ? 18 : 30, 1)
      drawGlow(ctx, '#ffffff', x, y, p.small ? 8 : 12, 0.9)
      if (k >= 1) projs.splice(i, 1)
    }
    ctx.lineCap = 'round'
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]
      b.life -= dt
      const a = Math.max(0, b.life / b.max)
      if (b.laser) {
        ctx.globalAlpha = a * 0.4; ctx.strokeStyle = b.color; ctx.lineWidth = (b.w || 10) * 2.2
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke()
        ctx.globalAlpha = a; ctx.lineWidth = b.w || 10
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke()
        ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, (b.w || 10) * 0.3)
        ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke()
      } else {
        const pts = jaggedPoints(b.x1, b.y1, b.x2, b.y2, 7, 22)
        ctx.globalAlpha = a * 0.5; ctx.strokeStyle = b.color; ctx.lineWidth = 8; strokePts(ctx, pts)
        ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; strokePts(ctx, pts)
      }
      ctx.globalAlpha = 1
      drawGlow(ctx, b.color, b.x2, b.y2, 40, a)
      if (b.life <= 0) bolts.splice(i, 1)
    }
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i]
      m.t += dt
      const k = Math.min(1, m.t / m.dur)
      const mx = m.x + 160 * (1 - k)
      const my = m.y - 380 * (1 - k)
      for (let j = 1; j < 5; j++) drawGlow(ctx, '#ff7020', mx + j * 18, my - j * 42, 30 - j * 5, 0.5)
      drawGlow(ctx, '#ffd060', mx, my, 44, 1)
      if (k >= 1) { meteors.splice(i, 1); ring(m.x, m.y, '#ff9030', 110, 0.4, 8, true); burst(m.x, m.y, '#ffb040', 20, 300, 'debris', 0.8); shake = 0.35; SoundFX.play('meteor') }
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]
      r.life -= dt
      const k = 1 - r.life / r.max
      const rad = r.r0 + (r.r - r.r0) * easeOutCubic(Math.min(1, k))
      const a = Math.max(0, r.life / r.max)
      if (r.fill) drawGlow(ctx, r.color, r.x, r.y, rad, a * 0.5)
      ctx.globalAlpha = a * 0.5; ctx.strokeStyle = r.color; ctx.lineWidth = r.width * 2 * a + 2
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, r.width * 0.4 * a)
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI * 2); ctx.stroke()
      ctx.globalAlpha = 1
      if (r.life <= 0) rings.splice(i, 1)
    }
    for (const p of particles) {
      if (p.kind === 'debris' || p.kind === 'confetti') continue
      const a = Math.max(0, p.life / p.max)
      if (p.kind === 'spark') {
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 2
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); ctx.stroke()
        ctx.globalAlpha = 1
      } else drawGlow(ctx, p.color, p.x, p.y, 6 + p.size * 2, a)
    }
    ctx.globalCompositeOperation = 'source-over'
    for (const p of particles) {
      if (p.kind !== 'debris' && p.kind !== 'confetti') continue
      ctx.globalAlpha = Math.max(0, p.life / p.max)
      ctx.fillStyle = p.color
      if (p.kind === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate((p.rot += dt * 8)); ctx.fillRect(-3, -2, 6, 4); ctx.restore() }
      else { ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size) }
    }
    ctx.globalAlpha = 1
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life -= dt
      p.vy += p.g * dt
      if (p.kind === 'spark') { p.vx *= 1 - 3 * dt; p.vy *= 1 - 3 * dt }
      p.x += p.vx * dt
      p.y += p.vy * dt
      if (p.kind === 'debris' && p.y > stage.bottom - 30) { p.y = stage.bottom - 30; p.vy *= -0.35; p.vx *= 0.7 }
      if (p.life <= 0) particles.splice(i, 1)
    }

    // 숫자·글씨
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]
      t.life -= dt
      t.y += t.vy * dt
      t.vy *= 1 - 2 * dt
      const age = 1 - t.life / t.max
      const sc = t.big ? easeOutBack(Math.min(1, age * 4)) : 1 + Math.max(0, 0.5 - age * 3)
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 3)
      ctx.font = `900 ${Math.round(t.size * sc)}px ${t.big ? "-apple-system, 'Apple SD Gothic Neo', sans-serif" : "'Courier New', monospace"}`
      ctx.lineWidth = 5; ctx.strokeStyle = '#101810'
      ctx.strokeText(t.text, t.x, t.y)
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y)
      if (t.life <= 0) texts.splice(i, 1)
    }
    ctx.globalAlpha = 1
    ctx.restore()

    // ── 화면 공간 ──
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i]
      ctx.globalAlpha = Math.max(0, f.a); ctx.fillStyle = f.color; ctx.fillRect(0, 0, W, H)
      f.a -= f.decay * dt
      if (f.a <= 0) flashes.splice(i, 1)
    }
    ctx.globalAlpha = 1
    if (run && run.screen === 'battle' && run.hp / run.maxHp < 0.3) {
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
      g.addColorStop(0, 'rgba(200,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${0.3 + Math.sin(T * 7) * 0.12})`)
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    }
    if (banner) {
      banner.t += dt
      const k = banner.t / banner.dur
      const a = k < 0.15 ? k / 0.15 : k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1
      const cy = stage.top + (stage.bottom - stage.top) * 0.3
      ctx.globalAlpha = a
      const gr = ctx.createLinearGradient(0, cy - 30, 0, cy + 30)
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = gr; ctx.fillRect(0, cy - 34, W, 68)
      const slide = (1 - easeOutBack(Math.min(1, k * 4))) * 120
      ctx.font = "900 30px 'Courier New', monospace"
      ctx.lineWidth = 6; ctx.strokeStyle = '#000'
      ctx.strokeText(banner.text, W / 2 + slide, cy - (banner.sub ? 6 : 0))
      ctx.fillStyle = banner.color; ctx.fillText(banner.text, W / 2 + slide, cy - (banner.sub ? 6 : 0))
      if (banner.sub) { ctx.font = "800 13px -apple-system, 'Apple SD Gothic Neo', sans-serif"; ctx.fillStyle = '#fff'; ctx.fillText(banner.sub, W / 2, cy + 18) }
      ctx.globalAlpha = 1
      if (banner.t >= banner.dur) banner = null
    }
    if (intro) {
      intro.t += dt
      const t = intro.t, d = intro.dur
      const k = easeOutCubic(Math.min(1, t / 0.35)) * (t > d - 0.4 ? 1 - easeOutCubic(Math.min(1, (t - d + 0.4) / 0.4)) : 1)
      const bar = H * 0.1 * k
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar)
      const cy = stage.top + (stage.bottom - stage.top) * 0.35
      ctx.globalAlpha = k
      const gr = ctx.createLinearGradient(0, cy - 44, 0, cy + 44)
      gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(0.5, 'rgba(120,0,0,0.8)'); gr.addColorStop(1, 'rgba(120,0,0,0)')
      ctx.fillStyle = gr; ctx.fillRect(0, cy - 44, W, 88)
      ctx.font = "900 13px 'Courier New', monospace"
      ctx.fillStyle = Math.floor(t * 6) % 2 ? '#ff5050' : '#fff'
      ctx.fillText('⚠ WARNING ⚠  BOSS', W / 2, cy - 22)
      const slide = (1 - easeOutBack(Math.min(1, t / 0.5))) * W
      ctx.font = `900 ${Math.min(28, W / 13)}px -apple-system, 'Apple SD Gothic Neo', sans-serif`
      ctx.lineWidth = 6; ctx.strokeStyle = '#000'
      ctx.strokeText(intro.icon + ' ' + intro.name, W / 2 + slide, cy + 10)
      ctx.fillStyle = '#ffe8a0'; ctx.fillText(intro.icon + ' ' + intro.name, W / 2 + slide, cy + 10)
      ctx.globalAlpha = 1
      if (t >= d) intro = null
    }

    // 시간차 실행
    for (let i = delayed.length - 1; i >= 0; i--) {
      delayed[i].t -= dt
      if (delayed[i].t <= 0) { const f = delayed[i].fn; delayed.splice(i, 1); f() }
    }
  }

  let last = performance.now()
  let raf = 0
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    render(dt)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  return {
    onEvent,
    /** 화면 좌표에 있는 적 uid (탭으로 대상 지정) */
    pick(cx, cy) {
      const run = getRun()
      if (!run?.battle) return null
      for (const s of enemySlots(run.battle.enemies)) {
        if (s.e.dead) continue
        const pad = 16
        if (cx > s.x - s.w / 2 - pad && cx < s.x + s.w / 2 + pad && cy > s.y - s.h - 30 && cy < s.y + 40) return s.e.uid
      }
      return null
    },
    setNight(n) { night = n; bg = null },
    get stageBottom() { return stage.bottom },
    resize,
    destroy() { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }
}
