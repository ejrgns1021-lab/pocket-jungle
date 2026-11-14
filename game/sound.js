// 8비트 칩튠 효과음 (Web Audio로 즉석 합성 — 음원 파일 없음)
export const SoundFX = {
  ctx: null,
  muted: false,
  xpCombo: 0,
  lastXpTime: 0,
  lastHit: 0,

  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext
        if (AC) this.ctx = new AC()
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    } catch (e) {}
  },

  tone(f1, f2, dur, wave, vol, delay) {
    if (this.muted || !this.ctx) return
    try {
      const t = this.ctx.currentTime + (delay || 0)
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = wave || 'square'
      osc.frequency.setValueAtTime(f1, t)
      if (f2 && f2 !== f1) osc.frequency.exponentialRampToValueAtTime(f2, t + dur)
      gain.gain.setValueAtTime(vol || 0.04, t)
      gain.gain.exponentialRampToValueAtTime(0.0008, t + dur)
      osc.connect(gain)
      gain.connect(this.ctx.destination)
      osc.start(t)
      osc.stop(t + dur + 0.01)
    } catch (e) {}
  },

  play(name) {
    if (this.muted || !this.ctx) return
    const now = performance.now()
    // 모바일 성능: 같은 타격음이 한 프레임에 수십 번 겹치지 않게 제한
    if (name === 'hit' || name === 'shoot') {
      if (now - this.lastHit < 35) return
      this.lastHit = now
    }
    if (name === 'shoot') this.tone(610, 250, 0.045, 'square', 0.02)
    else if (name === 'hit') this.tone(180, 72, 0.04, 'sawtooth', 0.02)
    else if (name === 'xp') {
      this.xpCombo = now - this.lastXpTime < 420 ? Math.min(14, this.xpCombo + 1) : 0
      this.lastXpTime = now
      const f = 587.33 * Math.pow(1.05946, this.xpCombo)
      this.tone(f, f * 1.24, 0.055, 'square', 0.03)
    } else if (name === 'levelup') {
      const n = [523.25, 523.25, 523.25, 659.25, 783.99, 1046.5]
      const o = [0, 0.075, 0.15, 0.23, 0.33, 0.44]
      const d = [0.065, 0.065, 0.065, 0.085, 0.085, 0.25]
      n.forEach((f, i) => this.tone(f, f, d[i], 'square', 0.045, o[i]))
    } else if (name === 'fusion') {
      const n = [440, 554.37, 659.25, 440, 554.37, 659.25, 880, 1108.73]
      n.forEach((f, i) => this.tone(f, f, i === 7 ? 0.32 : 0.065, 'square', 0.05, i * 0.065))
    } else if (name === 'relic') {
      ;[587.33, 739.99, 880, 1174.66].forEach((f, i) => this.tone(f, f, 0.15, 'triangle', 0.06, i * 0.075))
    } else if (name === 'boss') {
      this.tone(145, 52, 0.28, 'sawtooth', 0.07)
      this.tone(125, 46, 0.34, 'sawtooth', 0.07, 0.24)
    } else if (name === 'hurt') this.tone(140, 50, 0.12, 'square', 0.06)
    else if (name === 'meteor') this.tone(240, 42, 0.24, 'sawtooth', 0.06)
    else if (name === 'double') {
      this.tone(330, 660, 0.12, 'square', 0.05)
      this.tone(440, 880, 0.15, 'square', 0.05, 0.09)
    } else if (name === 'revive') {
      ;[392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, f, 0.12, 'triangle', 0.06, i * 0.08))
    }
  }
}

export function vibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms) } catch (e) {}
}
