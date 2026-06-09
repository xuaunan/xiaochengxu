<script setup lang="ts">
import { Check, Circle } from '@lucide/vue'
import type { TimelineStep } from '@/types'

defineProps<{
  steps: TimelineStep[]
}>()
</script>

<template>
  <ol class="flow-timeline">
    <li
      v-for="step in steps"
      :key="step.key"
      class="flow-timeline__item"
      :class="{ 'is-done': step.done, 'is-current': step.current }"
    >
      <span class="flow-timeline__icon" aria-hidden="true">
        <Check v-if="step.done" :size="16" />
        <Circle v-else :size="13" />
      </span>
      <span class="flow-timeline__copy">
        <strong>{{ step.label }}</strong>
        <small>{{ step.desc }}</small>
      </span>
    </li>
  </ol>
</template>
