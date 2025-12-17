<template>
    <div class="modal-backdrop">
      <!-- Nav Buttons -->
      <button v-if="hasPrev" class="nav-arrow prev" @click.stop="$emit('prev')" title="Previous image">
        ‹
      </button>
      
      <div class="modal-container">
        <!-- Close Button Moved Inside but better positioned -->
        <button class="close-btn" @click="$emit('close')">×</button>
        
        <div class="modal-content">
          <!-- Image Section -->
          <div class="image-section">
            <div v-if="loading" class="image-loader">
              <div class="loader-spinner"></div>
            </div>
            <transition name="slide-fade" mode="out-in">
              <video
                v-if="isVideo"
                :key="`vid-${post.id}`"
                :src="post.large_file_url || post.file_url"
                class="detail-image"
                autoplay
                loop
                muted
                controls
                @loadeddata="loading = false"
                @error="handleImageError"
              ></video>
              <img 
                v-else
                :key="`img-${post.id}`"
                :src="post.large_file_url || post.file_url || post.preview_file_url" 
                :alt="`Post ${post.id}`"
                class="detail-image"
                @load="loading = false"
                @error="handleImageError"
              />
            </transition>
            
          </div>

          <!-- Info Sidebar -->
          <div class="info-sidebar">
            <div class="info-header">
              <div class="header-left">
                <h2 class="post-id">Post #{{ post.id }}</h2>
                <a 
                  :href="post.file_url || post.large_file_url" 
                  target="_blank" 
                  download 
                  class="download-btn-icon"
                  title="Download original image"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </a>
              </div>
            </div>

            <div class="scrollable-info">
              <!-- Stats Grid -->
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="label">Dimensions</span>
                  <span class="value">{{ post.image_width }}x{{ post.image_height }}</span>
                </div>
                <div class="stat-item">
                  <span class="label">Size</span>
                  <span class="value">{{ formatFileSize(post.file_size) }}</span>
                </div>
                <div class="stat-item">
                  <span class="label">Rating</span>
                  <span class="value rating-pill" :class="post.rating">
                    {{ formatRating(post.rating) }}
                  </span>
                </div>
                <div class="stat-item">
                  <span class="label">Score</span>
                  <span class="value">{{ post.score }}</span>
                </div>
              </div>

              <!-- Tags Section -->
              <div class="tags-section">
                <!-- Artist Tags -->
                <div v-if="artistTags.length" class="tag-group">
                  <h3>Artists</h3>
                  <div class="tag-list">
                    <span 
                      v-for="tag in artistTags" 
                      :key="tag" 
                      class="tag artist"
                      @click="$emit('search-tag', tag)"
                      title="Search by artist"
                    >{{ tag }}</span>
                  </div>
                </div>

                <!-- Copyright Tags -->
                <div v-if="copyrightTags.length" class="tag-group">
                  <h3>Series</h3>
                  <div class="tag-list">
                    <span 
                      v-for="tag in copyrightTags" 
                      :key="tag" 
                      class="tag copyright"
                      @click="$emit('search-tag', tag)"
                      title="Search by series"
                    >{{ tag }}</span>
                  </div>
                </div>

                <!-- Character Tags -->
                <div v-if="characterTags.length" class="tag-group">
                  <h3>Characters</h3>
                  <div class="tag-list">
                    <span 
                      v-for="tag in characterTags" 
                      :key="tag" 
                      class="tag character"
                      @click="$emit('search-tag', tag)"
                      title="Search by character"
                    >{{ tag }}</span>
                  </div>
                </div>

                <!-- General Tags -->
                <div v-if="generalTags.length" class="tag-group">
                  <h3>Tags</h3>
                  <div class="tag-list">
                    <span 
                      v-for="tag in generalTags" 
                      :key="tag" 
                      class="tag general"
                      @click="$emit('search-tag', tag)"
                    >{{ tag }}</span>
                  </div>
                </div>
              </div>
              
              <div class="meta-footer">
                 <div class="meta-info">
                   <p>Uploaded on: {{ formatDate(post.created_at) }}</p>
                   <a v-if="post.source" :href="post.source" target="_blank" class="source-link">Original Source ↗</a>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button v-if="hasNext" class="nav-arrow next" @click.stop="$emit('next')" title="Next image">
        ›
      </button>
    </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';

export default {
  name: 'ImageDetailModal',
  props: {
    post: {
      type: Object,
      required: true
    },
    hasPrev: {
      type: Boolean,
      default: false
    },
    hasNext: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'next', 'prev', 'search-tag'],
  setup(props, { emit }) {
    const loading = ref(true);

    const handleImageError = (e) => {
      loading.value = false;
      const target = e.target;
      if (target) {
        // Simple fallback or hide
        target.style.opacity = '0.5';
      }
    };

    const formatFileSize = (bytes) => {
      if (!bytes) return 'N/A';
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatRating = (rating) => {
      const map = {
        'g': 'General',
        's': 'Safe',
        'q': 'Questionable',
        'e': 'Explicit'
      };
      return map[rating] || rating;
    };

    const formatDate = (dateString) => {
      if (!dateString) return '';
      return new Date(dateString).toLocaleDateString();
    };

    const splitTags = (str) => str ? str.split(' ').filter(t => t) : [];

    const artistTags = computed(() => splitTags(props.post.tag_string_artist));
    const copyrightTags = computed(() => splitTags(props.post.tag_string_copyright));
    const characterTags = computed(() => splitTags(props.post.tag_string_character));
    const generalTags = computed(() => splitTags(props.post.tag_string_general));

    const isVideo = computed(() => {
      const ext = props.post.file_ext;
      return ['mp4', 'webm', 'gifv'].includes(ext);
    });

    // Handle Esc key
    const handleKeydown = (e) => {
      if (e.key === 'Escape') emit('close');
      if (e.key === 'ArrowRight') emit('next');
      if (e.key === 'ArrowLeft') emit('prev');
    };

    onMounted(() => {
      window.addEventListener('keydown', handleKeydown);
      document.body.style.overflow = 'hidden'; 
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', handleKeydown);
      document.body.style.overflow = '';
    });

    return {
      loading,
      handleImageError,
      formatFileSize,
      formatRating,
      formatDate,
      artistTags,
      copyrightTags,
      characterTags,
      generalTags,
      isVideo
    };
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(15px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.modal-container {
  width: 100%;
  max-width: 1400px;
  height: 90vh;
  background: rgba(20, 20, 28, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: rotate(90deg);
}

.modal-content {
  display: flex;
  height: 100%;
}

.image-section {
  flex: 1;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.detail-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}

.info-sidebar {
  width: 350px;
  background: rgba(30, 30, 40, 0.8);
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
}

.info-header {
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 50px; /* Keep space for close button visual separation */
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.post-id {
  margin: 0;
  font-size: 20px;
  color: #fff;
}

.download-btn-icon {
  width: 32px;
  height: 32px;
  background: rgba(167, 139, 250, 0.15);
  color: #a78bfa;
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  font-size: 16px;
  transition: all 0.2s;
}

.download-btn-icon:hover {
  background: #a78bfa;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(167, 139, 250, 0.3);
}

.scrollable-info {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* Custom Scrollbar */
.scrollable-info::-webkit-scrollbar { width: 6px; }
.scrollable-info::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 30px;
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-item .label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 4px;
}

.stat-item .value {
  font-size: 14px;
  color: #e2e8f0;
  font-weight: 500;
}

.rating-pill {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  width: fit-content;
}

.rating-pill.g { color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.2); background: rgba(96, 165, 250, 0.1); }
.rating-pill.s { color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.2); background: rgba(74, 222, 128, 0.1); }
.rating-pill.q { color: #facc15; border: 1px solid rgba(250, 204, 21, 0.2); background: rgba(250, 204, 21, 0.1); }
.rating-pill.e { color: #f87171; border: 1px solid rgba(248, 113, 113, 0.2); background: rgba(248, 113, 113, 0.1); }

.tags-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tag-group h3 {
  font-size: 12px;
  color: #94a3b8;
  margin: 0 0 10px 0;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 5px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  background: rgba(255,255,255,0.03);
  transition: all 0.2s;
}

.tag:hover {
  background: rgba(255,255,255,0.1);
}

.tag.artist { color: #c084fc; border: 1px solid rgba(192, 132, 252, 0.2); }
.tag.character { color: #4ade80; border: 1px solid rgba(74, 222, 128, 0.2); }
.tag.copyright { color: #d8b4fe; border: 1px solid rgba(216, 180, 254, 0.2); }
.tag.general { color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.2); }

.meta-footer {
  margin-top: 30px;
  font-size: 12px;
  color: #64748b;
  border-top: 1px solid rgba(255,255,255,0.05);
  padding-top: 15px;
}

.source-link {
  color: #a78bfa;
  text-decoration: none;
}

.source-link:hover {
  text-decoration: underline;
}

@media (max-width: 900px) {
  .modal-backdrop {
    padding: 0; /* Remove backdrop padding on mobile to use full screen */
  }

  .modal-container {
    height: 100%;
    width: 100%;
    max-width: 100%;
    border-radius: 0;
    border: none;
  }
  
  .modal-content {
    flex-direction: column;
    overflow-y: auto;
    /* Enable smooth scrolling */
    -webkit-overflow-scrolling: touch; 
  }
  
  .image-section {
    min-height: 40vh;
    max-height: 60vh; /* Limit image height so info is reachable */
    padding: 10px;
    background: #000; /* Darker bg for image contrast */
    flex-shrink: 0; /* Prevent shrinking */
  }
  
  .info-sidebar {
    width: 100%;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    flex: 1; /* Take remaining space */
    min-height: 0; /* Fix flex overflow issue */
    display: block; /* Allow normal block flow for content */
  }

  .scrollable-info {
    overflow-y: visible; /* Let the parent .modal-content handle scroll */
    padding-bottom: 80px; /* Space for nav buttons if fixed */
  }
  
  /* Adjust header padding since close button is over image */
  .info-header {
    padding-top: 20px; 
  }
  
  .nav-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 40px;
    height: 40px;
    font-size: 24px;
    background: rgba(0,0,0,0.6);
  }
  
  .nav-arrow.prev { left: 10px; margin: 0; }
  .nav-arrow.next { right: 10px; margin: 0; }
}

/* Animations */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}


/* Image switch fade */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Nav Arrows */
.nav-arrow {
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  width: 50px;
  height: 50px;
  border-radius: 50%;
  font-size: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 1010;
  padding-bottom: 4px; /* Fix visual center */
}

.nav-arrow:hover {
  background: rgba(167, 139, 250, 0.8);
  transform: scale(1.1);
}

.nav-arrow.prev {
  margin-right: 20px;
}

.nav-arrow.next {
  margin-left: 20px;
}

/* Close btn adjustment */
.close-btn {
  top: 15px;
  right: 15px; 
}

/* Image Loader */
.image-loader {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 5;
}

.loader-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top-color: #a78bfa;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
