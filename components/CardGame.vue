<template>
  <div class="cg" :style="frameStyle">
    <canvas ref="canvasEl" class="stage" @pointerdown="onStageTap" />

    <!-- 상단 바 -->
    <div class="topbar">
      <div class="pill hpbox">
        <span class="heart">❤️</span>
        <div class="hpbar"><div :style="{ width: (run.hp / run.maxHp) * 100 + '%' }" /></div>
        <b class="mono">{{ run.hp }}/{{ run.maxHp }}</b>
        <span v-if="b && b.player.block" class="blk">🛡{{ b.player.block }}</span>
      </div>
      <div class="pill info">
        <span>💰<b class="mono">{{ run.gold }}</b></span>
        <span>🗺️<b class="mono">{{ run.act }}-{{ (run.pos?.row ?? -1) + 1 }}</b></span>
      </div>
      <button class="btn sq" aria-label="덱 보기" @click="deckOpen = true">📚<small>{{ run.deck.length }}</small></button>
      <button class="btn sq" aria-label="메뉴" @click="menuOpen = true">⏸</button>
    </div>
    <div class="relics">
      <span v-for="id in run.relics" :key="id" class="relic" :title="RELICS[id].name" @click="toast(RELICS[id].icon + ' ' + RELICS[id].name + ' — ' + RELICS[id].desc)">{{ RELICS[id].icon }}</span>
      <span v-if="b" class="pstat">
        <span v-if="b.player.str">💪{{ b.player.str }}</span>
        <span v-if="b.player.thorns">🌵{{ b.player.thorns }}</span>
        <span v-if="b.player.poison">☠️{{ b.player.poison }}</span>
        <span v-if="b.player.burn">🔥{{ b.player.burn }}</span>
        <span v-if="b.player.freeze">❄️{{ b.player.freeze }}</span>
        <span v-if="b.player.shock">⚡{{ b.player.shock }}</span>
      </span>
    </div>

    <!-- 전투 UI -->
    <template v-if="run.screen === 'battle' && b">
      <div v-if="b.chain >= 2 && b.phase === 'player'" class="chain" :style="{ '--tc': TYPE_COLOR[b.chainType] }">{{ TYPE_ICON[b.chainType] }} ×{{ b.chain }} 체인 <small>+{{ (b.chain - 1) * 2 }}</small></div>
      <div v-if="fusions.length" class="fusions">
        <button v-for="f in fusions" :key="f.id" class="fuse-btn" @click="doFuse(f.id)">✨ {{ f.icon }} {{ f.name }}</button>
      </div>
      <div class="hand" :class="{ off: b.phase !== 'player' }">
        <TransitionGroup name="card">
          <div
            v-for="(c, i) in b.hand" :key="c.uid" class="slot"
            :style="slotStyle(i, b.hand.length)"
            @click="tapCard(i)"
          >
            <CardView :card="c" :dim="!playable(i)" :class="{ shake: shakeUid === c.uid }" />
          </div>
        </TransitionGroup>
      </div>
      <div class="energy" :class="{ empty: b.energy === 0 }"><b>{{ b.energy }}</b><small>/{{ b.maxEnergy }}</small></div>
      <div class="piles">
        <span>🂠 {{ b.draw.length }}</span>
        <span>🗑 {{ b.discard.length }}</span>
      </div>
      <button class="endturn" :disabled="b.phase !== 'player' || busy" @click="endTurn">{{ b.phase === 'player' ? '턴 종료' : '적 행동…' }}</button>
      <div v-if="hint" class="hint">{{ hint }}</div>
    </template>

    <!-- 지도 -->
    <MapView v-if="run.screen === 'map'" :run="run" :forest="forestName" @go="go" />

    <!-- 보상 -->
    <div v-if="run.screen === 'reward' && run.reward" class="overlay">
      <div class="win gold panel">
        <h2>{{ run.reward.from === 'boss' ? '👑 보스 격파!' : run.reward.from === 'treasure' ? '🎁 보물 상자' : '🏆 승리 보상' }}</h2>
        <button v-if="run.reward.gold" class="btn row" @click="E.takeGold(run)">💰 골드 {{ run.reward.gold }}</button>
        <div v-if="run.reward.relics" class="relic-pick">
          <p class="sub">유물 하나를 고르세요</p>
          <button v-for="id in run.reward.relics" :key="id" class="relic-card" @click="E.takeRelic(run, id)">
            <span class="ri">{{ RELICS[id].icon }}</span><span><b>{{ RELICS[id].name }}</b><small>{{ RELICS[id].desc }}</small></span>
          </button>
        </div>
        <template v-if="run.reward.cards">
          <p class="sub">덱에 넣을 카드를 고르세요</p>
          <div class="pick-row">
            <div v-for="c in run.reward.cards" :key="c.uid" class="pick" @click="E.takeCard(run, c)"><CardView :card="c" /></div>
          </div>
          <div class="row2">
            <button v-if="run.rerolls > 0" class="btn" @click="E.rerollCards(run)">🎲 다시뽑기 ({{ run.rerolls }})</button>
            <button class="btn" @click="run.reward.cards = null">건너뛰기</button>
          </div>
        </template>
        <button class="btn-start" @click="E.leaveReward(run)">{{ run.reward.from === 'boss' ? '▶ 다음 숲으로' : '▶ 지도로' }}</button>
      </div>
    </div>

    <!-- 모닥불 -->
    <div v-if="run.screen === 'rest' && run.rest" class="overlay">
      <div class="win panel">
        <h2>🔥 모닥불</h2>
        <p class="sub">정령과 함께 잠시 쉬어 간다.</p>
        <template v-if="!run.rest.done">
          <button class="btn row" :disabled="run.mods.restHeal === 0" @click="E.restHeal(run)">💤 휴식 — HP {{ Math.round(run.maxHp * 0.3 * run.mods.restHeal) }} 회복</button>
          <button class="btn row" @click="pickMode = 'upgrade'">🔨 카드 강화</button>
        </template>
        <p v-else class="sub">{{ run.rest.done === 'heal' ? '푹 쉬었다.' : '카드가 더 강해졌다!' }}</p>
        <button class="btn-start" @click="E.leaveRest(run)">▶ 지도로</button>
      </div>
    </div>

    <!-- 상점 -->
    <div v-if="run.screen === 'shop' && run.shop" class="overlay">
      <div class="win panel wide">
        <h2>🛒 정글 잡화점 <small class="mono">💰{{ run.gold }}</small></h2>
        <div class="pick-row wrap">
          <div v-for="(it, i) in run.shop.cards" :key="it.card.uid" class="pick shop" :class="{ sold: it.sold, poor: run.gold < it.price }" @click="E.buyCard(run, i)">
            <CardView :card="it.card" mini />
            <span class="price">{{ it.sold ? '판매됨' : '💰' + it.price }}</span>
          </div>
        </div>
        <div class="relic-pick">
          <button v-for="(it, i) in run.shop.relics" :key="it.id" class="relic-card" :class="{ sold: it.sold }" :disabled="it.sold || run.gold < it.price" @click="E.buyRelic(run, i)">
            <span class="ri">{{ RELICS[it.id].icon }}</span><span><b>{{ RELICS[it.id].name }}</b><small>{{ RELICS[it.id].desc }}</small></span><em>{{ it.sold ? '판매됨' : '💰' + it.price }}</em>
          </button>
        </div>
        <button class="btn row" :disabled="run.shop.removed || run.gold < run.shop.removePrice" @click="pickMode = 'remove'">🗑 카드 1장 제거 — 💰{{ run.shop.removePrice }}</button>
        <button class="btn-start" @click="E.leaveShop(run)">▶ 나가기</button>
      </div>
    </div>

    <!-- 이벤트 -->
    <div v-if="run.screen === 'event' && run.event" class="overlay">
      <div class="win panel">
        <div class="ev-icon">{{ run.event.icon }}</div>
        <h2>{{ run.event.title }}</h2>
        <p class="sub">{{ run.event.text }}</p>
        <template v-if="!run.event.result">
          <button v-for="(o, i) in run.event.options" :key="i" class="btn row" @click="E.chooseEvent(run, o)">{{ o.label }}</button>
        </template>
        <template v-else>
          <p class="result">{{ run.event.result }}</p>
          <button class="btn-start" @click="E.leaveEvent(run)">▶ 계속</button>
        </template>
      </div>
    </div>

    <!-- 덱 선택 (강화/제거) & 덱 보기 -->
    <div v-if="pickMode || deckOpen" class="overlay deck-ov" @click.self="pickMode = null; deckOpen = false">
      <div class="win panel wide">
        <h2>{{ pickMode === 'upgrade' ? '🔨 강화할 카드' : pickMode === 'remove' ? '🗑 제거할 카드' : '📚 내 덱 (' + run.deck.length + ')' }}</h2>
        <div class="pick-row wrap scroll-y deck-grid">
          <div
            v-for="c in deckList" :key="c.uid" class="pick"
            :class="{ disabled: pickMode === 'upgrade' && (c.upgraded || !CARDS[c.id]?.up) }"
            @click="onPickDeck(c)"
          >
            <CardView :card="pickMode === 'upgrade' && !c.upgraded ? { ...c, upgraded: true } : c" mini />
          </div>
        </div>
        <button class="btn" @click="pickMode = null; deckOpen = false">닫기</button>
      </div>
    </div>

    <!-- 메뉴 -->
    <div v-if="menuOpen" class="overlay">
      <div class="win panel">
        <h2>⏸ 일시정지</h2>
        <ul class="mlist">
          <li v-for="id in run.mutators" :key="id">{{ MUT[id]?.icon }} <b>{{ MUT[id]?.name }}</b> — {{ CM[id]?.desc }}</li>
        </ul>
        <button class="btn-start" @click="menuOpen = false">▶ 계속하기</button>
        <button class="btn" @click="toggleMute">{{ muted ? '🔇 소리 켜기' : '🔊 소리 끄기' }}</button>
        <button class="btn" @click="menuOpen = false; E.abandon(run)">🏳️ 원정 포기</button>
      </div>
    </div>

    <!-- 결과 -->
    <div v-if="run.screen === 'over' && run.result" class="overlay">
      <div class="win panel">
        <span class="badge">EXPEDITION OVER</span>
        <h2>원정이 끝났다</h2>
        <p class="sub">{{ forestName }} · ACT {{ run.result.act }}</p>
        <div class="score"><small>점수</small><b class="mono">{{ run.result.score.toLocaleString() }}</b><span v-if="saved?.newBest" class="best blink">🏆 신기록!</span></div>
        <div class="grid3">
          <div><small>진행</small><b>{{ run.result.floors }}칸</b></div>
          <div><small>처치</small><b>{{ run.result.kills }}</b></div>
          <div><small>정예·보스</small><b>{{ run.result.elites }}·{{ run.result.bosses }}</b></div>
        </div>
        <div class="reward">💠 정수 +{{ run.result.essence }}</div>
        <div v-if="saved?.evolved" class="evolve blink">🌟 동료 정령이 진화했다!</div>
        <button class="btn-start" @click="restart">▶ 다시 원정</button>
        <div class="row2">
          <button class="btn" @click="$emit('menu', 'grow')">💠 성장</button>
          <button class="btn" @click="$emit('menu', 'rank')">🏆 랭킹</button>
          <button class="btn" @click="$emit('menu', 'play')">🏠 처음</button>
        </div>
      </div>
    </div>

    <div v-if="toastMsg" :key="toastKey" class="win gold toast pop">{{ toastMsg }}</div>
  </div>
</template>

<script setup lang="ts">
import * as E from '~/game/cards/engine.js'
import CardView from '~/components/card/CardView.vue'
import MapView from '~/components/card/MapView.vue'
import { CARD_RELICS, CARD_MUTATORS, CARDS } from '~/game/cards/data.js'
import { createScene } from '~/game/cards/scene.js'
import { MUTATORS } from '~/game/mutators.js'
import { SoundFX, vibrate } from '~/game/sound.js'

const props = defineProps<{ oracle: any; night: boolean }>()
const emit = defineEmits(['menu'])

const RELICS = CARD_RELICS as Record<string, any>
const CM = CARD_MUTATORS as Record<string, any>
const MUT = MUTATORS as Record<string, any>
const TYPE_COLOR: Record<string, string> = { grass: '#48d858', fire: '#f85830', water: '#48b8f8', electric: '#f8d830', psychic: '#d878f8', dragon: '#7888ff' }
const TYPE_ICON: Record<string, string> = { grass: '🍃', fire: '🔥', water: '💧', electric: '⚡', psychic: '🔮', dragon: '🐲' }

const metaApi = useMeta()
const lb = useLeaderboard('cards')
const canvasEl = ref<HTMLCanvasElement | null>(null)
let scene: any = null

// ── PC 화면 맞춤: 큰 모니터에서는 게임 전체를 확대(가상 해상도) ──
const view = reactive({ w: 390, h: 800, z: 1 })
function measure() {
  const W = window.innerWidth
  const H = window.innerHeight
  const touch = matchMedia('(pointer: coarse)').matches
  const z = touch || W < 760 ? 1 : Math.max(1, Math.min(H / 640, W / 1100, 2.4))
  view.z = z
  view.w = W / z
  view.h = H / z
}
if (typeof window !== 'undefined') measure()
const frameStyle = computed(() => ({
  width: view.w + 'px',
  height: view.h + 'px',
  transform: view.z !== 1 ? `scale(${view.z})` : undefined,
  '--vh': view.h + 'px'
}))
function onResize() { measure(); scene?.resize() }

const run = reactive<any>(makeRun())
const b = computed(() => run.battle)
const busy = ref(false)
const deckOpen = ref(false)
const menuOpen = ref(false)
const pickMode = ref<null | 'upgrade' | 'remove'>(null)
const shakeUid = ref<number | null>(null)
const hint = ref('')
const muted = ref(SoundFX.muted)
const toastMsg = ref('')
const toastKey = ref(0)
const saved = ref<any>(null)
const forestName = computed(() => props.oracle?.name || '이름 없는 숲')

function makeRun() {
  return E.newRun({
    day: props.oracle?.day || 'local',
    mutators: props.oracle?.mutators || [],
    bossTitle: props.oracle?.bossTitle || '',
    upgrades: { ...metaApi.meta.upgrades },
    spiritStage: metaApi.spiritStage.value
  })
}

onMounted(() => {
  measure()
  scene = createScene(canvasEl.value!, () => run, { night: props.night, view: () => view })
  window.addEventListener('resize', onResize)
  E.setEmitter((ev: any) => scene?.onEvent(ev))
  SoundFX.unlock()
})
onBeforeUnmount(() => { window.removeEventListener('resize', onResize); E.setEmitter(null); scene?.destroy() })

function restart() {
  saved.value = null
  Object.assign(run, makeRun())
}

// ── 지도 ──
function go(node: any) {
  SoundFX.unlock()
  E.enterNode(run, node)
}

// ── 손패 ──
const fusions = computed(() => (b.value ? E.availableFusions(run) : []))
const playable = (i: number) => E.canPlay(run, i)

function slotStyle(i: number, n: number) {
  const W = view.w
  const cardW = W >= 760 ? 118 : 92
  const avail = Math.min(W - 24, 900)
  const step = n <= 1 ? 0 : Math.min(cardW * 0.92, (avail - cardW) / (n - 1))
  const total = step * (n - 1) + cardW
  const x = (W - total) / 2 + i * step
  const mid = (n - 1) / 2
  const rot = (i - mid) * (n > 6 ? 3 : 4)
  const lift = Math.abs(i - mid) * Math.abs(i - mid) * 2.2
  return { left: x + 'px', transform: `translateY(${lift}px) rotate(${rot}deg)`, zIndex: 10 + i }
}

function tapCard(i: number) {
  if (busy.value) return
  const c = b.value?.hand[i]
  if (!c) return
  if (!E.canPlay(run, i)) {
    shakeUid.value = c.uid
    setTimeout(() => (shakeUid.value = null), 400)
    flashHint('에너지가 부족해요')
    vibrate(20)
    return
  }
  E.playCard(run, i)
  vibrate(10)
}

function doFuse(id: string) { E.fuse(run, id) }

function onStageTap(ev: PointerEvent) {
  if (!scene || run.screen !== 'battle') return
  const uid = scene.pick(ev.clientX / view.z, ev.clientY / view.z)
  if (uid) { E.setTarget(run, uid); vibrate(8) }
}

function flashHint(t: string) {
  hint.value = t
  setTimeout(() => { if (hint.value === t) hint.value = '' }, 1200)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function endTurn() {
  if (busy.value || b.value?.phase !== 'player') return
  busy.value = true
  E.endPlayerTurn(run)
  await sleep(750)
  const count = run.battle?.enemies.length || 0
  for (let i = 0; i < count; i++) {
    if (run.screen !== 'battle' || !run.battle) break
    const e = run.battle.enemies[i]
    if (!e || e.dead) continue
    E.enemyAct(run, i)
    await sleep(e.intent?.n > 2 ? 900 : 650)
  }
  if (run.screen === 'battle' && run.battle && run.battle.phase === 'enemy') E.enemyTurnDone(run)
  busy.value = false
}

// 승리 → 잠시 연출 후 보상 화면
watch(() => run.battle?.phase, (p) => {
  if (p === 'won') setTimeout(() => { if (run.battle?.phase === 'won') E.toReward(run) }, 1700)
})

// 런 종료 → 영구 성장·랭킹 기록
watch(() => run.screen, async (s) => {
  if (s !== 'over' || !run.result || saved.value) return
  saved.value = metaApi.recordCardRun(run.result, run.mutators)
  await lb.submit({ name: localStorage.getItem('pj_nick') || '트레이너', score: run.result.score, kills: run.result.kills, time: run.result.time, level: run.result.floors })
})

// ── 덱 선택 ──
const deckList = computed(() => [...run.deck].sort((a: any, b: any) => (CARDS[a.id]?.type || '').localeCompare(CARDS[b.id]?.type || '')))
function onPickDeck(c: any) {
  if (pickMode.value === 'upgrade') {
    if (c.upgraded || !CARDS[c.id]?.up) return
    E.restUpgrade(run, c)
    pickMode.value = null
  } else if (pickMode.value === 'remove') {
    E.removeCard(run, c)
    pickMode.value = null
  }
}

function toggleMute() {
  muted.value = !muted.value
  SoundFX.muted = muted.value
  localStorage.setItem('pj_muted', muted.value ? '1' : '0')
}
function toast(t: string) { toastMsg.value = t; toastKey.value++; setTimeout(() => { if (toastMsg.value === t) toastMsg.value = '' }, 2600) }
</script>

<style scoped>
.cg { position: fixed; left: 0; top: 0; transform-origin: 0 0; overflow: hidden; }
.stage { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: manipulation; }
.topbar { position: fixed; top: calc(6px + var(--sat)); left: 6px; right: 6px; z-index: 40; display: flex; gap: 6px; align-items: center; }
.hpbox { flex: 1; display: flex; align-items: center; gap: 6px; padding: 6px 8px; font-size: 12px; min-width: 0; }
.hpbar { flex: 1; height: 12px; background: #202830; border-radius: 3px; padding: 2px; overflow: hidden; }
.hpbar > div { height: 100%; background: linear-gradient(90deg, #e83830, #f86858); transition: width 0.3s; border-radius: 2px; }
.blk { background: #3868b8; color: #fff; border-radius: 4px; padding: 1px 5px; font-weight: 900; }
.info { display: flex; gap: 8px; padding: 6px 8px; font-size: 12px; }
.sq { width: 44px; height: 44px; padding: 0; font-size: 17px; flex-direction: column; gap: 0; }
.sq small { font-size: 9px; line-height: 1; }
.relics { position: fixed; top: calc(56px + var(--sat)); left: 8px; right: 8px; z-index: 40; display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
.relic { width: 28px; height: 28px; border-radius: 6px; background: #f8f0ff; border: 2px solid #7838b8; display: flex; align-items: center; justify-content: center; font-size: 15px; cursor: pointer; }
.pstat { display: flex; gap: 6px; font-size: 13px; font-weight: 900; color: #fff; text-shadow: 0 1px 2px #000; margin-left: 4px; }
.chain {
  position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(232px + var(--sab)); z-index: 41;
  background: var(--tc); color: #101810; font-weight: 900; padding: 4px 12px; border-radius: 20px; border: 2px solid #101810;
  box-shadow: 0 0 16px var(--tc); font-size: 14px; animation: pop2 0.3s;
}
@keyframes pop2 { from { transform: translateX(-50%) scale(1.4); } }
.fusions { position: fixed; left: 8px; right: 8px; bottom: calc(196px + var(--sab)); z-index: 42; display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.fuse-btn { border: 2px solid #202830; border-radius: 20px; padding: 6px 12px; font-weight: 900; font-size: 13px; background: linear-gradient(90deg, #fff4c0, #ffd0f0, #c8f0ff); animation: fusionPulse 1.1s infinite; min-height: 40px; }
.hand { position: fixed; left: 0; right: 0; bottom: calc(52px + var(--sab)); height: 150px; z-index: 40; transition: opacity 0.2s, transform 0.25s; }
.hand.off { opacity: 0.55; transform: translateY(30px); pointer-events: none; }
.slot { position: absolute; bottom: 0; transition: left 0.25s, transform 0.25s; transform-origin: 50% 120%; cursor: pointer; }
.slot:active { z-index: 99 !important; }
.slot:active :deep(.card) { transform: translateY(-14px) scale(1.06); }
.card-enter-from { opacity: 0; transform: translate(-140px, 60px) rotate(-30deg) scale(0.5) !important; }
.card-leave-to { opacity: 0; transform: translateY(-220px) scale(1.3) !important; }
.card-enter-active { transition: all 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
.card-leave-active { transition: all 0.28s ease-in; position: absolute; }
.shake { animation: shk 0.35s; }
@keyframes shk { 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
.energy {
  position: fixed; left: 10px; bottom: calc(8px + var(--sab)); z-index: 41; width: 62px; height: 62px; border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fffbd0, #f8c820 45%, #b06808); border: 3px solid #202830;
  display: flex; align-items: center; justify-content: center; box-shadow: 0 0 22px rgba(248, 200, 32, 0.9); color: #202830;
}
.energy b { font: 900 26px 'Courier New', monospace; }
.energy small { font: 900 12px 'Courier New', monospace; margin-top: 10px; }
.energy.empty { filter: grayscale(0.8) brightness(0.7); box-shadow: none; }
.piles { position: fixed; left: 80px; bottom: calc(16px + var(--sab)); z-index: 41; display: flex; gap: 10px; color: #e8f0e8; font-weight: 900; font-size: 13px; text-shadow: 0 1px 2px #000; }
.endturn {
  position: fixed; right: 10px; bottom: calc(10px + var(--sab)); z-index: 41; min-height: 50px; padding: 0 18px;
  border: 3px solid #202830; border-radius: 12px; font-weight: 900; font-size: 16px; color: #fff;
  background: linear-gradient(180deg, #e85838, #a82818); box-shadow: inset 0 -4px 0 #781808, 0 4px 0 #101810;
}
.endturn:disabled { filter: grayscale(0.8); }
.endturn:active { transform: translateY(3px); }
.hint { position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(210px + var(--sab)); z-index: 45; background: rgba(0, 0, 0, 0.75); color: #fff; padding: 6px 12px; border-radius: 8px; font-weight: 800; font-size: 13px; }
.overlay { z-index: 60; }
.panel { width: 100%; max-width: 440px; padding: 16px; display: flex; flex-direction: column; gap: 10px; max-height: calc(var(--vh, 100dvh) - 24px); overflow-y: auto; text-align: center; }
.panel.wide { max-width: 620px; }
.panel h2 { font-size: 19px; }
.panel h2 small { font-size: 13px; color: #a87808; }
.sub { font-size: 13px; color: #485850; }
.row { width: 100%; font-size: 15px; padding: 8px; }
.row2 { display: flex; gap: 6px; justify-content: center; }
.row2 .btn { flex: 1; font-size: 13px; }
.pick-row { display: flex; gap: 8px; justify-content: center; padding: 10px 4px; }
.pick-row.wrap { flex-wrap: wrap; }
.pick { cursor: pointer; transition: transform 0.12s; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.pick:active { transform: scale(0.95); }
.pick.disabled { opacity: 0.35; pointer-events: none; }
.pick.sold { opacity: 0.35; pointer-events: none; }
.pick.poor .price { color: #c83828; }
.price { font: 900 13px 'Courier New', monospace; }
.deck-grid { max-height: calc(var(--vh, 100dvh) * 0.55); }
.relic-pick { display: flex; flex-direction: column; gap: 6px; }
.relic-card { display: flex; align-items: center; gap: 10px; text-align: left; border: 3px solid #202830; border-radius: 10px; padding: 8px 10px; background: linear-gradient(180deg, #f8f0ff, #e8d8f8); box-shadow: inset 0 0 0 2px #7838b8; font-size: 13px; }
.relic-card:disabled { opacity: 0.5; }
.relic-card .ri { font-size: 28px; }
.relic-card small { display: block; color: #586060; font-size: 12px; }
.relic-card em { margin-left: auto; font-style: normal; font-weight: 900; white-space: nowrap; }
.ev-icon { font-size: 48px; }
.result { font-weight: 900; color: #206830; }
.mlist { list-style: none; text-align: left; font-size: 13px; display: flex; flex-direction: column; gap: 4px; background: #e8ece0; border-radius: 6px; padding: 8px; }
.badge { align-self: center; padding: 2px 9px; background: #c83828; color: #fff; font-size: 10px; font-weight: 900; border-radius: 3px; }
.score { display: flex; flex-direction: column; align-items: center; }
.score small { font-size: 11px; color: #586860; font-weight: 800; }
.score b { font-size: 32px; color: #206830; }
.best { color: #c83828; font-weight: 900; }
.grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: #e8ece0; border: 2px solid #202830; border-radius: 6px; padding: 10px; }
.grid3 small { display: block; font-size: 11px; color: #586860; font-weight: 800; }
.reward { font-weight: 900; color: #3868b8; }
.evolve { font-weight: 900; color: #b87808; }
.toast { position: fixed; top: calc(92px + var(--sat)); left: 50%; transform: translateX(-50%); z-index: 70; padding: 8px 14px; font-size: 13px; font-weight: 800; max-width: 92vw; }
@media (min-width: 760px) {
  .hand { height: 190px; }
  .chain { bottom: 270px; }
  .fusions { bottom: 234px; }
  /* 넓은 화면: 상단바·에너지·턴종료를 가운데 무대 폭에 모으기 */
  .topbar, .relics { left: 50%; right: auto; width: min(1000px, calc(100% - 12px)); transform: translateX(-50%); }
  .energy { left: max(10px, calc(50% - 540px)); }
  .piles { left: max(80px, calc(50% - 470px)); }
  .endturn { right: max(10px, calc(50% - 540px)); }
}
</style>
