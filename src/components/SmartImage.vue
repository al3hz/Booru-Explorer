
<template>
  <div 
    class="smart-image-container" 
    :style="{ paddingBottom: aspectRatio ? `${(1 / aspectRatio) * 100}%` : undefined }"
    ref="container"
  >
    <!-- Placeholder / Thumb -->
    <div 
      v-if="!isLoaded && !error" 
      class="placeholder" 
      :style="{ backgroundColor: placeholderColor || '#1e293b' }"
    >
      <div v-if="loading" class="spinner"></div>
    </div>

    <!-- Actual Image -->
    <img
      v-if="shouldLoad"
      ref="img"
      :src="src"
      :alt="alt"
      class="smart-image"
      :class="{ 'is-loaded': isLoaded }"
      @load="onLoad"
      @error="onError"
      draggable="false"
    />

    <!-- Error State -->
    <div v-if="error" class="error-state">
      <i class="lni lni-image"></i>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';

const props = defineProps({
  src: {
    type: String,
    required: true
  },
  alt: {
    type: String,
    default: ''
  },
  aspectRatio: {
    type: Number,
    default: 1
  },
  placeholderColor: {
    type: String,
    default: null
  },
  priority: {
    type: Boolean,
    default: false
  },
  threshold: {
    type: Number,
    default: 0.1
  }
});

const emit = defineEmits(['load', 'error']);

const container = ref(null);
const img = ref(null);
const isLoaded = ref(false);
const error = ref(false);
const loading = ref(true);
const shouldLoad = ref(props.priority);

let observer = null;

const onLoad = () => {
  isLoaded.value = true;
  loading.value = false;
  emit('load');
};

const onError = () => {
  error.value = true;
  loading.value = false;
  emit('error');
};

onMounted(() => {
  if (props.priority) {
    shouldLoad.value = true;
    return;
  }

  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        shouldLoad.value = true;
        observer.disconnect();
      }
    }, {
      rootMargin: '200px', // Load before it comes into view
      threshold: props.threshold
    });
    
    if (container.value) {
      observer.observe(container.value);
    }
  } else {
    // Fallback for no IO support
    shouldLoad.value = true;
  }
});

onUnmounted(() => {
  if (observer) observer.disconnect();
});

watch(() => props.src, () => {
  if (props.src) {
    isLoaded.value = false;
    error.value = false;
    loading.value = true;
    if (props.priority) shouldLoad.value = true;
  }
});
</script>

<style scoped>
.smart-image-container {
  position: relative;
  width: 100%;
  overflow: hidden;
  background: #0f172a;
  border-radius: inherit; /* Inherit from parent */
}

.smart-image {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s ease-out;
  border-radius: inherit;
}

.smart-image.is-loaded {
  opacity: 1;
}

.placeholder {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: inherit;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-left-color: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.error-state {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: #1e293b;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  font-size: 24px;
  border-radius: inherit;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
