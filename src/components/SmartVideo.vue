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
    :preload="isMobileDevice ? 'metadata' : 'none'" 
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
    
    // Detect if device is mobile
    const isMobileDevice = window.innerWidth <= 768;

    const startObserving = () => {
      if (!videoRef.value) return;
      
      // Skip IntersectionObserver entirely on mobile devices
      // This prevents autoplay after closing modal
      if (isMobileDevice) {
        return;
      }

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Only autoplay on desktop
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
      
      // Strict autoplay watchdog for mobile
      if (videoRef.value && isMobileDevice) {
        videoRef.value.addEventListener('play', (e) => {
           // If we are on mobile, and play is triggered, we check if we should allow it.
           // In card view (which SmartVideo usually is), we generally want NO playback on mobile.
           // Force pause.
           e.preventDefault();
           e.target.pause();
           // console.log("Blocked autoplay on mobile");
        });
      }
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
      isMobileDevice,
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
