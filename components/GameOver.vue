<template>
  <div class="overlay">
    <div class="win panel">
      <span class="badge">EXPEDITION OVER</span>
      <h2>눈앞이 깜깜해졌다!</h2>
      <p class="forest">{{ forestName }}</p>

      <div class="score">
        <small>점수</small>
        <b class="mono">{{ result.score.toLocaleString() }}</b>
        <span v-if="result.newBest" class="best blink">🏆 신기록!</span>
      </div>

      <div class="grid">
        <div><small>생존</small><b class="mono">{{ clock(stats.time) }}</b></div>
        <div><small>레벨</small><b>LV.{{ stats.level }}</b></div>
        <div><small>처치</small><b>{{ stats.kills.toLocaleString() }}</b></div>
        <div><small>보스</small><b>{{ stats.bossKills }}마리</b></div>
        <div><small>최고 배율</small><b>x{{ stats.peakMult }}</b></div>
        <div><small>진화·유물</small><b>{{ stats.fusions }} · {{ stats.relics }}</b></div>
      </div>

      <div v-if="stats.build.length" class="build">{{ stats.build.join(' ') }}</div>

      <div class="reward">💠 정수 +{{ result.essence }} 획득</div>
      <div v-if="result.evolved" class="evolve blink">🌟 동료 정령이 진화했다! 다음 판부터 더 강해진다</div>
      <p v-if="submitted" class="rank-note">오늘의 랭킹에 기록되었어요</p>

      <div class="btns">
        <button class="btn-start" @click="$emit('restart')">▶ 다시 모험</button>
        <div class="row">
          <button class="btn" @click="$emit('menu', 'grow')">💠 성장하기</button>
          <button class="btn" @click="$emit('menu', 'rank')">🏆 랭킹</button>
          <button class="btn" @click="share">📤 공유</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ stats: any; result: any; forestName: string; submitted: boolean }>()
defineEmits(['restart', 'menu'])
const clock = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0')

async function share() {
  const text = `🌿 포켓 정글 서바이벌 — 오늘의 숲「${props.forestName}」에서 ${clock(props.stats.time)} 생존, ${props.stats.kills}마리 처치! 점수 ${props.result.score.toLocaleString()}`
  try {
    if (navigator.share) await navigator.share({ text, url: location.href })
    else { await navigator.clipboard.writeText(text + ' ' + location.href); alert('클립보드에 복사했어요!') }
  } catch (e) {}
}
</script>

<style scoped>
.panel { width: 100%; max-width: 400px; padding: 18px; text-align: center; display: flex; flex-direction: column; gap: 10px; max-height: calc(100dvh - 24px); overflow-y: auto; }
.badge { align-self: center; padding: 2px 9px; background: #c83828; color: #fff; font-size: 10px; font-weight: 900; border-radius: 3px; }
h2 { font-size: 21px; font-weight: 900; }
.forest { font-size: 12px; color: #586860; margin-top: -6px; }
.score { display: flex; flex-direction: column; align-items: center; }
.score small { font-size: 11px; color: #586860; font-weight: 800; }
.score b { font-size: 32px; color: #206830; }
.best { font-size: 13px; font-weight: 900; color: #c83828; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: #e8ece0; border: 2px solid #202830; border-radius: 6px; padding: 10px; text-align: left; }
.grid small { display: block; font-size: 11px; color: #586860; font-weight: 800; }
.grid b { font-size: 15px; }
.build { font-size: 20px; letter-spacing: 2px; }
.reward { font-weight: 900; color: #3868b8; font-size: 15px; }
.evolve { font-weight: 900; color: #b87808; font-size: 13px; }
.rank-note { font-size: 12px; color: #206830; font-weight: 800; }
.btns { display: flex; flex-direction: column; gap: 8px; }
.btns .btn-start { font-size: 17px; }
.row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.row .btn { font-size: 13px; }
</style>
