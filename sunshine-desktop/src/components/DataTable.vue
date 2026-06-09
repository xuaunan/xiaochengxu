<script setup lang="ts" generic="T extends object">
export interface DataColumn<T> {
  key: keyof T | string
  label: string
  width?: string
  align?: 'left' | 'right' | 'center'
  format?: (row: T) => string
}

const props = defineProps<{
  rows: T[]
  columns: DataColumn<T>[]
  emptyText?: string
}>()

function getCellValue(row: T, column: DataColumn<T>) {
  if (column.format) return column.format(row)
  const value = (row as Record<string, unknown>)[String(column.key)]
  return value == null ? '' : String(value)
}

function getRowKey(row: T, index: number) {
  return String((row as Record<string, unknown>).id ?? index)
}
</script>

<template>
  <div class="data-table" role="table">
    <div class="data-table__head" role="row">
      <div
        v-for="column in props.columns"
        :key="String(column.key)"
        class="data-table__cell data-table__cell--head"
        :style="{ width: column.width, textAlign: column.align || 'left' }"
        role="columnheader"
      >
        {{ column.label }}
      </div>
      <div v-if="$slots.actions" class="data-table__cell data-table__cell--head data-table__actions-head" role="columnheader">
        操作
      </div>
    </div>
    <div v-if="props.rows.length" class="data-table__body">
      <div v-for="(row, index) in props.rows" :key="getRowKey(row, index)" class="data-table__row" role="row">
        <div
          v-for="column in props.columns"
          :key="String(column.key)"
          class="data-table__cell"
          :style="{ width: column.width, textAlign: column.align || 'left' }"
          role="cell"
        >
          {{ getCellValue(row, column) }}
        </div>
        <div v-if="$slots.actions" class="data-table__cell data-table__actions" role="cell">
          <slot name="actions" :row="row" />
        </div>
      </div>
    </div>
    <div v-else class="data-table__empty">{{ props.emptyText || '暂无数据' }}</div>
  </div>
</template>
