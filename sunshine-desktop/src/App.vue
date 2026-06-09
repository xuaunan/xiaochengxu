<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import AppShell from '@/components/AppShell.vue'
import AdminWorkspace from '@/views/AdminWorkspace.vue'
import DriverWorkspace from '@/views/DriverWorkspace.vue'
import PassengerWorkspace from '@/views/PassengerWorkspace.vue'
import { useDesktopState } from '@/composables/useDesktopState'

const desktop = useDesktopState()
const appVersion = shallowRef('dev')

const activeWorkspaceKey = computed(() => desktop.mode.value)

onMounted(async () => {
  void desktop.refreshHealth()
  const info = await window.sunshineDesktop?.getAppInfo()
  if (info?.version) appVersion.value = info.version
})
</script>

<template>
  <AppShell :desktop="desktop">
    <div class="workspace-version">v{{ appVersion }}</div>
    <Transition name="workspace-fade" mode="out-in">
      <PassengerWorkspace
        v-if="activeWorkspaceKey === 'passenger'"
        key="passenger"
        :desktop="desktop"
      />
      <DriverWorkspace
        v-else-if="activeWorkspaceKey === 'driver'"
        key="driver"
        :desktop="desktop"
      />
      <AdminWorkspace
        v-else
        key="admin"
        :desktop="desktop"
      />
    </Transition>
  </AppShell>
</template>
