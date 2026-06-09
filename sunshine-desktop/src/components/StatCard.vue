<script setup lang="ts">
import { computed } from 'vue'
import type { Metric } from '@/types'

const props = defineProps<{
  metric: Metric
}>()

const toneClass = computed(() => `stat-card--${props.metric.tone}`)
</script>

<template>
  <article class="stat-card" :class="toneClass">
    <span class="stat-card__label">{{ metric.label }}</span>
    <strong class="stat-card__value">{{ metric.value }}</strong>
    <small class="stat-card__delta">{{ metric.delta }}</small>
  </article>
</template>
