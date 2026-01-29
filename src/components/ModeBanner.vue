<template>
  <div class="info-banner" :class="typeClass">
    <div class="banner-content">
      <span class="icon">{{ icon }}</span>
      <span>{{ text }}</span>
    </div>
    <button class="clear-mode-btn" @click="$emit('clear')" title="Clear filter">
      ✕
    </button>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  icon: String,
  text: String,
  type: String,
});

defineEmits(["clear"]);

const typeClass = computed(() => ({
  "deleted-mode": props.type === "deleted",
  "likes-mode": props.type === "likes",
  "favs-mode": props.type === "favs",
  "trending-mode": props.type === "trending",
}));
</script>

<style scoped>
/* Copiar aquí los estilos de .info-banner desde tu HomeView original */
.info-banner {
  background: #3b82f626;
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #93c5fd;
  padding: 12px 16px;
  border-radius: 12px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 500;
  position: relative;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.info-banner.deleted-mode {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.info-banner.likes-mode {
  background: rgba(236, 72, 153, 0.15);
  border-color: rgba(236, 72, 153, 0.3);
  color: #fbcfe8;
}

.info-banner.favs-mode {
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.3);
  color: #fde68a;
}

.info-banner.trending-mode {
  background: rgba(249, 115, 22, 0.15);
  border-color: rgba(249, 115, 22, 0.3);
  color: #fdba74;
}

.clear-mode-btn {
  position: absolute;
  right: 16px;
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
  opacity: 0.7;
  padding: 4px;
}

.clear-mode-btn:hover {
  opacity: 1;
}
</style>
