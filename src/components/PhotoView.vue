<template>
  <div class="photo-view">
    <div v-if="loading" class="photo-view-loading">
      Loading photos...
    </div>
    
    <div v-else-if="groupedPhotos.size === 0" class="photo-view-empty">
      <div class="empty-message">
        <span class="icon">📷</span>
        <p>No photos found in this folder</p>
      </div>
    </div>
    
    <div v-else class="photo-groups">
      <DateGroup
        v-for="[date, photos] in groupedPhotos"
        :key="date"
        :date="date"
        :photos="photos"
        @photo-click="handlePhotoClick"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import DateGroup from './DateGroup.vue'
import { usePhotos } from '../composables/usePhotos'
import type { Resource } from '../types'

// Props from oCIS folder view system
const props = defineProps<{
  space?: unknown
  items?: Resource[]
}>()

// Emit events back to oCIS
const emit = defineEmits<{
  (e: 'fileClick', resource: Resource): void
}>()

const loading = ref(false)

// Use our photo composable for filtering and grouping
const { filterImages, groupByDate } = usePhotos()

// Computed: filter and group photos
const groupedPhotos = computed(() => {
  if (!props.items || props.items.length === 0) {
    return new Map<string, Resource[]>()
  }
  
  const images = filterImages(props.items)
  return groupByDate(images)
})

// Handle photo click - pass back to oCIS to open preview
function handlePhotoClick(photo: Resource) {
  emit('fileClick', photo)
}

// Watch for changes in items
watch(() => props.items, () => {
  loading.value = false
}, { immediate: true })
</script>

<style scoped>
.photo-view {
  padding: 1rem;
  height: 100%;
  overflow-y: auto;
}

.photo-view-loading,
.photo-view-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--oc-color-text-muted, #666);
}

.empty-message {
  text-align: center;
}

.empty-message .icon {
  font-size: 3rem;
  display: block;
  margin-bottom: 1rem;
}

.photo-groups {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}
</style>
