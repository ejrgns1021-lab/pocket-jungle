<template>
  <div class="overlay">
    <div class="win gold panel">
      <div class="brand">
        <span class="badge">GBA RETRO ROGUELIKE</span>
        <h1>포켓 정글 서바이벌</h1>
        <p class="mono sub">매일 숲이 변한다 · DAY {{ oracle?.day || '...' }}</p>
      </div>

      <div class="tabs">
        <button v-for="t in tabs" :key="t.id" class="tab" :class="{ on: tab === t.id }" @click="tab = t.id">{{ t.label }}</button>
      </div>

      <!-- 모험 탭 -->
      <div v-if="tab === 'play'" class="content scroll-y">
        <div class="oracle">
          <div class="o-head">
            <span>🔮 오늘의 숲</span>
            <span class="src" :class="oracle?.source">{{ srcLabel }}</span>
          </div>
          <template v-if="oracle">
            <h2>{{ oracle.name }}</h2>
            <p class="line">“{{ oracle.line }}”</p>
            <ul class="mutators">
              <li v-for="id in oracle.mutators" :key="id">
                <span class="mi">{{ M[id]?.icon }}</span>
                <span><b>{{ M[id]?.name }}</b><small>{{ M[id]?.desc }}</small></span>
              </li>
            </ul>
            <p v-if="oracle.bossTitle" class="boss">👑 오늘의 보스는 <b>「{{ oracle.bossTitle }}」</b> 칭호를 달고 나타난다</p>
          </template>
          <p v-else class="line">신탁을 읽는 중…</p>
        </div>

        <div class="chips">
          <span class="chip" :class="night ? 'night' : 'day'">{{ night ? '🌙 밤의 정글 (적 체력↑ 경험치 +25%)' : '☀️ 낮의 정글' }}</span>
          <span class="chip spirit">🌱 {{ stageName }} 동행</span>
          <span v-if="meta.bestScore" class="chip">🏆 최고 {{ meta.bestScore.toLocaleString() }}</span>
        </div>

        <label class="nick">
          <span>트레이너 이름</span>
          <input v-model="nick" maxlength="12" placeholder="트레이너" @change="saveNick">
        </label>

        <p class="howto">👆 화면 아무 곳이나 끌어서 이동 · 스킬은 자동 발사 · ⌨️ WASD / 1·2·3 / R / P</p>
      </div>

      <!-- 성장 탭 -->
      <div v-else-if="tab === 'grow'" class="content scroll-y">
        <div class="essence">💠 정수 <b class="mono">{{ meta.essence.toLocaleString() }}</b> <small>판이 끝날 때마다 쌓여요</small></div>
        <div class="spirit-box">
          <b>🌱 정령 진화</b> — 누적 처치 {{ meta.totalKills.toLocaleString() }}마리 · 현재 <b>{{ stageName }}</b>
          <small v-if="nextStage"> (다음 단계까지 {{ (nextStage.min - meta.totalKills).toLocaleString() }}마리)</small>
        </div>
        <div class="upgrades">
          <div v-for="u in UPG" :key="u.id" class="upg">
            <span class="ui">{{ u.icon }}</span>
            <span class="ub"><b>{{ u.name }}</b> <em>Lv.{{ levelOf(u.id) }}/{{ u.max }}</em><small>{{ u.desc }}</small></span>
            <button class="btn buy" :disabled="levelOf(u.id) >= u.max || meta.essence < cost(u)" @click="buy(u.id)">
              {{ levelOf(u.id) >= u.max ? 'MAX' : '💠' + cost(u) }}
            </button>
          </div>
        </div>
      </div>

      <!-- 랭킹 탭 -->
      <div v-else class="content scroll-y">
        <p v-if="!lb.enabled.value" class="howto">Firebase를 연결하면 같은 '오늘의 숲'을 플레이한 사람들과 순위를 겨룰 수 있어요.</p>
        <template v-else>
          <p class="howto">오늘({{ oracle?.day }}) 같은 숲에서 겨룬 순위 · 매일 자정 초기화</p>
          <ol class="rank">
            <li v-for="(r, i) in lb.rows.value" :key="r.uid" :class="{ me: r.uid === lb.myUid.value }">
              <span class="rk">{{ i + 1 }}</span>
              <span class="rn">{{ r.name }}</span>
              <span class="rs mono">{{ r.score.toLocaleString() }}</span>
              <small>{{ Math.floor(r.time / 60) }}분 · LV{{ r.level }}</small>
            </li>
            <li v-if="!lb.rows.value.length" class="empty">아직 기록이 없어요. 첫 번째가 되어 보세요!</li>
          </ol>
        </template>
      </div>

      <button class="btn-start go" :disabled="!oracle" @click="$emit('start')">▶ 모험 시작하기</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MUTATORS } from '~/game/mutators.js'
import { META_UPGRADES, upgradeCost, SPIRIT_STAGES } from '~/game/meta.js'

const props = defineProps<{ oracle: any; night: boolean; initialTab?: string }>()
defineEmits(['start'])

const M = MUTATORS as Record<string, { icon: string; name: string; desc: string }>
const UPG = META_UPGRADES
const tabs = [{ id: 'play', label: '⚔️ 모험' }, { id: 'grow', label: '💠 성장' }, { id: 'rank', label: '🏆 랭킹' }]
const tab = ref(props.initialTab || 'play')

const { meta, buy, levelOf, spiritStage } = useMeta()
const lb = useLeaderboard()
const cost = (u: any) => upgradeCost(u, levelOf(u.id))
const stageName = computed(() => SPIRIT_STAGES[spiritStage.value].name)
const nextStage = computed(() => SPIRIT_STAGES[spiritStage.value + 1])
const srcLabel = computed(() => ({ ai: '✨ AI 신탁', cache: '✨ AI 신탁', local: '🎲 숲의 기억' } as any)[props.oracle?.source] || '')

const nick = ref('')
onMounted(() => { nick.value = localStorage.getItem('pj_nick') || '' })
const saveNick = () => localStorage.setItem('pj_nick', nick.value.trim())
watch(tab, (t) => { if (t === 'rank') lb.loadTop() })
</script>

<style scoped>
.panel { width: 100%; max-width: 480px; max-height: calc(100dvh - 24px); padding: 16px; display: flex; flex-direction: column; gap: 10px; }
.brand { text-align: center; }
.badge { display: inline-block; padding: 3px 10px; background: #202830; color: #f8d838; font-size: 10px; font-weight: 900; letter-spacing: 0.08em; border-radius: 4px; }
h1 { font-size: 26px; font-weight: 900; color: #206830; margin-top: 6px; }
.sub { font-size: 12px; color: #c83828; }
.tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.tab { min-height: 40px; border: 2px solid #202830; border-radius: 6px; background: #e8ece0; font-weight: 900; font-size: 14px; color: #485850; }
.tab.on { background: #202830; color: #f8d838; }
.content { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
.oracle { background: #202830; color: #f8f8f0; border-radius: 8px; padding: 12px; border: 2px solid #489868; }
.o-head { display: flex; justify-content: space-between; font-size: 12px; font-weight: 900; color: #a8d8b8; }
.src { padding: 1px 6px; border-radius: 3px; background: #485058; }
.src.ai, .src.cache { background: #7838b8; color: #fff; }
h2 { font-size: 20px; color: #f8d838; margin: 4px 0 2px; }
.line { font-size: 13px; color: #c8d8d0; font-style: italic; }
.mutators { list-style: none; display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.mutators li { display: flex; gap: 8px; align-items: center; background: rgba(248, 248, 240, 0.08); border-radius: 6px; padding: 6px 8px; }
.mi { font-size: 22px; }
.mutators b { display: block; font-size: 14px; }
.mutators small { font-size: 12px; color: #b8c8c0; }
.boss { margin-top: 8px; font-size: 12px; color: #f8b8a8; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { padding: 4px 8px; border-radius: 5px; font-size: 12px; font-weight: 800; background: #e8ece0; border: 1px solid #489868; }
.chip.night { background: #283058; color: #f8f8f0; border-color: #202830; }
.chip.day { background: #fff4c8; }
.nick { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 900; }
.nick input { flex: 1; min-height: 40px; border: 2px solid #202830; border-radius: 6px; padding: 0 10px; font-size: 16px; background: #fff; }
.howto { font-size: 12px; color: #485850; line-height: 1.5; }
.essence { font-size: 15px; font-weight: 900; }
.essence b { color: #3868b8; font-size: 20px; }
.essence small, .spirit-box small { font-size: 11px; color: #586860; font-weight: 600; }
.spirit-box { font-size: 13px; background: #e8f4e0; border: 1px solid #489868; border-radius: 6px; padding: 8px; }
.upgrades { display: flex; flex-direction: column; gap: 6px; }
.upg { display: flex; align-items: center; gap: 8px; background: #fff; border: 2px solid #202830; border-radius: 8px; padding: 6px 8px; }
.ui { font-size: 22px; width: 32px; text-align: center; }
.ub { flex: 1; font-size: 14px; }
.ub em { font-style: normal; font-size: 11px; color: #206830; font-weight: 900; }
.ub small { display: block; font-size: 12px; color: #586860; }
.buy { min-width: 76px; font-size: 13px; }
.rank { list-style: none; display: flex; flex-direction: column; gap: 4px; }
.rank li { display: grid; grid-template-columns: 30px 1fr auto; grid-template-rows: auto auto; column-gap: 8px; padding: 6px 8px; background: #fff; border: 2px solid #202830; border-radius: 6px; font-size: 14px; }
.rank li small { grid-column: 2 / 4; font-size: 11px; color: #586860; }
.rank li.me { background: #fff4c8; border-color: #e0a820; }
.rk { grid-row: 1 / 3; font-weight: 900; font-size: 18px; color: #c83828; align-self: center; text-align: center; }
.rn { font-weight: 900; }
.rs { color: #206830; }
.empty { display: block !important; text-align: center; color: #586860; }
.go { width: 100%; font-size: 18px; letter-spacing: 0.04em; }
</style>
