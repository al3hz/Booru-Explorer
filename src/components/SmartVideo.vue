<template>
  <video
    ref="videoRef"
    :src="src"
    :poster="poster"
    :class="className"
    :aria-label="alt"
    muted
    loop
    playsinline
    preload="none" 
    @error="onError"
    @loadeddata="onLoaded"
  ></video>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue';

export default {
  name: 'SmartVideo',
  props: {
    src: {
      type: String,
      required: true
    },
    poster: {
      type: String,
      default: ''
    },
    alt: {
      type: String,
      default: ''
    },
    className: {
      type: String,
      default: ''
    }
  },
  emits: ['error', 'loaded'],
  setup(props, { emit }) {
    const videoRef = ref(null);
    let observer = null;

    const startObserving = () => {
      if (!videoRef.value) return;

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Unmute specifically if needed, but usually kept muted for autoplay policies
            // videoRef.value.muted = true; 
            videoRef.value.play().catch(e => {
                // Auto-play might be blocked or failed
                // console.warn('Autoplay prevented', e);
            });
          } else {
            videoRef.value.pause();
          }
        });
      }, {
        rootMargin: '50px 0px', // Preload/play slightly before entering viewport
        threshold: 0.25 // Play when 25% visible
      });

      observer.observe(videoRef.value);
    };

    const onError = (e) => {
      emit('error', e);
    };
    
    const onLoaded = (e) => {
        emit('loaded', e);
    };

    onMounted(() => {
      startObserving();
    });

    onUnmounted(() => {
      if (observer) {
        observer.disconnect();
      }
    });

    // Re-observe if src changes meaningfully (though keying usually handles this in lists)
    watch(() => props.src, () => {
       if(videoRef.value) {
           videoRef.value.pause();
           videoRef.value.load();
       }
    });

    return {
      videoRef,
      onError,
      onLoaded
    };
  }
};
</script>

<style scoped>
/* Inherits styles from parent via class binding, minimal functional styles here */
video {
  display: block;
  object-fit: cover;
}
</style>
