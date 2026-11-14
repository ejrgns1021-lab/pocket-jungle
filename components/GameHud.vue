<template>
  <div class="hud">
    <!-- 상단 상태바 -->
    <div class="top">
      <div class="pill status">
        <div class="row">
          <span class="lv">LV.{{ hud.level }}</span>
          <div class="bar hp"><div :style="{ width: hpPct + '%', background: hpColor }" /></div>
          <span class="mono small">{{ Math.ceil(hud.hp) }}/{{ hud.maxHp }}</span>
        </div>
        <div class="row">
          <span class="tag xp">XP</span>
          <div class="bar"><div :style="{ width: xpPct + '%', background: '#38b8f8' }" /></div>
          <span class="mono small">{{ Math.floor(hud.xp) }}/{{ hud.xpNeed }}</span>
        </div>
        <div class="row meta">
          <span class="mono">⏱ {{ clock(hud.time) }}</span>
          <span>💀 {{ hud.kills }}</span>
          <span class="mono boss">👑 {{ hud.nextBoss }}s</span>
          <span v-if="hud.revives" title="부활 가능">🪽</span>
          <span v-if="hud.fusionReady" class="fuse blink">✨조합</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn sq" aria-label="일시정지" @click="$emit('pause')">⏸</button>
        <button class="btn sq" aria-label="소리" @click="$emit('mute')">{{ muted ? '🔇' : '🔊' }}</button>
        <button class="btn mult" :class="{ hot: hud.mult > 1 }" @click="$emit('mult')">⚔️x{{ hud.mult }}</button>
        <button v-if="hud.mult > 1" class="btn sq" aria-label="배율 초기화" @click="$emit('reset-mult')">↺</button>
      </div>
    </div>

    <div v-if="hud.boss" class="pill bossbar">
      <div class="bossrow"><span>{{ hud.boss.name }}</span><span class="mono">{{ Math.ceil(hud.boss.pct) }}%</span></div>
      <div class="bar wide"><div :style="{ width: hud.boss.pct + '%', background: hud.boss.pct > 50 ? '#38b848' : hud.boss.pct > 22 ? '#f8c820' : '#e83830' }" /></div>
    </div>

    <div v-if="banner" :key="bannerKey" class="win gold banner pop">{{ banner }}</div>

    <!-- 하단 스킬 독 (터치를 막지 않도록 pointer-events: none) -->
    <div class="dock">
      <span class="count">{{ dock.used }}/{{ dock.max }}</span>
      <span v-for="(it, i) in dock.items" :key="i" class="ico" :class="it.k" :title="it.title">
        {{ it.k === 'fusion' ? it.icon.slice(0, 2) : it.icon }}<b v-if="it.lv">{{ it.lv }}</b>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{ hud: any; dock: any; muted: boolean; banner: string; bannerKey: number }>()
defineEmits(['pause', 'mute', 'mult', 'reset-mult'])

const hpPct = computed(() => Math.max(0, Math.min(100, (props.hud.hp / props.hud.maxHp) * 100)))
const hpColor = computed(() => (hpPct.value > 50 ? '#38b848' : hpPct.value > 25 ? '#f8c820' : '#e83830'))
const xpPct = computed(() => Math.min(100, (props.hud.xp / props.hud.xpNeed) * 100))
const clock = (s: number) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0')
</script>

<style scoped>
.hud { position: fixed; inset: 0; z-index: 20; pointer-events: none; }
.top {
  position: absolute; top: calc(6px + var(--sat)); left: calc(6px + var(--sal)); right: calc(6px + var(--sar));
  display: flex; gap: 6px; align-items: flex-start; justify-content: space-between;
}
.status { padding: 6px 8px; display: flex; flex-direction: column; gap: 4px; flex: 1; max-width: 340px; font-size: 12px; font-weight: 900; }
.row { display: flex; align-items: center; gap: 6px; }
.lv { padding: 2px 6px; background: #c83828; color: #fff; border-radius: 4px; font-size: 11px; min-width: 44px; text-align: center; }
.tag.xp { color: #2068b8; font-size: 11px; min-width: 44px; text-align: center; }
.bar { flex: 1; height: 10px; background: #202830; border: 1px solid #202830; padding: 1px; border-radius: 3px; overflow: hidden; }
.bar > div { height: 100%; transition: width 0.12s linear; }
.small { font-size: 11px; min-width: 58px; text-align: right; }
.meta { gap: 10px; font-size: 12px; color: #202830; }
.boss { color: #b84818; }
.fuse { padding: 1px 6px; border-radius: 4px; background: #f8b818; border: 1px solid #202830; }
.actions { pointer-events: auto; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
.sq { width: 44px; height: 44px; font-size: 16px; padding: 0; }
.mult { height: 40px; padding: 0 8px; font-size: 12px; }
.mult.hot { background: #c82020; color: #fff; box-shadow: inset 0 0 0 2px #f8d838, 0 3px 0 #182018; }
.bossbar {
  position: absolute; top: calc(98px + var(--sat)); left: 50%; transform: translateX(-50%);
  width: min(340px, 78vw); padding: 4px 8px;
}
.bossrow { display: flex; justify-content: space-between; font-size: 11px; font-weight: 900; margin-bottom: 2px; gap: 6px; }
.bossrow span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar.wide { width: 100%; height: 9px; }
.banner {
  position: absolute; top: calc(140px + var(--sat)); left: 50%; transform: translateX(-50%);
  padding: 6px 14px; font-size: 13px; font-weight: 900; color: #c83828; text-align: center;
  white-space: nowrap; max-width: 92vw; overflow: hidden; text-overflow: ellipsis;
}
.dock {
  position: absolute; left: calc(6px + var(--sal)); right: calc(6px + var(--sar)); bottom: calc(6px + var(--sab));
  display: flex; flex-wrap: wrap; gap: 4px; align-items: center; opacity: 0.92;
}
.count { height: 28px; padding: 0 7px; background: #202830; color: #f8d838; border: 2px solid #f8f8f0; border-radius: 5px; display: flex; align-items: center; font-size: 11px; font-weight: 900; }
.ico {
  position: relative; width: 28px; height: 28px; border-radius: 5px; border: 2px solid #202830; background: #f8f8f0;
  display: flex; align-items: center; justify-content: center; font-size: 13px; box-shadow: 0 2px 0 #182018;
}
.ico b { position: absolute; bottom: -4px; right: -4px; padding: 0 2px; background: #202830; color: #fff; font-size: 9px; line-height: 1.2; border-radius: 2px; }
.ico.fusion { background: #fffbe8; border-color: #e0a820; }
.ico.fusion b { color: #f8d838; }
.ico.passive { background: #e8f0ff; border-color: #3868b8; }
.ico.passive b { background: #3868b8; }
.ico.relic { background: #f8f0ff; border-color: #7838b8; }
@media (min-width: 760px) {
  .actions { flex-direction: row; }
  .bossbar { top: calc(10px + var(--sat)); }
  .banner { top: calc(54px + var(--sat)); }
}
</style>
