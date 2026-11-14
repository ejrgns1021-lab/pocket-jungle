<template>
  <div class="map-wrap">
    <div class="map-head">
      <b>🗺️ ACT {{ run.act }} · {{ forest }}</b>
      <small>빛나는 칸을 눌러 이동</small>
    </div>
    <div ref="scroller" class="scroll scroll-y">
      <div class="map" :style="{ height: mapH + 'px' }">
        <svg class="lines" :width="mapW" :height="mapH">
          <template v-for="(row, ri) in run.map.rows" :key="'r' + ri">
            <template v-for="n in row" :key="'n' + ri + '-' + n.col">
              <line
                v-for="nc in n.next" :key="nc"
                :x1="px(n.col)" :y1="py(ri)" :x2="px(nc)" :y2="py(ri + 1)"
                :class="{ walked: n.visited && isVisited(ri + 1, nc), live: isCurrent(ri, n.col) && isAvail(ri + 1, nc) }"
              />
            </template>
          </template>
        </svg>
        <template v-for="(row, ri) in run.map.rows" :key="'b' + ri">
          <button
            v-for="n in row" :key="ri + '-' + n.col" type="button"
            class="node" :class="[n.type, { avail: isAvail(ri, n.col), visited: n.visited, cur: isCurrent(ri, n.col) }]"
            :style="{ left: px(n.col) + 'px', top: py(ri) + 'px' }"
            :disabled="!isAvail(ri, n.col)"
            @click="$emit('go', n)"
          >
            <span>{{ NODE_INFO[n.type].icon }}</span>
          </button>
        </template>
      </div>
    </div>
    <div class="legend">
      <span v-for="(v, k) in NODE_INFO" :key="k">{{ v.icon }} {{ v.name }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NODE_INFO } from '~/game/cards/data.js'
import { availableNodes } from '~/game/cards/engine.js'

const props = defineProps<{ run: any; forest: string }>()
defineEmits(['go'])
const scroller = ref<HTMLElement | null>(null)
const mapW = ref(340)
const ROW_H = 74
const mapH = computed(() => (props.run.map.rows.length) * ROW_H + 60)
const px = (col: number) => 40 + (col / 3) * (mapW.value - 80)
const py = (row: number) => mapH.value - 40 - row * ROW_H
const avail = computed(() => new Set(availableNodes(props.run).map((n: any) => n.row + ':' + n.col)))
const isAvail = (r: number, c: number) => avail.value.has(r + ':' + c)
const isVisited = (r: number, c: number) => !!props.run.map.rows[r]?.find((n: any) => n.col === c && n.visited)
const isCurrent = (r: number, c: number) => props.run.pos?.row === r && props.run.pos?.col === c

function scrollToCurrent() {
  nextTick(() => {
    const el = scroller.value
    if (!el) return
    mapW.value = Math.min(420, el.clientWidth)
    const row = props.run.pos ? props.run.pos.row + 1 : 0
    el.scrollTop = Math.max(0, py(row) - el.clientHeight * 0.6)
  })
}
onMounted(scrollToCurrent)
watch(() => props.run.pos, scrollToCurrent)
</script>

<style scoped>
.map-wrap {
  position: fixed; inset: 0; z-index: 30; display: flex; flex-direction: column;
  padding: calc(64px + var(--sat)) 10px calc(10px + var(--sab));
  background: linear-gradient(180deg, rgba(14, 28, 18, 0.55), rgba(14, 28, 18, 0.9));
}
.map-head { color: #f8f8f0; display: flex; justify-content: space-between; align-items: baseline; padding: 0 4px 6px; }
.map-head b { font-size: 15px; }
.map-head small { font-size: 11px; color: #a8d8b8; }
.scroll { flex: 1; min-height: 0; border: 3px solid #202830; border-radius: 10px; background: repeating-linear-gradient(45deg, #2a4a30 0 12px, #284628 12px 24px); box-shadow: inset 0 0 0 3px #489868; }
.map { position: relative; margin: 0 auto; max-width: 420px; }
.lines { position: absolute; inset: 0; }
.lines line { stroke: rgba(248, 248, 240, 0.25); stroke-width: 3; stroke-dasharray: 6 6; }
.lines line.walked { stroke: #f8d838; stroke-dasharray: none; stroke-width: 4; }
.lines line.live { stroke: #ffffff; stroke-dasharray: 6 4; stroke-width: 4; animation: dash 0.6s linear infinite; }
@keyframes dash { to { stroke-dashoffset: -20; } }
.node {
  position: absolute; transform: translate(-50%, -50%); width: 46px; height: 46px; border-radius: 50%;
  border: 3px solid #202830; background: #e8ece0; font-size: 21px; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 3px 0 #101810; opacity: 0.78; padding: 0;
}
.node.boss { width: 70px; height: 70px; font-size: 34px; background: #ffd8c8; opacity: 0.85; }
.node.elite { background: #f8d8d8; }
.node.rest { background: #ffe8b8; }
.node.shop { background: #d8f0ff; }
.node.treasure { background: #fff0a0; }
.node.visited { opacity: 0.9; background: #b8c8b0; filter: grayscale(0.5); }
.node.cur { opacity: 1; filter: none; box-shadow: 0 0 0 4px #f8d838, 0 3px 0 #101810; }
.node.avail { opacity: 1; animation: pulse 0.9s infinite ease-in-out; cursor: pointer; box-shadow: 0 0 0 3px #fff, 0 0 18px #f8f8a0, 0 3px 0 #101810; }
@keyframes pulse { 50% { transform: translate(-50%, -50%) scale(1.14); } }
.legend { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; padding-top: 6px; font-size: 11px; color: #d8e8d8; font-weight: 700; }
</style>
