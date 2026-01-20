<template>
  <div 
    class="video-container" 
    @mouseenter="showControls = true" 
    @mouseleave="handleMouseLeave"
    @mousemove="handleMouseMove"
    @touchstart="handleTouchStart"
    ref="containerRef"
  >
    <video
      ref="videoRef"
      :src="src"
      class="video-element"
      :muted="isMuted"
      @click="togglePlay"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @ended="onEnded"
      @error="$emit('error', $event)"
      playsinline
    ></video>

    <!-- Center Play Button (animation) -->
    <transition name="fade">
      <div v-if="!isPlaying && showCenterPlay" class="center-play-btn" @click="togglePlay">
        <i class="lni lni-play"></i>
      </div>
    </transition>

    <!-- Controls Overlay -->
    <transition name="slide-up">
      <div v-if="showControls" class="controls-overlay">
        <!-- Progress Bar -->
        <div class="progress-container" @click="seek">
          <div class="progress-bg">
            <div class="progress-fill" :style="{ width: progress + '%' }"></div>
            <div class="progress-handle" :style="{ left: progress + '%' }"></div>
          </div>
        </div>

        <div class="controls-row">
          <div class="left-controls">
            <button class="control-btn" @click="togglePlay" title="Play/Pause (Space)">
              <i class="lni" :class="isPlaying ? 'lni-pause' : 'lni-play'"></i>
            </button>
            
            <div class="volume-control" @mouseenter="isVolumeHovered = true" @mouseleave="isVolumeHovered = false">
              <button class="control-btn" @click="toggleMute" title="Mute/Unmute (M)">
                <i class="lni" :class="volumeIcon"></i>
              </button>
              <transition name="width-grow">
                <div v-if="isVolumeHovered || isDraggingVolume" class="volume-slider-container">
                    <input 
                      type="range" 
                      min="0" 
                      max="1" 
                      step="0.05" 
                      :value="isMuted ? 0 : volume" 
                      @input="handleVolumeChange"
                      @mousedown="isDraggingVolume = true"
                      @mouseup="isDraggingVolume = false"
                      class="volume-slider"
                    >
                </div>
              </transition>
            </div>

            <span class="time-display">{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
          </div>

          <div class="right-controls">
            <button 
              class="control-btn" 
              :class="{ 'active': isLooping }" 
              @click="toggleLoop" 
              title="Toggle Loop"
            >
              <i class="lni lni-reload"></i>
            </button>
            
            <button class="control-btn" @click="toggleFullscreen" title="Fullscreen (F)">
               <i class="lni" :class="isFullscreen ? 'lni-close' : 'lni-full-screen'"></i>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';

export default {
  name: 'VideoPlayer',
  props: {
    src: {
      type: String,
      required: true
    }
  },
  emits: ['error', 'loaded'],
  setup(props, { emit }) {
    const videoRef = ref(null);
    const containerRef = ref(null);
    
    // State
    const isPlaying = ref(false);
    const currentTime = ref(0);
    const duration = ref(0);
    const progress = ref(0);
    const isMuted = ref(true); // Default safe
    const volume = ref(1);
    const isLooping = ref(true); // User requested default
    const isFullscreen = ref(false);
    
    // UI State
    const showControls = ref(true);
    const showCenterPlay = ref(true);
    const isVolumeHovered = ref(false);
    const isDraggingVolume = ref(false);
    let controlsTimeout = null;

    // Computed
    const volumeIcon = computed(() => {
      if (isMuted.value || volume.value === 0) return 'lni-volume-mute';
      if (volume.value < 0.5) return 'lni-volume-low';
      return 'lni-volume-high';
    });

    // Formatting
    const formatTime = (seconds) => {
      if (!seconds) return '0:00';
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s < 10 ? '0' + s : s}`;
    };

    // Actions
    const togglePlay = () => {
      if (videoRef.value.paused) {
        videoRef.value.play();
        showCenterPlay.value = false;
        startHideTimer();
      } else {
        videoRef.value.pause();
        showCenterPlay.value = true; 
        showControls.value = true;
        clearTimeout(controlsTimeout);
      }
    };

    const toggleMute = () => {
      isMuted.value = !isMuted.value;
      videoRef.value.muted = isMuted.value;
      saveVolumeSettings();
    };

    const handleVolumeChange = (e) => {
      const val = parseFloat(e.target.value);
      volume.value = val;
      videoRef.value.volume = val;
      if (val > 0) {
        isMuted.value = false;
        videoRef.value.muted = false;
      } else {
        isMuted.value = true;
        videoRef.value.muted = true;
      }
      saveVolumeSettings();
    };

    const toggleLoop = () => {
      isLooping.value = !isLooping.value;
      videoRef.value.loop = isLooping.value;
    };

    const toggleFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await containerRef.value.requestFullscreen();
          
          // Smart Orientation Lock
          if (screen.orientation && screen.orientation.lock && videoRef.value) {
            const ratio = videoRef.value.videoWidth / videoRef.value.videoHeight;
            const orientation = ratio >= 1 ? 'landscape' : 'portrait';
            try {
              await screen.orientation.lock(orientation);
            } catch (err) {
              // Lock might fail on some devices/browsers, ignore
              console.warn('Orientation lock failed:', err);
            }
          }
        } else {
          await document.exitFullscreen();
          if (screen.orientation && screen.orientation.unlock) {
            screen.orientation.unlock();
          }
        }
      } catch (err) {
        console.error(`Error attempting to toggle fullscreen: ${err.message}`);
      }
    };

    // Persistence
    const saveVolumeSettings = () => {
      localStorage.setItem('booru-video-volume', volume.value);
      localStorage.setItem('booru-video-muted', isMuted.value);
    };

    const loadSettings = () => {
      const savedVol = localStorage.getItem('booru-video-volume');
      const savedMute = localStorage.getItem('booru-video-muted');
      
      if (savedVol !== null) {
        volume.value = parseFloat(savedVol);
        if (videoRef.value) videoRef.value.volume = volume.value;
      }
      
      if (savedMute !== null) {
        isMuted.value = savedMute === 'true';
        if (videoRef.value) videoRef.value.muted = isMuted.value;
      }
    };

    // Events
    const onTimeUpdate = () => {
      if (!videoRef.value) return;
      currentTime.value = videoRef.value.currentTime;
      progress.value = (videoRef.value.currentTime / videoRef.value.duration) * 100;
      isPlaying.value = !videoRef.value.paused;
    };

    const onLoadedMetadata = () => {
      if (!videoRef.value) return;
      duration.value = videoRef.value.duration;
      emit('loaded');
      attemptAutoplay();
    };

    const onEnded = () => {
      if (!isLooping.value) {
        isPlaying.value = false;
        showCenterPlay.value = true;
        showControls.value = true;
      }
    };

    const attemptAutoplay = async () => {
      if (!videoRef.value) return;
      
      // Ensure settings are applied before playing
      videoRef.value.loop = isLooping.value; // Force loop true default
      
      try {
        await videoRef.value.play();
        isPlaying.value = true;
        showCenterPlay.value = false;
        startHideTimer();
      } catch (err) {
        // Autoplay failed, likely due to sound. Try muted.
        console.warn("Autoplay with sound failed, muting...", err);
        isMuted.value = true;
        videoRef.value.muted = true;
        try {
          await videoRef.value.play();
          isPlaying.value = true;
          showCenterPlay.value = false;
          startHideTimer();
        } catch (e2) {
           console.error("Autoplay failed completely", e2);
        }
      }
    };

    const seek = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clickedValue = (x / rect.width);
      if (videoRef.value && !isNaN(videoRef.value.duration)) {
        videoRef.value.currentTime = clickedValue * videoRef.value.duration;
      }
    };

    // Controls Hiding
    const startHideTimer = () => {
      clearTimeout(controlsTimeout);
      if (isPlaying.value) {
        controlsTimeout = setTimeout(() => {
          if (!isVolumeHovered.value && !isDraggingVolume.value) {
            showControls.value = false;
          }
        }, 2500);
      }
    };

    const handleMouseMove = () => {
      showControls.value = true;
      startHideTimer();
    };

    const handleTouchStart = () => {
      if (showControls.value) {
        // If controls are shown, allow them to stay for another 2.5s
        startHideTimer();
      } else {
        // If hidden, show them
        showControls.value = true;
        startHideTimer();
      }
    };

    const handleMouseLeave = () => {
       if (isPlaying.value && !isVolumeHovered.value && !isDraggingVolume.value) {
           showControls.value = false;
       }
    };

    // Keyboard Shortcuts
    const handleKeydown = (e) => {
      // Don't interfere if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      
      switch (e.code) {
        case 'Space':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'KeyM':
          toggleMute();
          break;
        case 'KeyF':
          toggleFullscreen();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (videoRef.value) videoRef.value.currentTime += 5;
          break;
        case 'ArrowLeft':
            e.preventDefault();
          if (videoRef.value) videoRef.value.currentTime -= 5;
          break;
      }
    };
    
    // Setup & Cleanup
    onMounted(() => {
      loadSettings();
      window.addEventListener('keydown', handleKeydown);
      document.addEventListener('fullscreenchange', () => {
        isFullscreen.value = !!document.fullscreenElement;
      });
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown);
      clearTimeout(controlsTimeout);
    });

    return {
      videoRef,
      containerRef,
      isPlaying,
      currentTime,
      duration,
      progress,
      isMuted,
      volume,
      isLooping,
      isFullscreen,
      showControls,
      showCenterPlay,
      volumeIcon,
      isVolumeHovered,
      isDraggingVolume,
      togglePlay,
      toggleMute,
      toggleLoop,
      toggleFullscreen,
      handleVolumeChange,
      formatTime,
      onTimeUpdate,
      onLoadedMetadata,
      onEnded,
      seek,
      handleMouseMove,
      handleMouseLeave,
      handleTouchStart
    };
  }
};
</script>

<style scoped>
.video-container {
  width: 100%;
  height: 100%;
  position: relative;
  background: #000;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.video-element {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
}

/* Center Play Button */
.center-play-btn {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 80px;
  height: 80px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 32px;
  cursor: pointer;
  backdrop-filter: blur(4px);
  border: 2px solid rgba(255,255,255,0.2);
  transition: all 0.2s;
  padding-left: 5px; /* Visual fix for icon center */
  z-index: 10;
}

.center-play-btn:hover {
  background: rgba(167, 139, 250, 0.6);
  transform: translate(-50%, -50%) scale(1.1);
}

/* Controls Overlay */
.controls-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
  padding: 20px 20px 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 20;
}

/* Progress Bar */
.progress-container {
  width: 100%;
  height: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  position: relative;
}

.progress-bg {
  width: 100%;
  height: 4px;
  background: rgba(255,255,255,0.2);
  border-radius: 2px;
  position: relative;
  transition: height 0.1s;
}

.progress-container:hover .progress-bg {
  height: 6px;
}

.progress-fill {
  height: 100%;
  background: #a78bfa;
  border-radius: 2px;
  position: absolute;
  top: 0;
  left: 0;
}

.progress-handle {
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.2s;
}

.progress-container:hover .progress-handle {
  opacity: 1;
}

/* Controls Row */
.controls-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.left-controls, .right-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.control-btn {
  background: transparent;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  padding: 5px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  opacity: 0.8;
}

.control-btn:hover {
  opacity: 1;
  background: rgba(255,255,255,0.1);
}

.control-btn.active {
  color: #a78bfa;
  opacity: 1;
}

/* Time */
.time-display {
  color: #ccc;
  font-size: 12px;
  font-family: monospace;
  margin-left: 5px;
}

/* Volume */
.volume-control {
  display: flex;
  align-items: center;
  gap: 5px;
  position: relative;
}

.volume-slider-container {
    width: 60px;
    display: flex;
    align-items: center;
    overflow: hidden;
}

.volume-slider {
  width: 100%;
  height: 4px;
  accent-color: #a78bfa;
  cursor: pointer;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s, opacity 0.3s;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.width-grow-enter-active,
.width-grow-leave-active {
    transition: width 0.3s ease, opacity 0.3s ease;
}
.width-grow-enter-from,
.width-grow-leave-to {
    width: 0;
    opacity: 0;
}
</style>
