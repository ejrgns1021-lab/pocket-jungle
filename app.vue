<template>
  <div>
    <canvas ref="canvasEl" class="game-canvas" />
    <div class="scanlines" />

    <GameHud
      v-if="screen === 'playing'"
      :hud="hud" :dock="dock" :muted="muted" :banner="banner" :banner-key="bannerKey"
      @pause="game?.pause()" @mute="toggleMute" @mult="game?.doubleMult()" @reset-mult="game?.resetMult()"
    />

    <ChoiceSheet v-if="choice && !paused" :choice="choice" @choose="(i: number) => game?.choose(i)" @reroll="game?.reroll()" />

    <div v-if="paused" class="overlay">
      <div class="win pause">
        <h2>⏸ 일시정지</h2>
        <ul v-if="oracle" class="mlist">
          <li v-for="id in oracle.mutators" :key="id">{{ MUT[id]?.icon }} {{ MUT[id]?.name }} — <small>{{ MUT[id]?.desc }}</small></li>
        </ul>
        <button class="btn" @click="toggleFx">✨ 이펙트: {{ fx === 2 ? '화려하게' : '가볍게' }}</button>
        <button class="btn-start" @click="game?.resume()">▶ 계속하기</button>
        <button class="btn" @click="game?.quit()">🏳️ 탐험 포기</button>
      </div>
    </div>

    <StartScreen
      v-if="screen === 'menu'" :key="menuKey"
      :oracle="oracle" :night="night" :initial-tab="menuTab" @start="startRun"
    />

    <GameOver
      v-if="screen === 'over' && over"
      :stats="over.stats" :result="over.result" :forest-name="oracle?.name || ''" :submitted="over.submitted"
      @restart="startRun" @menu="openMenu"
    />
  </div>
</template>

<script setup lang="ts">
import { createGame } from '~/game/engine.js'
import { MUTATORS, kstHour, seedFrom } from '~/game/mutators.js'

const MUT = MUTATORS as Record<string, { icon: string; name: string; desc: string }>
const canvasEl = ref<HTMLCanvasElement | null>(null)
let game: any = null

const screen = ref<'menu' | 'playing' | 'over'>('menu')
const menuTab = ref('play')
const menuKey = ref(0)
const hud = ref<any>({ hp: 1, maxHp: 1, xp: 0, xpNeed: 20, level: 1, time: 0, kills: 0, nextBoss: 60, mult: 1 })
const dock = ref<any>({ items: [], used: 0, max: 20 })
const choice = ref<any>(null)
const paused = ref(false)
const muted = ref(false)
const banner = ref('')
const bannerKey = ref(0)
const over = ref<any>(null)
const night = ref(false)
const fx = ref(2)

const { oracle, fetchToday } = useOracle()
const metaApi = useMeta()
const lb = useLeaderboard()

let bannerTimer: any = null

onMounted(async () => {
  muted.value = localStorage.getItem('pj_muted') === '1'
  const h = kstHour()
  night.value = h >= 19 || h < 6 // 한국 시간 저녁 7시~새벽 6시는 '밤의 정글'

  game = createGame(canvasEl.value!, {
    onHud: (s: any) => { hud.value = s },
    onDock: (d: any) => { dock.value = d },
    onChoice: (c: any) => { choice.value = c },
    onPause: (p: boolean) => { paused.value = p },
    onFx: (lv: number) => { fx.value = lv },
    onBanner: (msg: string) => {
      banner.value = msg
      bannerKey.value++
      clearTimeout(bannerTimer)
      bannerTimer = setTimeout(() => { banner.value = '' }, 2800)
    },
    onGameOver: onGameOver
  })
  game.setMuted(muted.value)
  const savedFx = localStorage.getItem('pj_fx')
  if (savedFx) game.setFx(Number(savedFx))

  // 다른 앱으로 전환하거나 화면이 꺼지면 자동 일시정지 (모바일 필수)
  document.addEventListener('visibilitychange', () => { if (document.hidden) game?.pause() })

  await Promise.all([metaApi.load(), fetchToday()])
})

onBeforeUnmount(() => game?.destroy())

function startRun() {
  if (!oracle.value) return
  screen.value = 'playing'
  over.value = null
  choice.value = null
  paused.value = false
  // 테스트용 주소 옵션: ?mut=storm,split,elite (변이 직접 지정) · ?speed=3 (배속)
  const q = new URLSearchParams(location.search)
  const testMut = (q.get('mut') || '').split(',').filter((m) => MUT[m])
  game.start({
    mutators: testMut.length ? testMut : oracle.value.mutators,
    timeScale: Number(q.get('speed')) || 1,
    bossTitle: oracle.value.bossTitle,
    seed: Math.floor(seedFrom(oracle.value.day)() * 100000),
    night: night.value,
    spiritStage: metaApi.spiritStage.value,
    upgrades: { ...metaApi.meta.upgrades }
  })
}

async function onGameOver(stats: any) {
  choice.value = null
  const result = metaApi.recordRun(stats, oracle.value?.mutators || [])
  over.value = { stats, result, submitted: false }
  screen.value = 'over'
  const ok = await lb.submit({
    name: localStorage.getItem('pj_nick') || '트레이너',
    score: result.score, kills: stats.kills, time: stats.time, level: stats.level
  })
  if (over.value) over.value.submitted = ok
}

function openMenu(tab: string) {
  menuTab.value = tab
  menuKey.value++
  screen.value = 'menu'
}

function toggleFx() {
  const next = fx.value === 2 ? 1 : 2
  game?.setFx(next)
  localStorage.setItem('pj_fx', String(next))
}

function toggleMute() {
  muted.value = !muted.value
  localStorage.setItem('pj_muted', muted.value ? '1' : '0')
  game?.setMuted(muted.value)
}
</script>

<style>
.game-canvas {
  display: block; position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100dvh;
  touch-action: none; image-rendering: pixelated; image-rendering: crisp-edges;
}
.pause { width: 100%; max-width: 360px; padding: 18px; display: flex; flex-direction: column; gap: 10px; text-align: center; }
.pause h2 { font-size: 20px; }
.mlist { list-style: none; text-align: left; font-size: 13px; display: flex; flex-direction: column; gap: 4px; background: #e8ece0; border-radius: 6px; padding: 8px; }
.mlist small { color: #586860; }
.pause .btn-start { font-size: 17px; }
</style>
