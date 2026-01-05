<template>
  <article
    class="art-card"
    :class="{
      'has-family': post.parent_id || post.has_children,
      'loading': !isLoaded && !hasError,
      'masonry-optimized': masonry && isMobile
    }"
    @click="handleClick"
    @keydown.enter="handleClick"
    tabindex="0"
    role="button"
    :aria-label="`View post ${post.id} - ${post.tag_string_general}`"
  >
    <!-- Imagen con lazy loading inteligente -->
    <div class="card-image-wrapper" :class="{ 'masonry-mode': masonry }">
      <template v-if="isAnimatedVideo(post)">
        <SmartVideo
          :src="currentSrc"
          :poster="posterSrc"
          :alt="post.tag_string_general"
          className="card-image"
          @error="handleError"
          @loaded="handleLoad"
          :should-pause="pauseAnimations"
          :loading="priority ? 'eager' : 'lazy'"
          :aria-label="`Video: ${post.tag_string_general}`"
        />
      </template>
      
      <template v-else>
        <img
          :src="currentSrc"
          :alt="post.tag_string_general"
          :width="post.image_width"
          :height="post.image_height"
          class="card-image"
          :loading="priority ? 'eager' : 'lazy'"
          :decoding="priority ? 'auto' : 'async'"
          @error="handleError"
          @load="handleLoad"
        />
      </template>

      <!-- Error State -->
      <div v-if="hasError" class="image-error">
        <div class="error-icon">⚠️</div>
        <div class="error-text">Failed to load</div>
        <small>ID: {{ post.id }}</small>
      </div>

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
        <div class="stat" :class="getScoreClass(post.score || 0)" :title="`Score: ${post.score || 0}`">
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
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import SmartVideo from './SmartVideo.vue';

const props = defineProps({
  post: {
    type: Object,
    required: true
  },
  priority: {
    type: Boolean,
    default: false
  },
  pauseAnimations: {
    type: Boolean,
    default: false
  },
  masonry: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['click']);

const isMobile = ref(false);

onMounted(() => {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth <= 640;
    window.addEventListener('resize', () => {
      isMobile.value = window.innerWidth <= 640;
    });
  }
});

// State
const hasError = ref(false);
const isLoaded = ref(false);
const currentSrc = ref('');
const posterSrc = ref('');

// Helper methods (extracted from PostGallery)
const isAnimatedVideo = (post) => {
  return (
    ["webm", "mp4"].includes(post.file_ext) ||
    (post.file_ext === "zip" &&
      post.large_file_url &&
      post.large_file_url.endsWith(".webm"))
  );
};

const getInitialImageUrl = (post) => {
  if (isAnimatedVideo(post)) {
    return (
      post.large_file_url ||
      post.file_url ||
      post.sample_url ||
      post.preview_url ||
      ""
    );
  }
  if (post.file_ext === "gif") {
    if (props.pauseAnimations) {
        return post.preview_url || post.preview_file_url || ""; 
    }
    return post.file_url || post.sample_url || post.preview_url || "";
  }
  if (post.file_ext === "swf") {
    return post.preview_url || post.preview_file_url || "";
  }
  return (
    post.sample_url ||
    post.large_file_url ||
    post.file_url ||
    post.preview_url ||
    ""
  );
};

const getVideoPoster = (post) => {
  if (post.media_asset && post.media_asset.variants) {
    const variants = post.media_asset.variants;
    const bestVariant = variants.find(v => v.type === '720x720' && ['webp', 'jpg'].includes(v.file_ext)) ||
                        variants.find(v => v.type === '360x360' && ['webp', 'jpg'].includes(v.file_ext)) ||
                        variants.find(v => v.type === 'sample');
    
    if (bestVariant) return bestVariant.url;
  }
  return post.preview_file_url || post.preview_url || "";
};

// Initialize sources
watch(() => props.post, (newPost) => {
  currentSrc.value = getInitialImageUrl(newPost);
  posterSrc.value = getVideoPoster(newPost);
  hasError.value = false;
  isLoaded.value = false;
}, { immediate: true });

// React to pauseAnimations
watch(() => props.pauseAnimations, () => {
  if (props.post.file_ext === 'gif') {
    currentSrc.value = getInitialImageUrl(props.post);
  }
});

const handleError = () => {
  const fallbackSources = [
    props.post.sample_url,
    props.post.preview_file_url,
    props.post.preview_url
  ];

  // Try to find a new source that isn't the current one
  const nextSource = fallbackSources.find(src => 
    src && src !== currentSrc.value && !currentSrc.value.includes(src)
  );

  if (nextSource) {
    currentSrc.value = nextSource;
  } else {
    hasError.value = true;
  }
};

const handleLoad = () => {
  isLoaded.value = true;
};

const handleClick = () => {
  emit('click', props.post);
};

// Formatters
const getRatingText = (rating) => {
  const ratings = { e: "E", q: "Q", s: "S", g: "G" };
  return ratings[rating] || "?";
};

const getRatingClass = (rating) => {
  const ratingClasses = {
    e: "rating-explicit",
    q: "rating-questionable",
    s: "rating-safe",
    g: "rating-general",
  };
  return ratingClasses[rating] || "";
};

const getDimensions = (post) => {
  if (post.image_width && post.image_height) {
    return `${post.image_width}×${post.image_height}`;
  }
  return "N/A";
};

const formatFileSize = (bytes) => {
  if (!bytes) return "N/A";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
};

const getExtensionClass = (ext) => {
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
};

const getScoreClass = (score) => {
  if (score > 100) return "score-high";
  if (score > 10) return "score-medium";
  return "score-low";
};

const formatUploadDate = (createdAt) => {
  if (!createdAt) return "Desconocido";
  const date = new Date(createdAt);
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatTimeAgo = (createdAt) => {
  if (!createdAt) return 'Unknown';
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Simplificado para el ejemplo, pero mantener lógica completa si es necesario
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  
  if (diffSeconds < 60) return 'Just now';
  if (diffMinutes < 60) return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  if (diffDays < 7) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;
  
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
  
  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
};

const truncateSource = (source) => {
  if (!source) return "Sin source";
  if (source.startsWith("file://")) {
    const fileName = source.split("/").pop();
    return fileName.length > 15 ? fileName.substring(0, 15) + "..." : fileName;
  }
  try {
    const url = new URL(source);
    const hostname = url.hostname.replace("www.", "");
    return hostname.length > 20 ? hostname.substring(0, 20) + "..." : hostname;
  } catch {
    return source.length > 25 ? source.substring(0, 25) + "..." : source;
  }
};

const openSource = (source) => {
  if (!source || source.startsWith("file://")) return;
  try {
    new URL(source);
    window.open(source, "_blank");
  } catch {
    console.log("Source no es una URL válida:", source);
  }
};
</script>

<style scoped>
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

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.art-card:hover {
  transform: translateY(-6px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  border-color: rgba(167, 139, 250, 0.4);
  background: rgba(35, 35, 45, 0.9);
}

.art-card.has-family {
  border: 2px solid rgba(34, 211, 238, 0.5);
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.25);
}

.art-card.has-family:hover {
  border-color: rgba(34, 211, 238, 0.8);
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.4), 0 20px 25px -5px rgba(0, 0, 0, 0.2);
}

.card-image-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  min-height: 250px;
  overflow: hidden;
  background: #111;
  contain: layout;
}

.card-image-wrapper.masonry-mode {
  aspect-ratio: auto; /* Allow natural height */
  min-height: 100px;
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

.card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  padding: 16px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 40%, transparent 100%);
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  pointer-events: none;
  transition: opacity 0.3s ease;
}

.top-badges, .status-indicators {
  display: flex;
  gap: 6px;
}
.status-indicators { gap: 4px; }

.id-badge, .rating-badge, .status-badge {
  backdrop-filter: blur(4px);
  color: white;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  text-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

.id-badge {
  background: rgba(0, 0, 0, 0.6);
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  font-family: monospace;
}

.rating-badge {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}

.rating-explicit { background: rgba(220, 38, 38, 0.85); }
.rating-questionable { background: rgba(217, 119, 6, 0.85); }
.rating-safe { background: rgba(22, 163, 74, 0.85); }
.rating-general { background: rgba(37, 99, 235, 0.85); }

.status-badge {
  font-size: 9px;
  padding: 2px 6px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  background: rgba(0,0,0,0.6);
}

.status-badge.pending { background: rgba(217, 119, 6, 0.9); }
.status-badge.deleted { background: rgba(220, 38, 38, 0.9); }
.status-badge.flagged { background: rgba(147, 51, 234, 0.9); }

.card-content {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tech-specs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.spec-pill {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 4px 8px;
  border-radius: 4px;
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

.spec-pill.format { font-weight: 700; letter-spacing: 0.5px; }

.format-image { color: #60a5fa; border-color: rgba(96, 165, 250, 0.2); }
.format-video { color: #a78bfa; border-color: rgba(167, 139, 250, 0.2); }
.format-animated { color: #34d399; border-color: rgba(52, 211, 153, 0.2); }
.format-flash { color: #f59e0b; border-color: rgba(245, 158, 11, 0.2); }

.stats-row {
  display: flex;
  justify-content: space-around;
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

.divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  margin: 4px 0;
}

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

.source-link:focus-visible {
  outline: 2px solid #a78bfa;
  outline-offset: 2px;
}

.icon { font-size: 14px; opacity: 0.9; }
.icon-external { font-size: 10px; opacity: 0.7; }

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

.error-icon { font-size: 24px; opacity: 0.7; }
.error-text { font-size: 12px; font-weight: 500; }

/* Mobile Masonry Optimization */
.masonry-optimized .card-content {
  display: none !important;
}

.masonry-optimized .card-overlay {
  display: none !important;
}

.masonry-optimized.art-card {
  border-radius: 8px; /* Slightly smaller radius for tighter fit */
  background: transparent;
  border: none;
  box-shadow: none;
}

/* Ensure images touch or have minimal gap */
.masonry-optimized .card-image-wrapper {
  min-height: 50px;
}

@media (max-width: 640px) {
  .art-card {
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }
}

@media (max-width: 480px) {
  .art-card {
    border-radius: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .art-card, .card-image {
    animation-duration: 0.001s !important;
    transition-duration: 0.001s !important;
  }
  .art-card:hover { transform: none; }
}

@media (hover: none) and (pointer: coarse) {
  .art-card:hover { transform: none; }
  .art-card:active { transform: scale(0.98); }
}

.card-footer, .tech-specs, .stats-row {
  font-size: clamp(11px, 1.5vw, 13px);
}
</style>
