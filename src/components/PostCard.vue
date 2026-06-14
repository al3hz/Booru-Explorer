<template>
  <article
    class="art-card"
    :class="{
      'has-family': post.parent_id || post.has_children,
      loading: !isLoaded && !hasError,
      'masonry-optimized': masonry,
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
        <SmartImage
          :src="currentSrc"
          :alt="post.tag_string_general"
          :aspect-ratio="post.image_width / post.image_height"
          class="card-image"
          :priority="priority"
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
          <span v-if="post.is_pending" class="status-badge pending"
            >PENDING</span
          >
          <span v-if="post.is_deleted" class="status-badge deleted"
            >DELETED</span
          >
          <span v-if="post.is_flagged" class="status-badge flagged"
            >FLAGGED</span
          >
          <span v-if="post.is_banned" class="status-badge banned"
            >BANNED</span
          >
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
        <div class="spec-pill format" :class="getExtensionClass(post.file_ext)">
          {{ (post.file_ext || "").toUpperCase() }}
        </div>
      </div>

      <div class="stats-row">
        <div
          class="stat"
          :class="getScoreClass(post.score || 0)"
          :title="`Score: ${post.score || 0}`"
        >
          <i class="lni lni-heart stat-icon"></i>
          <span class="stat-value">{{ post.score || 0 }}</span>
        </div>
        <div class="stat favs" :title="`Favorites: ${post.fav_count || 0}`">
          <i class="lni lni-star-fill stat-icon"></i>
          <span class="stat-value">{{ post.fav_count || 0 }}</span>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup>
import { ref, watch } from "vue";
import SmartVideo from "./SmartVideo.vue";
import SmartImage from "./SmartImage.vue";
import DanbooruService from "@/services/danbooru";

const props = defineProps({
  post: {
    type: Object,
    required: true,
  },
  priority: {
    type: Boolean,
    default: false,
  },
  pauseAnimations: {
    type: Boolean,
    default: false,
  },
  masonry: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["click"]);

// State
const hasError = ref(false);
const isLoaded = ref(false);
const currentSrc = ref("");
const posterSrc = ref("");

// Helper methods (extracted from PostGallery)
const isAnimatedVideo = (post) => {
  return (
    ["webm", "mp4"].includes(post.file_ext) ||
    (post.file_ext === "zip" &&
      post.large_file_url &&
      post.large_file_url.endsWith(".webm"))
  );
};

const BAN_IMAGE = "/ban.png";

const getImageUrl = (post) => {
  if (post.media_asset?.variants?.length) {
    const v = post.media_asset.variants;
    const sample = v.find((x) => x.type === "sample");
    const original = v.find((x) => x.type === "original");
    const preview = v.find((x) => x.type === "preview");
    return sample?.url || original?.url || preview?.url || "";
  }
  return (
    post.sample_url ||
    post.large_file_url ||
    post.file_url ||
    post.preview_url ||
    post.preview_file_url ||
    ""
  );
};

const getThumbnailUrl = (post) => {
  if (post.media_asset?.variants?.length) {
    const v = post.media_asset.variants;
    const preview = v.find((x) => x.type === "preview");
    const sample = v.find((x) => x.type === "sample");
    const original = v.find((x) => x.type === "original");
    return preview?.url || sample?.url || original?.url || "";
  }
  return (
    post.preview_file_url ||
    post.preview_url ||
    post.sample_url ||
    ""
  );
};

const getInitialImageUrl = (post) => {
  if (post.is_banned) return BAN_IMAGE;
  if (isAnimatedVideo(post)) {
    return getImageUrl(post);
  }
  if (post.file_ext === "gif") {
    if (props.pauseAnimations) {
      return getThumbnailUrl(post);
    }
    return getImageUrl(post);
  }
  if (post.file_ext === "swf") {
    return getThumbnailUrl(post);
  }
  return getImageUrl(post);
};

const getVideoPoster = (post) => {
  if (post.media_asset?.variants?.length) {
    const v = post.media_asset.variants;
    const bestVariant =
      v.find((x) => x.type === "720x720" && ["webp", "jpg"].includes(x.file_ext)) ||
      v.find((x) => x.type === "360x360" && ["webp", "jpg"].includes(x.file_ext)) ||
      v.find((x) => x.type === "sample");
    if (bestVariant) return bestVariant.url;
  }
  return getThumbnailUrl(post);
};

let fetchId = 0;

const resolvePost = async (post) => {
  const url = getInitialImageUrl(post);
  if (url) {
    currentSrc.value = url;
    posterSrc.value = getVideoPoster(post);
    hasError.value = false;
    isLoaded.value = false;
    return;
  }
  if (isAnimatedVideo(post)) {
    hasError.value = true;
    return;
  }
  const thisFetch = ++fetchId;
  try {
    const full = await DanbooruService.getPost(post.id);
    if (thisFetch !== fetchId) return;
    const url2 = getInitialImageUrl(full);
    if (url2) {
      currentSrc.value = url2;
      posterSrc.value = getVideoPoster(full);
      hasError.value = false;
    } else {
      hasError.value = true;
    }
  } catch {
    if (thisFetch === fetchId) hasError.value = true;
  }
  isLoaded.value = false;
};

watch(() => props.post, resolvePost, { immediate: true });

// React to pauseAnimations
watch(
  () => props.pauseAnimations,
  () => {
    if (props.post.file_ext === "gif") {
      currentSrc.value = getInitialImageUrl(props.post);
    }
  },
);

const handleError = () => {
  const fallback = getThumbnailUrl(props.post);
  if (fallback && fallback !== currentSrc.value) {
    currentSrc.value = fallback;
  } else {
    hasError.value = true;
  }
};

const handleLoad = () => {
  isLoaded.value = true;
};

const handleClick = () => {
  emit("click", props.post);
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
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
  animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  contain: layout style paint;
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
  transform: translateZ(0);
  backface-visibility: hidden;
}

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
  box-shadow:
    0 0 0 1px rgba(34, 211, 238, 0.4),
    0 20px 25px -5px rgba(0, 0, 0, 0.2);
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

.top-badges,
.status-indicators {
  display: flex;
  gap: 6px;
}
.status-indicators {
  gap: 4px;
}

.id-badge,
.rating-badge,
.status-badge {
  backdrop-filter: blur(4px);
  color: white;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
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

.rating-explicit {
  background: rgba(220, 38, 38, 0.85);
}
.rating-questionable {
  background: rgba(217, 119, 6, 0.85);
}
.rating-safe {
  background: rgba(22, 163, 74, 0.85);
}
.rating-general {
  background: rgba(37, 99, 235, 0.85);
}

.status-badge {
  font-size: 9px;
  padding: 2px 6px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  background: rgba(0, 0, 0, 0.6);
}

.status-badge.pending {
  background: rgba(217, 119, 6, 0.9);
}
.status-badge.deleted {
  background: rgba(220, 38, 38, 0.9);
}
.status-badge.flagged {
  background: rgba(147, 51, 234, 0.9);
}
.status-badge.banned {
  background: rgba(127, 29, 29, 0.95);
}

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
  justify-content: center;
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
  background: rgba(255, 255, 255, 0.1);
  color: #e4e4e7;
}

.spec-pill.format {
  font-weight: 700;
  letter-spacing: 0.5px;
}

.format-image {
  color: #60a5fa;
  border-color: rgba(96, 165, 250, 0.2);
}
.format-video {
  color: #a78bfa;
  border-color: rgba(167, 139, 250, 0.2);
}
.format-animated {
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.2);
}
.format-flash {
  color: #f59e0b;
  border-color: rgba(245, 158, 11, 0.2);
}

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

.stat.score-high {
  color: #4ade80;
}
.stat.score-medium {
  color: #fbbf24;
}
.stat.favs .stat-value {
  color: #f87171;
}
.stat-icon {
  opacity: 0.8;
  font-size: 14px;
}

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
  .art-card,
  .card-image {
    animation-duration: 0.001s !important;
    transition-duration: 0.001s !important;
  }
  .art-card:hover {
    transform: none;
  }
}

@media (hover: none) and (pointer: coarse) {
  .art-card:hover {
    transform: none;
  }
  .art-card:active {
    transform: scale(0.98);
  }
}

.tech-specs,
.stats-row {
  font-size: clamp(11px, 1.5vw, 13px);
}
</style>
