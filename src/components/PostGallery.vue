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
      <div v-if="loading" class="grid-loading-overlay">
        <div class="loader-ring small"></div>
      </div>
      <div class="gallery-grid" :class="{ 'is-dimmed': loading }">
        <div
          v-for="post in posts"
          :key="post.id"
          class="art-card"
          @click="openPost(post)"
        >
          <!-- Image Section -->
          <div class="card-image-wrapper">
            <video
              v-if="isAnimatedVideo(post)"
              :src="getImageUrl(post)"
              :alt="post.tag_string_general"
              class="card-image"
              muted
              loop
              autoplay
              playsinline
              @error="handleImageError($event, post)"
            ></video>
            <img
              v-else
              :src="getImageUrl(post)"
              :alt="post.tag_string_general"
              class="card-image"
              loading="lazy"
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

              <!-- Status Icons -->
              <div class="status-indicators">
                <span
                  v-if="post.is_pending"
                  class="status-dot pending"
                  title="Pending"
                ></span>
                <span
                  v-if="post.is_deleted"
                  class="status-dot deleted"
                  title="Deleted"
                ></span>
                <span
                  v-if="post.is_flagged"
                  class="status-dot flagged"
                  title="Flagged"
                ></span>
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
      <div v-if="hasNextPage && !infiniteScroll" class="pagination-wrapper">
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

export default {
  name: "PostGallery",
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
      const maxPages = 5;
      const start = Math.max(1, props.currentPage - Math.floor(maxPages / 2));
      const end = start + maxPages - 1;
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      return pages;
    };

    return {
      infiniteScrollTrigger,
      getPageNumbers
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
            <div class="error-text">Error al cargar video</div>
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
            <div class="error-text">Error al cargar imagen</div>
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

      if (imageExts.includes(ext.toLowerCase())) return "format-image";
      if (videoExts.includes(ext.toLowerCase())) return "format-video";
      if (animatedExts.includes(ext.toLowerCase())) return "format-animated";
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
    grid-template-columns: 1fr; /* Force 1 column on mobile */
    gap: 16px; /* Increase gap slightly for single column */
  }
}

/* Art Card Component */
@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.art-card {
  background: rgba(30, 30, 40, 0.7);
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  animation: fadeSlideUp 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
}

.art-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border-color: rgba(167, 139, 250, 0.3);
  background: rgba(35, 35, 45, 0.8);
}

/* Image Wrapper */
.card-image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1; /* Square by default, works well for mixed content */
  overflow: hidden;
  background: #111;
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
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.rating-explicit { background: linear-gradient(135deg, #ef4444, #b91c1c); }
.rating-questionable { background: linear-gradient(135deg, #f59e0b, #d97706); }
.rating-safe { background: linear-gradient(135deg, #22c55e, #15803d); }
.rating-general { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }

.status-indicators {
  display: flex;
  gap: 4px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0,0,0,0.3);
}

.status-dot.pending { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; }
.status-dot.deleted { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
.status-dot.flagged { background: #a855f7; box-shadow: 0 0 8px #a855f7; }

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
</style>
