<template>
  <div class="card" :class="[def.type, def.rarity, { up: def.upgraded, dim: dim, sel: selected, mini: mini }]" :style="{ '--tc': color }">
    <div class="cost">{{ def.cost }}</div>
    <div class="art"><span>{{ def.icon }}</span></div>
    <div class="name">{{ def.name }}<b v-if="def.upgraded">+</b></div>
    <div class="kind">{{ kindLabel }}</div>
    <div class="text">{{ text }}</div>
  </div>
</template>

<script setup lang="ts">
import { cardDef } from '~/game/cards/engine.js'
import { cardText } from '~/game/cards/data.js'

const props = defineProps<{ card: any; dim?: boolean; selected?: boolean; mini?: boolean }>()
const COLORS: Record<string, string> = { grass: '#48b848', fire: '#f05030', water: '#4898f8', electric: '#e8b818', psychic: '#b058e0', dragon: '#5868e8', fusion: '#f8a818' }
const def = computed(() => cardDef(props.card))
const color = computed(() => COLORS[def.value.type] || '#888')
const text = computed(() => cardText(def.value))
const kindLabel = computed(() => ({ attack: '공격', skill: '기술', power: '파워' } as any)[def.value.kind] + (def.value.type === 'fusion' ? ' · 조합' : ''))
</script>

<style scoped>
.card {
  position: relative; width: 92px; height: 132px; flex-shrink: 0;
  background: linear-gradient(180deg, #fffdf2, #ece8d8);
  border: 3px solid #202830; border-radius: 9px;
  box-shadow: inset 0 0 0 3px var(--tc), 0 4px 0 #101810, 0 6px 14px rgba(0, 0, 0, 0.4);
  display: flex; flex-direction: column; align-items: center; padding: 5px 5px 4px; color: #202830;
  user-select: none; transition: transform 0.15s, filter 0.15s;
}
.card.rare { box-shadow: inset 0 0 0 3px var(--tc), 0 0 0 2px #f8d838, 0 4px 0 #101810, 0 0 16px rgba(248, 216, 56, 0.6); }
.card.fusion { background: linear-gradient(160deg, #fff4c0, #ffd8f0, #c8f0ff); animation: fusionPulse 1.1s infinite; }
.card.up .name { color: #2a8a3a; }
.card.dim { filter: grayscale(0.7) brightness(0.75); }
.card.sel { transform: translateY(-18px) scale(1.06); }
.cost {
  position: absolute; top: -9px; left: -9px; width: 28px; height: 28px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #fff8a0, #f8c020 55%, #a87008);
  border: 2px solid #202830; font: 900 15px 'Courier New', monospace; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 8px rgba(248, 200, 32, 0.8);
}
.art {
  width: 100%; height: 40px; border-radius: 5px; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(circle, color-mix(in srgb, var(--tc) 45%, white), var(--tc));
  border: 2px solid #202830; font-size: 24px;
}
.card.fusion .art { font-size: 18px; }
.name { margin-top: 3px; font-size: 11.5px; font-weight: 900; text-align: center; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.name b { color: #2a8a3a; }
.kind { font-size: 8.5px; font-weight: 800; color: #fff; background: var(--tc); border-radius: 3px; padding: 0 4px; margin-top: 2px; }
.text { margin-top: 3px; font-size: 9.5px; line-height: 1.2; text-align: center; color: #384048; font-weight: 700; overflow: hidden; }
.card.mini { width: 78px; height: 112px; }
.card.mini .art { height: 32px; font-size: 20px; }
.card.mini .text { font-size: 8.5px; }
@media (min-width: 760px) {
  .card { width: 118px; height: 168px; }
  .art { height: 54px; font-size: 32px; }
  .name { font-size: 14px; }
  .text { font-size: 11px; }
  .kind { font-size: 10px; }
}
</style>
