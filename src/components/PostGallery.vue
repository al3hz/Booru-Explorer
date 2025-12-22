<template>
  <div class="post-gallery">
    <!-- Loading State -->
    <div v-if="loading && posts.length === 0" class="state-container loading">
      <div class="loader-ring"></div>
      <p>Loading content...</p>
    </div>

    <!-- No Posts State -->
    <div
      v-else-if="posts.length === 0 && !loading"
      class="state-container no-posts"
    >
      <div class="icon-large">🔍</div>
      <h3>No results found</h3>
      <p>Try adjusting your search filters.</p>
    </div>

    <!-- Gallery Grid with Overlay -->
    <div v-else class="gallery-wrapper">
      
      <!-- Rating Distribution Bar -->
      <Transition name="fade-slide">
        <div v-if="!loading && (ratingCounts.g || ratingCounts.s || ratingCounts.q || ratingCounts.e)" class="rating-bar">
           <div class="rating-stat general" title="General">
              <span class="r-dot"></span>
              <span class="r-label">General</span>
              <span class="r-count">{{ formatCount(ratingCounts.g) }}</span>
           </div>
           <div class="rating-stat safe" title="Safe">
              <span class="r-dot"></span>
              <span class="r-label">Safe</span>
              <span class="r-count">{{ formatCount(ratingCounts.s) }}</span>
           </div>
           <div class="rating-stat questionable" title="Questionable">
              <span class="r-dot"></span>
              <span class="r-label">Questionable</span>
              <span class="r-count">{{ formatCount(ratingCounts.q) }}</span>
           </div>
           <div class="rating-stat explicit" title="Explicit">
              <span class="r-dot"></span>
              <span class="r-label">Explicit</span>
              <span class="r-count">{{ formatCount(ratingCounts.e) }}</span>
           </div>
        </div>
      </Transition>

      <div v-if="loading" class="grid-loading-overlay">
        <div class="loader-ring small"></div>
      </div>
      <div class="gallery-grid" :class="{ 'is-dimmed': loading }">
        <div
          v-for="post in posts"
          :key="post.id"
          class="art-card"
          :class="{ 'has-family': post.parent_id || post.has_children }"
          @click="openPost(post)"
        >
          <!-- Image Section -->
          <div 
            class="card-image-wrapper"
          >
            <!-- Video logic unchanged -->
            <!-- Video logic using SmartVideo -->
            <SmartVideo
              v-if="isAnimatedVideo(post)"
              :src="getImageUrl(post)"
              :alt="post.tag_string_general"
              className="card-image"
              @error="handleImageError($event, post)"
            />
            
            <!-- Default Image -->
            <img
              v-else
              :src="getImageUrl(post)"
              :alt="post.tag_string_general"
              :width="post.image_width || 500"
              :height="post.image_height || 500"
              class="card-image"
              :loading="posts.indexOf(post) < 6 ? 'eager' : 'lazy'"
              @error="handleImageError($event, post)"
            />

            <!-- Overlays -->
            <div class="card-overlay">
              <div class="top-badges">
                <span class="id-badge">#{{ post.id }}</span>
                <span class="rating-badge" :class="getRatingClass(post.rating)">
                  {{ getRatingText(post.rating) }}
                </span>
              </div>

              <!-- Status Label -->
              <div class="status-indicators">
                <span
                  v-if="post.is_pending"
                  class="status-badge pending"
                >PENDING</span>
                <span
                  v-if="post.is_deleted"
                  class="status-badge deleted"
                >DELETED</span>
                <span
                  v-if="post.is_flagged"
                  class="status-badge flagged"
                >FLAGGED</span>
              </div>
            </div>
          </div>

          <!-- Content Section -->
          <div class="card-content">
            <!-- Tech Specs Row -->
            <div class="tech-specs">
              <div class="spec-pill" title="Resolution">
                <span class="spec-icon">📐</span>
                {{ getDimensions(post) }}
              </div>
              <div class="spec-pill" title="File Size">
                <span class="spec-icon">💾</span>
                {{ formatFileSize(post.file_size) }}
              </div>
              <div
                class="spec-pill format"
                :class="getExtensionClass(post.file_ext)"
              >
                {{ post.file_ext?.toUpperCase() }}
              </div>
            </div>

            <!-- Stats Row -->
            <div class="stats-row">
              <div class="stat" :class="getScoreClass(post.score)">
                <span class="stat-icon">❤️</span>
                <span class="stat-value">{{ post.score || 0 }}</span>
              </div>
              <div class="stat favs">
                <span class="stat-icon">⭐</span>
                <span class="stat-value">{{ post.fav_count || 0 }}</span>
              </div>
              <div class="stat comments" v-if="post.comment_count">
                <span class="stat-icon">💬</span>
                <span class="stat-value">{{ post.comment_count }}</span>
              </div>
            </div>

            <div class="divider"></div>

            <!-- Footer Info -->
            <div class="card-footer">
              <div class="time-info">
                <span class="icon">🕒</span>
                {{ formatTimeAgo(post.created_at) }}
              </div>
              
              <div 
                v-if="post.source"
                class="source-link"
                @click.stop="openSource(post.source)"
                title="Source"
              >
                <span class="trunc-source">{{ truncateSource(post.source) }}</span>
                <span class="icon-external">↗</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="!infiniteScroll && (currentPage > 1 || hasNextPage)" class="pagination-wrapper">
        <button
          @click="$emit('change-page', currentPage - 1)"
          :disabled="currentPage === 1 || loading"
          class="nav-btn"
        >
          <span class="arrow">←</span> <span class="nav-text">Previous</span>
        </button>
        
        <div class="page-numbers">
            <button
            v-for="page in getPageNumbers()"
            :key="page"
            @click="$emit('change-page', page)"
            :disabled="loading"
            :class="['num-btn', { active: page === currentPage }]"
            >
            {{ page }}
            </button>
        </div>

        <button
          @click="$emit('change-page', currentPage + 1)"
          :disabled="!hasNextPage || loading"
          class="nav-btn"
        >
          <span class="nav-text">Next</span> <span class="arrow">→</span>
        </button>
      </div>

      <!-- Infinite Scroll Loader -->
      <div
        v-if="infiniteScroll && hasNextPage"
        ref="infiniteScrollTrigger"
        class="infinite-loader"
      >
        <div v-if="loading" class="spinner-dots">
          <span></span><span></span><span></span>
        </div>
      </div>

      <div class="results-meta">
        <span v-if="!infiniteScroll">Page {{ currentPage }} • </span>
        {{ posts.length }} results shown
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from "vue";

import SmartVideo from './SmartVideo.vue';

export default {
  name: "PostGallery",
  components: { SmartVideo },
  props: {
    posts: {
      type: Array,
      default: () => [],
    },
    loading: {
      type: Boolean,
      default: false,
    },
    currentPage: {
      type: Number,
      default: 1,
    },
    hasNextPage: {
      type: Boolean,
      default: false,
    },
    infiniteScroll: {
      type: Boolean,
      default: false,
    },
    ratingCounts: {
      type: Object,
      default: () => ({ g: 0, s: 0, q: 0, e: 0 }),
    },
  },
  emits: ["load-more", "change-page", "post-clicked"],
  setup(props, { emit }) {
    const infiniteScrollTrigger = ref(null);
    let observer = null;

    const setupIntersectionObserver = () => {
      if (!props.infiniteScroll || !props.hasNextPage || props.loading) return;

      if (observer) {
        observer.disconnect();
      }

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && props.hasNextPage && !props.loading) {
              emit("load-more");
            }
          });
        },
        {
          rootMargin: "200px",
        }
      );

      if (infiniteScrollTrigger.value) {
        observer.observe(infiniteScrollTrigger.value);
      }
    };

    onMounted(() => {
      if (props.infiniteScroll) {
        setupIntersectionObserver();
      }
    });

    onUnmounted(() => {
      if (observer) {
        observer.disconnect();
      }
    });

    watch(
      [
        () => props.infiniteScroll,
        () => props.hasNextPage,
        () => props.loading,
      ],
      () => {
        if (props.infiniteScroll) {
          setupIntersectionObserver();
        } else if (observer) {
          observer.disconnect();
        }
      }
    );

    watch(
      () => props.posts.length,
      () => {
        if (props.infiniteScroll) {
          setTimeout(() => {
            setupIntersectionObserver();
          }, 100);
        }
      }
    );

    const getPageNumbers = () => {
      const pages = [];
      // Show up to 3 previous pages
      const start = Math.max(1, props.currentPage - 3); 
      
      for (let i = start; i <= props.currentPage; i++) {
        pages.push(i);
      }
      
      // Only show NEXT page if we know it exists
      if (props.hasNextPage) {
        pages.push(props.currentPage + 1);
      }
      
      return pages;
    };

    const formatCount = (count) => {
      if (!count) return '0';
      if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
      if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
      return count.toString();
    };

    return {
      infiniteScrollTrigger,
      getPageNumbers,
      formatCount
    };
  },
  methods: {
    isAnimatedVideo(post) {
      return (
        ["webm", "mp4"].includes(post.file_ext) ||
        (post.file_ext === "zip" &&
          post.large_file_url &&
          post.large_file_url.endsWith(".webm"))
      );
    },

    getImageUrl(post) {
      if (this.isAnimatedVideo(post)) {
        return (
          post.large_file_url ||
          post.file_url ||
          post.sample_url ||
          post.preview_url ||
          ""
        );
      }
      if (post.file_ext === "gif") {
        return post.file_url || post.sample_url || post.preview_url || "";
      }
      if (post.file_ext === "swf") {
        return post.preview_url || post.preview_file_url || "";
      }
      // Usar sample_url para mejor calidad
      return (
        post.sample_url ||
        post.large_file_url ||
        post.file_url ||
        post.preview_url ||
        ""
      );
    },

    handleImageError(event, post) {
     
      const target = event.target;

      if (target.tagName === "VIDEO") {
        target.style.display = "none";
        const container = target.parentElement;
        container.innerHTML = `
          <div class="image-error">
            <div class="error-icon">⚠️</div>
            <div class="error-text">Error loading video</div>
          </div>
        `;
        return;
      }

      // Intentar cargar versiones de menor calidad
      if (post.preview_url && target.src !== post.preview_url) {
        target.src = post.preview_url;
      } else {
        target.style.display = "none";
        const container = target.parentElement;
        container.innerHTML = `
          <div class="image-error">
            <div class="error-icon">⚠️</div>
            <div class="error-text">Error loading image</div>
          </div>
        `;
      }
    },

    getScoreClass(score) {
      if (score > 100) return "score-high";
      if (score > 10) return "score-medium";
      return "score-low";
    },

    openPost(post) {
      this.$emit("post-clicked", post);
    },

    getUploader(uploaderId) {
      return uploaderId ? `User ${uploaderId}` : "Desconocido";
    },

    getDimensions(post) {
      if (post.image_width && post.image_height) {
        return `${post.image_width}×${post.image_height}`;
      }
      return "N/A";
    },

    getAspectRatio(post) {
      if (post.image_width && post.image_height) {
        const ratio = post.image_width / post.image_height;
        return ratio.toFixed(4);
      }
      return '1'; // Default to square if dimensions not available
    },

    formatUploadDate(createdAt) {
      if (!createdAt) return "Desconocido";

      const date = new Date(createdAt);
      return date.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },

    formatTimeAgo(createdAt) {
      if (!createdAt) return 'Unknown';

      const date = new Date(createdAt);
      const now = new Date();
      const diffMs = now - date;

      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      const diffMonths = Math.floor(diffDays / 30);
      const diffYears = Math.floor(diffDays / 365);

      if (diffSeconds < 60) {
        return 'Just now';
      } else if (diffMinutes < 60) {
        return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
      } else if (diffHours < 24) {
        return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
      } else if (diffDays < 7) {
        return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
      } else if (diffWeeks < 4) {
        return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
      } else if (diffMonths < 12) {
        return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
      } else {
        return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
      }
    },

    getRatingText(rating) {
      const ratings = {
        e: "E",
        q: "Q",
        s: "S",
        g: "G",
      };
      return ratings[rating] || "?";
    },

    getRatingClass(rating) {
      const ratingClasses = {
        e: "rating-explicit",
        q: "rating-questionable",
        s: "rating-safe",
        g: "rating-general",
      };
      return ratingClasses[rating] || "";
    },

    formatFileSize(bytes) {
      if (!bytes) return "N/A";

      const units = ["B", "KB", "MB", "GB"];
      let size = bytes;
      let unitIndex = 0;

      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }

      return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
    },

    getExtensionClass(ext) {
      if (!ext) return "";

      const imageExts = ["jpg", "jpeg", "png", "bmp", "tiff", "webp"];
      const videoExts = ["mp4", "webm", "avi", "mov"];
      const animatedExts = ["gif"];
      const flashExts = ["swf"];

      if (imageExts.includes(ext.toLowerCase())) return "format-image";
      if (videoExts.includes(ext.toLowerCase())) return "format-video";
      if (animatedExts.includes(ext.toLowerCase())) return "format-animated";
      if (flashExts.includes(ext.toLowerCase())) return "format-flash";
      return "";
    },

    truncateSource(source) {
      if (!source) return "Sin source";

      if (source.startsWith("file://")) {
        const fileName = source.split("/").pop();
        return fileName.length > 15
          ? fileName.substring(0, 15) + "..."
          : fileName;
      }

      try {
        const url = new URL(source);
        const hostname = url.hostname.replace("www.", "");
        return hostname.length > 20
          ? hostname.substring(0, 20) + "..."
          : hostname;
      } catch {
        return source.length > 25 ? source.substring(0, 25) + "..." : source;
      }
    },

    openSource(source) {
      if (!source) return;

      if (source.startsWith("file://")) {
        return;
      }

      try {
        new URL(source);
        window.open(source, "_blank");
      } catch {
        consol.log("Source no es una URL válida:", source);
      }
    },
  },
};
</script>

<style scoped>
/* Base Layout */
.post-gallery {
  width: 100%;
  font-family: 'Inter', sans-serif;
}

/* State Containers (Loading / No Posts) */
.state-container {
  text-align: center;
  padding: 80px 20px;
  background: rgba(20, 20, 25, 0.4);
  border-radius: 20px;
  color: #e2e8f0;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  width: 100%;
  max-width: 100%;
}

/* Rating Bar */
.rating-bar {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 20px;
  background: rgba(20, 20, 25, 0.4);
  padding: 10px 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  flex-wrap: wrap;
}

.rating-stat {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #cbd5e1;
}

.r-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.rating-stat.general .r-dot { background: #3b82f6; box-shadow: 0 0 8px rgba(59, 130, 246, 0.4); }
.rating-stat.safe .r-dot { background: #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.4); }
.rating-stat.questionable .r-dot { background: #f59e0b; box-shadow: 0 0 8px rgba(245, 158, 11, 0.4); }
.rating-stat.explicit .r-dot { background: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.4); }

.r-label {
  font-weight: 600;
  opacity: 0.9;
}

.r-count {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 11px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loader-ring {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(139, 92, 246, 0.2);
  border-left-color: #a78bfa;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

.loader-ring.small {
  width: 40px;
  height: 40px;
  border-width: 3px;
  margin-bottom: 0;
}

.gallery-wrapper {
  position: relative;
  min-height: 400px;
}

.grid-loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 100px;
  background: rgba(15, 23, 42, 0.2);
  backdrop-filter: blur(2px);
  border-radius: 16px;
  opacity: 0;
  animation: fadeIn 0.3s forwards;
}

.gallery-grid.is-dimmed {
  opacity: 0.6;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

@keyframes fadeIn {
  to { opacity: 1; }
}

.icon-large {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.8;
}

/* Grid Layout */
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); /* Slightly smaller base for desktop */
  gap: 24px;
  padding-bottom: 40px;
}

@media (max-width: 640px) {
  .gallery-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .state-container {
    padding: 40px 16px;
    border-radius: 12px;
    min-height: 200px;
  }
}

/* Art Card Component */
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.art-card {
  cursor: pointer;
  background: rgba(30, 30, 40, 0.7);
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  animation: fadeIn 0.3s ease-in backwards;
  contain: layout style paint;
  content-visibility: auto;
}

.art-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border-color: rgba(167, 139, 250, 0.3);
  background: rgba(35, 35, 45, 0.8);
}

/* Family indicator - subtle colored border */
.art-card.has-family {
  border: 2px solid rgba(34, 211, 238, 0.5);
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.25);
}

.art-card.has-family:hover {
  border-color: rgba(34, 211, 238, 0.8);
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.4), 0 20px 25px -5px rgba(0, 0, 0, 0.2);
}

/* Image Wrapper */
.card-image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  min-height: 250px;
  overflow: hidden;
  background: #111;
  contain: layout;
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s ease;
}

.art-card:hover .card-image {
  transform: scale(1.08);
}

.card-image-placeholder {
  width: 100%;
  height: 100%;
  background: #1e1e24;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: #94a3b8;
}

.placeholder-icon { font-size: 24px; }
.placeholder-text { font-size: 13px; font-weight: 500; }

/* Overlays & Badges */
.card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  padding: 12px;
  background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 40%);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  pointer-events: none;
}

.top-badges {
  display: flex;
  gap: 6px;
}

.id-badge {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  color: #fff;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  font-family: monospace;
}

.rating-badge {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: white;
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.rating-explicit { background: rgba(220, 38, 38, 0.85); color: #fff; }
.rating-questionable { background: rgba(217, 119, 6, 0.85); color: #fff; }
.rating-safe { background: rgba(22, 163, 74, 0.85); color: #fff; }
.rating-general { background: rgba(37, 99, 235, 0.85); color: #fff; }

.status-indicators {
  display: flex;
  gap: 4px;
}

.status-badge {
  padding: 4px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 800;
  color: white;
  text-transform: uppercase;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  letter-spacing: 0.5px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.status-badge.pending { background: rgba(217, 119, 6, 0.9); color: #fff; }
.status-badge.deleted { background: rgba(220, 38, 38, 0.9); color: #fff; }
.status-badge.flagged { background: rgba(147, 51, 234, 0.9); color: #fff; }

/* Content Section */
.card-content {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Tech Specs Pills */
.tech-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.spec-pill {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08); /* added border */
  padding: 4px 8px;
  border-radius: 4px; /* Slightly squarer than round */
  font-size: 11px;
  color: #a1a1aa;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
}

.spec-pill:hover {
    background: rgba(255,255,255,0.1);
    color: #e4e4e7;
}

.spec-pill.format {
  font-weight: 700;
  letter-spacing: 0.5px;
}

.format-image { color: #60a5fa; border-color: rgba(96, 165, 250, 0.2); }
.format-video { color: #a78bfa; border-color: rgba(167, 139, 250, 0.2); }
.format-animated { color: #34d399; border-color: rgba(52, 211, 153, 0.2); }
.format-flash { color: #f59e0b; border-color: rgba(245, 158, 11, 0.2); }

/* Stats Row */
.stats-row {
  display: flex;
  justify-content: space-around; /* Distribute evenly */
  background: rgba(20, 20, 25, 0.3);
  padding: 8px;
  border-radius: 8px;
}

.stat {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
  color: #cbd5e1;
}

.stat.score-high { color: #4ade80; }
.stat.score-medium { color: #fbbf24; }
.stat.favs .stat-value { color: #f87171; }
.stat.comments .stat-value { color: #93c5fd; }

.stat-icon { opacity: 0.8; font-size: 14px; }

/* Divider */
.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  margin: 4px 0;
}

/* Footer Section */
.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #64748b;
}

.time-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 40px;
  gap: 20px;
  flex-wrap: wrap;
}

.nav-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.nav-btn:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.3);
  color: #a78bfa;
}

.nav-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 5px;
}

.num-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  transition: all 0.2s;
}

.num-btn.active {
  background: #a78bfa;
  color: white;
  font-weight: 700;
}

.num-btn:hover:not(.active):not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.results-meta {
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
  margin-top: 15px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

@media (max-width: 640px) {
  .nav-text {
    display: none;
  }
  .pagination-wrapper {
    gap: 10px;
    margin-top: 20px;
  }
  .page-numbers {
      gap: 2px;
  }
  .gallery-grid {
    gap: 10px;
  }
}

/* Rating Bar Transition */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.4s ease;
  max-height: 100px;
  opacity: 1;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow: hidden;
}
</style>
