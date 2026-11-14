<template>
  <div class="overlay sheet-wrap">
    <div class="win sheet" :class="{ gold: choice.gold }">
      <div class="head">
        <span class="title">{{ choice.title }}</span>
        <div class="tags">
          <span v-if="choice.auto" class="t red">{{ choice.auto }}</span>
          <span class="t dark">{{ choice.sub }}</span>
        </div>
      </div>

      <div class="cards">
        <button
          v-for="(c, i) in choice.cards" :key="i + c.title"
          type="button" class="card" :class="[c.kind, { synced: c.synced }]"
          @click="$emit('choose', i)"
        >
          <span class="icon">{{ c.icon }}</span>
          <span class="body">
            <span class="line1">
              <b class="name">{{ c.title }}</b>
              <em class="lv">{{ c.lv }}</em>
            </span>
            <span class="chip" :style="{ background: c.tagBg, color: c.tagFg }">{{ c.tag }}</span>
            <span class="desc">{{ c.desc }}</span>
            <span v-if="c.note" class="note">{{ c.note }}</span>
          </span>
          <span class="key">{{ i + 1 }}</span>
        </button>
      </div>

      <button v-if="choice.rerolls > 0" class="btn reroll" @click="$emit('reroll')">
        🎲 다시 뽑기 ({{ choice.rerolls }}회 남음)
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ choice: any }>()
defineEmits(['choose', 'reroll'])
</script>

<style scoped>
.sheet-wrap { align-items: flex-end; }
.sheet {
  width: 100%; max-width: 680px; padding: 14px; animation: sheetUp 0.18s ease-out;
  max-height: calc(100dvh - 24px); display: flex; flex-direction: column; gap: 10px;
}
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px; border-bottom: 2px solid #202830; padding-bottom: 8px; }
.title { font-size: 17px; font-weight: 900; }
.tags { display: flex; gap: 6px; }
.t { padding: 3px 8px; font-size: 11px; font-weight: 900; border-radius: 4px; }
.t.red { background: #e83830; color: #fff; }
.t.dark { background: #202830; color: #f8d838; }
.cards { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.card {
  display: flex; align-items: center; gap: 10px; text-align: left; width: 100%;
  background: #f8f8f0; color: #202830; border: 3px solid #202830; border-radius: 8px;
  box-shadow: inset 0 0 0 2px #80b890, 0 4px 0 #202830; padding: 10px 12px; min-height: 76px; cursor: pointer;
  transition: transform 0.07s steps(2);
}
.card:active { transform: translateY(3px); box-shadow: inset 0 0 0 2px #e0a820, 0 1px 0 #202830; }
.card.synced { box-shadow: inset 0 0 0 3px #e0a820, 0 4px 0 #202830; }
.card.fusion, .card.relic { background: linear-gradient(180deg, #fffbe8, #f8f8f0); animation: fusionPulse 1.1s infinite ease-in-out; }
.icon { font-size: 30px; width: 44px; text-align: center; flex-shrink: 0; }
.body { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.line1 { display: flex; justify-content: space-between; gap: 6px; align-items: baseline; }
.name { font-size: 16px; }
.card.fusion .name { color: #c83828; }
.lv { font-style: normal; font-size: 12px; font-weight: 900; color: #206830; white-space: nowrap; }
.chip { align-self: flex-start; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 900; }
.desc { font-size: 13px; color: #485850; line-height: 1.35; }
.note { font-size: 11px; font-weight: 900; color: #583810; background: #f8e8b8; border: 1px solid #c89818; border-radius: 4px; padding: 2px 6px; align-self: flex-start; }
.key { display: none; font-size: 11px; font-weight: 900; color: #889890; }
.reroll { width: 100%; font-size: 14px; background: #fff4d8; }
@media (min-width: 760px) {
  .sheet-wrap { align-items: center; }
  .cards { flex-direction: row; }
  .card { flex-direction: column; align-items: flex-start; flex: 1; min-height: 190px; }
  .key { display: block; align-self: flex-end; }
  .key::before { content: '키 '; }
}
</style>
