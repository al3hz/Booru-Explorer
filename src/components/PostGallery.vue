<template>
  <div class="post-gallery" :class="{ 'is-sidebar-collapsed': !isSidebarVisible }">
    <!-- Estados de carga mejorados -->
    <div v-if="loading && posts.length === 0" class="state-container loading" role="status">
      <div class="loader-ring"></div>
      <p>Loading content...</p>
    </div>

    <div
      v-else-if="posts.length === 0 && !loading"
      class="state-container no-posts"
      role="status"
    >
      <i class="lni lni-search-alt icon-large"></i>
      <h3>No results found</h3>
      <p>Try adjusting your search filters.</p>
    </div>

    <!-- Gallery Grid with Overlay -->
    <div v-else class="gallery-wrapper">
      
      <!-- Rating Distribution Container (prevents layout shift) -->
      <div class="rating-container">
        <!-- Rating Distribution Loading State -->
        <Transition name="fade-slide" mode="out-in">
          <div v-if="loadingCounts" key="loading" class="rating-bar loading">
             <div class="loader-dots">
                <span></span><span></span><span></span>
             </div>
             <span class="loading-text">Calculating rating distribution...</span>
          </div>

          <!-- Rating Distribution Bar -->
          <div v-else-if="!loading && isLimited" key="limited" class="rating-limit-info">
            <span class="icon">⚠️</span>
            <span>Counts by rating are unavailable for this tag due to API complexity limits.</span>
          </div>
          <div v-else-if="!loading && (tagCount || ratingCounts.g?.count !== null || ratingCounts.s?.count !== null || ratingCounts.q?.count !== null || ratingCounts.e?.count !== null)" key="ratings" class="rating-bar-container">
           <div class="rating-bar">
              <!-- Left: Total Count -->
              <div class="rating-bar-left">
                <span v-if="tagCount" class="total-badge">Total Tag Count: {{ formatCount(tagCount) }}</span>
              </div>
              
              <!-- Center: Rating Stats -->
              <div class="rating-bar-center">
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

              <!-- Right: Legend -->
              <div class="rating-bar-right">
                <div class="rating-legend">
                  <span title="Exact count">Exact</span>
                  <span title="Includes deleted posts">~ Approx</span>
                </div>
              </div>
            </div>
         </div>
        </Transition>
      </div>

      <!-- Overlay de carga para grid existente -->
      <div v-if="loading && posts.length > 0" class="grid-loading-overlay">
        <div class="loader-ring small"></div>
        <span>Loading more...</span>
      </div>
      <!-- Grid optimizado -->
      <div class="gallery-grid" :class="{ 'is-dimmed': loading }">
        <article
          v-for="(post, index) in posts"
          :key="`post-${post.id}-${index}`"
          class="art-card"
          :class="{
            'has-family': post.parent_id || post.has_children,
            'priority-loading': index < 8
          }"
          @click="openPost(post)"
          @keydown.enter="openPost(post)"
          tabindex="0"
          role="button"
          :aria-label="`View post ${post.id} - ${post.tag_string_general}`"
        >
          <!-- Imagen con lazy loading inteligente -->
          <div class="card-image-wrapper">
            <template v-if="isAnimatedVideo(post)">
              <SmartVideo
                :src="getImageUrl(post)"
                :poster="getVideoPoster(post)"
                :alt="post.tag_string_general"
                className="card-image"
                @error="handleImageError($event, post)"
                :should-pause="pauseAnimations"
                loading="lazy"
                :aria-label="`Video: ${post.tag_string_general}`"
              />
            </template>
            
            <template v-else>
              <img
                :src="getImageUrl(post)"
                :alt="post.tag_string_general"
                :width="post.image_width"
                :height="post.image_height"
                class="card-image"
                :loading="index < 4 ? 'eager' : 'lazy'"
                :decoding="index < 4 ? 'auto' : 'async'"
                @error="handleImageError($event, post)"
                :data-index="index"
              />
            </template>

            <!-- Overlays -->
            <div class="card-overlay">
              <div class="top-badges">
                <span class="id-badge">#{{ post.id }}</span>
                <span 
                  class="rating-badge" 
                  :class="getRatingClass(post.rating)"
                  :title="`Rating: ${getRatingText(post.rating)}`"
                >
                  {{ getRatingText(post.rating) }}
                </span>
              </div>

              <div class="status-indicators">
                <span v-if="post.is_pending" class="status-badge pending">PENDING</span>
                <span v-if="post.is_deleted" class="status-badge deleted">DELETED</span>
                <span v-if="post.is_flagged" class="status-badge flagged">FLAGGED</span>
              </div>
            </div>
          </div>

          <!-- Content Section -->
          <div class="card-content">
            <div class="tech-specs">
              <div class="spec-pill" :title="`Resolution: ${getDimensions(post)}`">
                <i class="lni lni-frame-expand spec-icon"></i>
                {{ getDimensions(post) }}
              </div>
              <div class="spec-pill" :title="`File size: ${formatFileSize(post.file_size)}`">
                <i class="lni lni-files spec-icon"></i>
                {{ formatFileSize(post.file_size) }}
              </div>
              <div class="spec-pill format" :class="getExtensionClass(post.file_ext)">
                {{ (post.file_ext || '').toUpperCase() }}
              </div>
            </div>

            <div class="stats-row">
              <div class="stat" :class="getScoreClass(post.score)" :title="`Score: ${post.score || 0}`">
                <i class="lni lni-heart stat-icon"></i>
                <span class="stat-value">{{ post.score || 0 }}</span>
              </div>
              <div class="stat favs" :title="`Favorites: ${post.fav_count || 0}`">
                <i class="lni lni-star-fill stat-icon"></i>
                <span class="stat-value">{{ post.fav_count || 0 }}</span>
              </div>
              <div v-if="post.comment_count" class="stat comments" :title="`Comments: ${post.comment_count}`">
                <i class="lni lni-comments stat-icon"></i>
                <span class="stat-value">{{ post.comment_count }}</span>
              </div>
            </div>

            <div class="divider"></div>

            <div class="card-footer">
              <div class="time-info" :title="formatUploadDate(post.created_at)">
                <i class="lni lni-timer icon"></i>
                {{ formatTimeAgo(post.created_at) }}
              </div>
              
              <div 
                v-if="post.source"
                class="source-link"
                @click.stop="openSource(post.source)"
                @keydown.enter.stop="openSource(post.source)"
                :title="`Source: ${post.source}`"
                tabindex="0"
                role="link"
              >
                <span class="trunc-source">{{ truncateSource(post.source) }}</span>
                <i class="lni lni-link icon-external"></i>
              </div>
            </div>
          </div>
        </article>
      </div>

      <!-- Paginación accesible -->
      <nav v-if="!infiniteScroll && (currentPage > 1 || hasNextPage)" 
           class="pagination-wrapper" 
           aria-label="Pagination">
        <button
          @click="goToPage(currentPage - 1)"
          :disabled="currentPage === 1 || loading"
          class="nav-btn"
          :aria-label="`Go to previous page ${currentPage - 1}`"
        >
          <i class="lni lni-chevron-left arrow"></i>
          <span class="nav-text">Previous</span>
        </button>
        
        <div class="page-numbers">
          <button
            v-for="page in getPageNumbers()"
            :key="page"
            @click="goToPage(page)"
            :disabled="loading"
            :class="['num-btn', { active: page === currentPage }]"
            :aria-label="`Go to page ${page}`"
            :aria-current="page === currentPage ? 'page' : null"
          >
            {{ page }}
          </button>
        </div>

        <button
          @click="goToPage(currentPage + 1)"
          :disabled="!hasNextPage || loading"
          class="nav-btn"
          :aria-label="`Go to next page ${currentPage + 1}`"
        >
          <span class="nav-text">Next</span>
          <i class="lni lni-chevron-right arrow"></i>
        </button>
      </nav>

      <!-- Infinite scroll optimizado -->
      <div
        v-if="infiniteScroll && hasNextPage"
        ref="infiniteScrollTrigger"
        class="infinite-loader"
        :aria-busy="loading"
      >
        <div v-if="loading" class="spinner-dots">
          <span></span><span></span><span></span>
        </div>
      </div>

      <div class="results-meta" role="status">
        <span v-if="!infiniteScroll">Page {{ currentPage }} • </span>
        {{ posts.length }} results shown
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRatingCounts } from "../composables/useRatingCounts";
import { useLayout } from '../composables/useLayout';

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
    pauseAnimations: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["load-more", "change-page", "post-clicked"],
  setup(props, { emit }) {
    const { isLimited, loadingCounts, tagCount } = useRatingCounts();
    const { isSidebarVisible } = useLayout();
    const infiniteScrollTrigger = ref(null);
    let observer = null;

    const setupIntersectionObserver = () => {
      if (!props.infiniteScroll || !props.hasNextPage || props.loading) return;

      // Limpiar observer existente
      if (observer) observer.disconnect();

      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && props.hasNextPage && !props.loading) {
            emit("load-more");
          }
        },
        {
          rootMargin: "300px", // Carga más temprano
          threshold: 0.1
        }
      );

      if (infiniteScrollTrigger.value) {
        observer.observe(infiniteScrollTrigger.value);
      }
    };

    onMounted(() => {
      if (props.infiniteScroll) {
        nextTick(setupIntersectionObserver);
      }
    });

    onUnmounted(() => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    });

    watch(
      [
        () => props.infiniteScroll,
        () => props.hasNextPage,
        () => props.loading,
      ],
      setupIntersectionObserver
    );

    watch(
      () => props.posts.length,
      () => {
        if (props.infiniteScroll) {
          nextTick(setupIntersectionObserver);
        }
      }
    );

    const getPageNumbers = () => {
      const pages = [];
      const maxVisible = 5;
      
      if (props.currentPage <= maxVisible) {
        // Mostrar primeras páginas
        for (let i = 1; i <= Math.min(maxVisible, props.currentPage + 2); i++) {
          pages.push(i);
        }
      } else {
        // Mostrar páginas alrededor de la actual
        pages.push(1, '...');
        for (let i = props.currentPage - 2; i <= props.currentPage + 2; i++) {
          if (i > 1 && i <= props.currentPage + 2) {
            pages.push(i);
          }
        }
      }
      
      if (props.hasNextPage && !pages.includes(props.currentPage + 1)) {
        pages.push(props.currentPage + 1);
      }
      
      return pages;
    };

    const goToPage = (page) => {
      if (page !== '...') {
        emit("change-page", page);
      }
    };

    const formatCount = (countData) => {
      if (countData === null || countData === undefined) return '0';
      
      // Handle legacy number case
      if (typeof countData === 'number') {
        const val = countData;
        if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
        if (val >= 1000) return (val / 1000).toFixed(1) + 'k';
        return val.toString();
      }

      // Handle object case
      const val = countData.count;
      const approx = countData.isApproximate ? '~' : '';
      
      if (val === null || val === undefined) return '?';
      if (val === 0) return '0';
      
      let formatted = val.toString();
      if (val >= 1000000) {
        formatted = (val / 1000000).toFixed(1) + 'M';
      } else if (val >= 1000) {
        formatted = (val / 1000).toFixed(1) + 'k';
      } else {
        formatted = val.toString();
      }
      
      return `${approx}${formatted}`;
    };

    return {
      infiniteScrollTrigger,
      getPageNumbers,
      goToPage,
      formatCount,
      isLimited,
      loadingCounts,
      tagCount,
      isSidebarVisible
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
        if (this.pauseAnimations) {
            // Return static preview if paused
            return post.preview_url || post.preview_file_url || ""; 
        }
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

    getVideoPoster(post) {
      // Try to get high quality thumbnail from variants
      if (post.media_asset && post.media_asset.variants) {
        // Look for 720x720 or 360x360 webp/jpg
        const variants = post.media_asset.variants;
        const bestVariant = variants.find(v => v.type === '720x720' && ['webp', 'jpg'].includes(v.file_ext)) ||
                            variants.find(v => v.type === '360x360' && ['webp', 'jpg'].includes(v.file_ext)) ||
                            variants.find(v => v.type === 'sample');
        
        if (bestVariant) return bestVariant.url;
      }
      
      // Fallback
      return post.preview_file_url || post.preview_url || "";
    },

    handleImageError(event, post) {
      const target = event.target;
      const container = target.closest('.card-image-wrapper');
      
      // Intentar diferentes calidades en orden
      const fallbackSources = [
        post.sample_url,
        post.preview_file_url,
        post.preview_url,
        "/placeholder-image.png" // Fallback local
      ];

      const currentSrc = target.src;
      const nextSource = fallbackSources.find(src => 
        src && src !== currentSrc && !currentSrc.includes(src)
      );

      if (nextSource && target.tagName === "IMG") {
        target.src = nextSource;
        return;
      }

      // Mostrar placeholder de error
      target.style.opacity = "0";
      setTimeout(() => {
        container.innerHTML = `
          <div class="image-error">
            <div class="error-icon">⚠️</div>
            <div class="error-text">Failed to load</div>
            <small>ID: ${post.id}</small>
          </div>
        `;
      }, 300);
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
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
  background: rgba(20, 20, 25, 0.4);
  padding: 12px 24px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.rating-bar-left {
  justify-self: start;
}

.rating-bar-center {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap; /* Fix overflow */
}

.rating-bar-right {
  justify-self: end;
}

.rating-limit-info {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  background: rgba(234, 179, 8, 0.05);
  padding: 12px 24px;
  border-radius: 16px;
  border: 1px solid rgba(234, 179, 8, 0.1);
  color: #94a3b8;
  font-size: 13px;
}

.rating-limit-info .icon {
  color: #eab308;
}

@media (max-width: 1024px) {
  .rating-bar {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 12px 16px; /* Reduced padding */
    text-align: center;
  }
  
  .rating-bar-left, .rating-bar-center, .rating-bar-right {
    justify-self: center;
    width: 100%;
  }

  .rating-bar-center {
    gap: 12px; /* Smaller gaps for small screens */
  }
}

@media (max-width: 480px) {
  .rating-bar {
    padding: 10px 8px; /* Extra compact for very small phones */
  }
  
  .rating-bar-center {
    gap: 8px;
  }
}

/* Rating Bar Container */
.rating-bar-container {
  margin-bottom: 24px;
}

.total-badge {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
  background: rgba(139, 92, 246, 0.2);
  padding: 4px 10px;
  border-radius: 20px;
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.rating-legend {
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: #94a3b8;
  flex-wrap: wrap; /* Fix overflow */
  justify-content: center;
}

.rating-legend span {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: help;
}

.rating-legend span::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* Loading State in Rating Bar */
/* Loading State in Rating Bar */
.rating-bar.loading {
  display: flex !important; /* Override grid */
  justify-content: center;
  align-items: center;
  flex-direction: row;
  min-height: 50px;
  gap: 12px;
  background: rgba(139, 92, 246, 0.05);
  border-color: rgba(139, 92, 246, 0.1);
}

.loading-text {
  font-size: 13px;
  color: #a78bfa;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.loader-dots {
  display: flex;
  gap: 4px;
}

.loader-dots span {
  width: 6px;
  height: 6px;
  background: #a78bfa;
  border-radius: 50%;
  animation: pulse 1.4s infinite ease-in-out both;
}

.loader-dots span:nth-child(1) { animation-delay: -0.32s; }
.loader-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes pulse {
  0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
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
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: rgba(15, 23, 42, 0.9);
  padding: 24px;
  border-radius: 16px;
  backdrop-filter: blur(10px);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translate(-50%, -40%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
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
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: clamp(12px, 2vw, 24px);
  padding-bottom: 40px;
  
  /* Optimizaciones de rendimiento */
  will-change: transform;
  contain: layout style paint;
  content-visibility: auto;
}

/* Tablets medianas - 3 columnas */
@media (max-width: 1024px) {
  .gallery-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}

/* Tablets pequeñas - 2 columnas */
@media (max-width: 768px) {
  .gallery-grid {
    grid-template-columns: repeat(2, 1fr); /* 2 columnas fijas */
    gap: 16px;
  }
}

/* MÓVILES - 1 SOLA COLUMNA */
@media (max-width: 640px) {
  .gallery-grid {
    grid-template-columns: 1fr !important; /* Fuerza una columna */
    gap: 20px; /* Más espacio entre tarjetas */
  }
  
  /* Asegura que cada tarjeta ocupe todo el ancho */
  .art-card {
    width: 100%;
    max-width: 100%;
    min-width: 0; /* Evita desbordamientos */
  }
}

/* Móviles muy pequeños - ajustes finos */
@media (max-width: 480px) {
  .gallery-grid {
    gap: 16px;
  }
  
  .art-card {
    border-radius: 12px; /* Bordes ligeramente más pequeños */
  }
}

/* Art Card Component */
@keyframes fadeInUp {
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
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  contain: layout style paint;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.art-card:hover {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border-color: rgba(167, 139, 250, 0.4);
  background: rgba(35, 35, 45, 0.9);
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
  padding: 16px;
  background: linear-gradient(
    180deg, 
    rgba(0, 0, 0, 0.8) 0%, 
    rgba(0, 0, 0, 0.4) 40%, 
    transparent 100%
  );
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  pointer-events: none;
  transition: opacity 0.3s ease;
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
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  backdrop-filter: blur(4px);
  color: white;
  background: rgba(0,0,0,0.6);
  border: 1px solid rgba(255, 255, 255, 0.2);
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

/* Rating Container - prevents layout shift */
.rating-container {
  position: relative;
  min-height: 60px;
  margin-bottom: 20px;
}

/* Rating Bar Transition */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

/* Placeholder y error states mejorados */
.image-error {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(30, 30, 40, 0.9);
  color: #94a3b8;
  gap: 8px;
}

.error-icon {
  font-size: 24px;
  opacity: 0.7;
}

.error-text {
  font-size: 12px;
  font-weight: 500;
}

/* Mejoras en el grid loading overlay */
.grid-loading-overlay {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: rgba(15, 23, 42, 0.9);
  padding: 24px;
  border-radius: 16px;
  backdrop-filter: blur(10px);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translate(-50%, -40%);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%);
  }
}

/* Accesibilidad: focus states */
.art-card:focus-visible {
  outline: 2px solid #a78bfa;
  outline-offset: 2px;
}

.nav-btn:focus-visible,
.num-btn:focus-visible,
.source-link:focus-visible {
  outline: 2px solid #a78bfa;
  outline-offset: 2px;
}

/* Mejoras en la paginación */
.page-numbers {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.num-btn {
  min-width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.num-btn.active {
  background: linear-gradient(135deg, #a78bfa, #8b5cf6);
  color: white;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

/* Performance: reduce motion */
@media (prefers-reduced-motion: reduce) {
  .art-card,
  .card-image,
  .loader-ring {
    animation-duration: 0.001s !important;
    transition-duration: 0.001s !important;
  }
  
  .art-card:hover {
    transform: none;
  }
}

/* Mejoras en el rating bar para móviles */
@media (max-width: 640px) {
  .rating-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .rating-bar-center {
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .rating-stat {
    flex: 1;
    min-width: 120px;
    justify-content: center;
  }

  .state-container {
    padding: 40px 16px;
    border-radius: 12px;
    min-height: 200px;
  }

  .gallery-grid {
    gap: 10px;
  }
}

/* Responsive mejorado */
@media (hover: none) and (pointer: coarse) {
  .art-card:hover {
    transform: none;
  }
  
  .art-card:active {
    transform: scale(0.98);
  }
}

/* Optimización de fuentes y texto */
.card-footer,
.tech-specs,
.stats-row {
  font-size: clamp(11px, 1.5vw, 13px);
}

/* LineIcons styling */
.spec-icon,
.stat-icon,
.icon {
  font-size: 14px;
  opacity: 0.9;
}

.icon-large {
  font-size: 48px;
  opacity: 0.8;
}

.icon-external {
  font-size: 10px;
  opacity: 0.7;
}

/* Arrow icons */
.arrow {
  font-size: 14px;
}
</style>
