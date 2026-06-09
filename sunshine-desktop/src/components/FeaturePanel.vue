<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  compact?: boolean
}>()
</script>

<template>
  <section class="feature-panel" :class="{ 'feature-panel--compact': compact }">
    <header class="feature-panel__header">
      <div class="feature-panel__title-wrap">
        <h2 class="feature-panel__title">{{ title }}</h2>
        <p v-if="subtitle" class="feature-panel__subtitle">{{ subtitle }}</p>
      </div>
      <div v-if="$slots.actions" class="feature-panel__actions">
        <slot name="actions" />
      </div>
    </header>
    <slot />
  </section>
</template>
