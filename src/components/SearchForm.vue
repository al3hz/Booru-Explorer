<template>
  <div class="sidebar-container" :class="{ 'is-collapsed': !isSidebarVisible }">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2 class="title">Filters</h2>
        <button
          class="mobile-close-btn"
          @click="toggleSidebar"
          v-if="isSidebarVisible"
        >
          <i class="lni lni-close"></i>
        </button>
      </div>

      <div class="sidebar-content" :class="{ faded: !isSidebarVisible }">
        <div class="search-section">
          <div class="section-label-wrapper">
            <label class="section-label" for="search-input">Search</label>
            <button
              class="info-icon-btn-search"
              @click.stop="showSearchTooltip = !showSearchTooltip"
              title="Search info"
            >
              <i class="lni lni-information"></i>
            </button>
            <transition name="tooltip-fade">
              <div v-if="showSearchTooltip" class="search-tooltip">
                Use smart search to find what you need
              </div>
            </transition>
          </div>
          <div class="input-wrapper search-wrapper">
            <input
              id="search-input"
              name="search"
              type="text"
              :value="searchQuery"
              @input="handleInput"
              @keydown.down.prevent="navigateSuggestions(1)"
              @keydown.up.prevent="navigateSuggestions(-1)"
              @keydown.enter.prevent="handleEnter"
              @keydown.esc="clearSuggestions"
              @blur="handleBlur"
              placeholder="Search tags..."
              class="search-input"
              ref="searchInputRef"
            />
            <button
              class="search-btn-icon"
              @click="handleSearch"
              :disabled="loading"
              title="Search"
            >
              <span
                v-if="loading || loadingSuggestions"
                class="input-loader"
              ></span>
              <span v-else>🔍</span>
            </button>

            <!-- Autocomplete Dropdown -->
            <ul class="suggestions-list" v-if="suggestions.length > 0">
              <li
                v-for="(tag, index) in suggestions"
                :key="tag.name"
                class="suggestion-item"
                :class="{ active: index === activeSuggestionIndex }"
                @mousedown.prevent="selectSuggestion(tag)"
              >
                <span
                  class="suggestion-name"
                  :class="tag.class"
                  v-html="tag.highlight"
                ></span>
                <span class="suggestion-count">{{ tag.formatted_count }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="divider"></div>

        <div class="options-section">
          <h3 class="section-label">Filters</h3>

          <div class="option-row" v-if="!masonryMode">
            <label class="opt-text" for="limit-input">Results per page</label>
            <div class="limit-input-wrapper">
              <input
                id="limit-input"
                name="limit"
                type="number"
                :value="limit"
                @input="handleLimitUpdate"
                min="10"
                max="200"
                class="limit-input"
                title="Number of posts to show per page"
              />
              <button
                class="info-icon-btn-limit"
                @click.stop="showLimitTooltip = !showLimitTooltip"
                title="Show limits"
              >
                <i class="lni lni-information"></i>
              </button>
              <transition name="limit-tooltip-fade">
                <div v-if="showLimitTooltip" class="limit-tooltip">
                  Min: 10, Max: 200 posts
                </div>
              </transition>
            </div>
          </div>

          <div class="option-row">
            <span class="opt-text">Masonry Mode</span>
            <label
              class="switch"
              title="Variable height layout with infinite scroll"
            >
              <input
                id="masonry-input"
                name="masonry"
                type="checkbox"
                :checked="masonryMode"
                @change="$emit('update:masonry-mode', $event.target.checked)"
              />
              <span class="slider round"></span>
            </label>
          </div>

          <div class="option-row">
            <span class="opt-text">Rating</span>
            <div
              class="custom-select"
              :class="{ 'is-open': ratingDropdownOpen }"
            >
              <button class="select-trigger" @click.stop="toggleRatingDropdown">
                <span class="selected-value">{{
                  getRatingLabel(ratingFilter)
                }}</span>
                <span class="chevron">▼</span>
              </button>

              <transition name="dropdown-fade">
                <ul v-if="ratingDropdownOpen" class="custom-options">
                  <li
                    v-for="opt in ratingOptions"
                    :key="opt.value"
                    class="custom-option"
                    :class="{ selected: isSelected(opt.value) }"
                    @click="selectRating(opt.value)"
                  >
                    <span class="option-label">{{ opt.label }}</span>
                    <span v-if="isSelected(opt.value)" class="check">✓</span>
                  </li>
                </ul>
              </transition>
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="popular-section">
          <h3 class="section-label">Trending (Top 15)</h3>
          <div class="tags-cloud">
              <div v-if="loadingTrending" class="loading-tags">
                <span class="tag-skeleton" v-for="i in 5" :key="i"></span>
              </div>
              <button
                v-else
                v-for="tag in trendingTags"
                :key="tag.name"
                @click="selectTag(tag.name)"
                class="tag-chip"
                :title="`${tag.count} posts`"
              >
                {{ tag.name }}
              </button>
            </div>
        </div>

        <div class="divider"></div>

        <div class="actions-section">
          <h3 class="section-label">Extra</h3>
          <div class="time-range-selector">
              <span class="range-label">Time Range:</span>
              <div class="range-options">
                <button
                  v-for="range in ['day', 'week', 'month', 'year', 'all']"
                  :key="range"
                  class="range-btn"
                  :class="{ active: selectedTimeRange === range }"
                  @click="selectedTimeRange = range"
                >
                  {{ range.charAt(0).toUpperCase() + range.slice(1) }}
                </button>
              </div>
            </div>

            <div class="actions-grid">
              <button
                class="quick-action-btn"
                :class="{ active: activeExtraAction === 'most-liked' }"
                @click="onExtraAction('most-liked')"
                title="Most Liked"
              >
                <span class="action-icon">❤️</span>
                <span class="action-label">Likes</span>
              </button>
              <button
                class="quick-action-btn"
                :class="{ active: activeExtraAction === 'most-favorited' }"
                @click="onExtraAction('most-favorited')"
                title="Most Favorited"
              >
                <span class="action-icon">⭐</span>
                <span class="action-label">Favs</span>
              </button>
              <button
                class="quick-action-btn"
                :class="{ active: activeExtraAction === 'deleted' }"
                @click="onExtraAction('deleted')"
                title="Deleted Posts"
              >
                <span class="action-icon">🗑️</span>
                <span class="action-label">Deleted</span>
              </button>
              <button
                class="quick-action-btn"
                :class="{
                  active: activeExtraAction === 'random',
                  loading: loadingRandom,
                }"
                @click="onExtraAction('random')"
                title="Random Post"
                :disabled="loadingRandom"
              >
                <span class="action-icon">{{ loadingRandom ? '⏳' : '🎲' }}</span>
                <span class="action-label">{{ loadingRandom ? 'Loading' : 'Random' }}</span>
              </button>
              <button
                class="quick-action-btn"
                :class="{ active: activeExtraAction === 'changed' }"
                @click="onExtraAction('changed')"
                title="Most Changed"
              >
                <span class="action-icon">🔄</span>
                <span class="action-label">Changed</span>
              </button>
              <button
                class="quick-action-btn"
                :class="{ active: activeExtraAction === 'commented' }"
                @click="onExtraAction('commented')"
                title="Most Commented"
              >
                <span class="action-icon">💬</span>
                <span class="action-label">Comments</span>
              </button>
              <button
                class="quick-action-btn"
                :class="{ active: activeExtraAction === 'largest' }"
                @click="onExtraAction('largest')"
                title="Largest Resolution"
              >
                <span class="action-icon">📐</span>
                <span class="action-label">Largest</span>
              </button>
              <button
                class="quick-action-btn"
                :class="{ active: activeExtraAction === 'hot' }"
                @click="onExtraAction('hot')"
                title="Trending Posts (Pulse)"
              >
                <span class="action-icon">🔥</span>
                <span class="action-label">Trending</span>
              </button>
            </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useDanbooruAutocomplete } from "@/composables/useDanbooruAutocomplete";
import { useDanbooruTrending } from "@/composables/useDanbooruTrending";
import { useLayout } from "@/composables/useLayout";

export default {
  name: "SearchForm",
  components: {},
  props: {
    searchQuery: { type: String, default: "" },
    loading: { type: Boolean, default: false },
    limit: { type: Number, default: 20 },
    ratingFilter: { type: String, default: "" },
    posts: { type: Array, default: () => [] },
    infiniteScroll: { type: Boolean, default: false },
    masonryMode: { type: Boolean, default: false },
    activeExtraAction: { type: String, default: null },
    loadingRandom: { type: Boolean, default: false },
  },
  emits: [
    "update:search-query",
    "update:limit",
    "update:rating-filter",
    "update:masonry-mode",
    "search",
    "example-clicked",
    "trigger-action",
    "search-error",
  ],
  setup(props, { emit }) {
    const router = useRouter();
    const route = useRoute();
    const {
      suggestions,
      fetchSuggestions,
      clearSuggestions,
      loadingSuggestions,
      insertSuggestion,
    } = useDanbooruAutocomplete();
    const { trendingTags, loadingTrending, fetchTrendingTags } =
      useDanbooruTrending();
    const { isSidebarVisible, toggleSidebar } = useLayout();

    const selectedTimeRange = ref("month"); // Default to month

    // En SearchForm.vue, dentro del setup()
    const syncStateFromRoute = () => {
      const tags = route.query.tags || "";

      const ageMatch = tags.match(/age:<(\d+)([dwm]|month|y)\b/);
      if (ageMatch) {
        const unit = ageMatch[2];
        const map = { d: 'day', w: 'week', m: 'month', month: 'month', y: 'year' };
        selectedTimeRange.value = map[unit] || 'month';
      } else if (
        /order:(?:score|favcount|rank|change|comment|mpixels)|status:deleted/.test(tags)
      ) {
        selectedTimeRange.value = "all";
      } else {
        selectedTimeRange.value = "month";
      }
    };

    // Watch for route change to update sidebar UI
    watch(
      () => route.query,
      () => {
        syncStateFromRoute();
      },
      { deep: true },
    );

    onMounted(() => {
      syncStateFromRoute();
    });

    // Auto-trigger the current extra action when range changes
    watch(selectedTimeRange, (newRange) => {
      if (props.activeExtraAction) {
        emit("trigger-action", props.activeExtraAction, newRange);
      }
    });

    const onExtraAction = (action) => {
      emit("trigger-action", action, selectedTimeRange.value);
    };

    const activeSuggestionIndex = ref(-1);
    const searchInputRef = ref(null);

    // Rating Dropdown Logic
    const ratingDropdownOpen = ref(false);
    const showLimitTooltip = ref(false);
    const showSearchTooltip = ref(false);
    const ratingOptions = [
      { value: "", label: "All" },
      { value: "general", label: "General (G)" },
      { value: "safe", label: "Safe (S)" },
      { value: "questionable", label: "Questionable (Q)" },
      { value: "explicit", label: "Explicit (E)" },
    ];

    const toggleRatingDropdown = () => {
      ratingDropdownOpen.value = !ratingDropdownOpen.value;
    };

    const selectRating = (value) => {
      // Si el valor es vacío (All), limpiar todo
      if (!value) {
        emit("update:rating-filter", "");
        ratingDropdownOpen.value = false;
        return;
      }

      // Lógica de toggle para multi-select
      let current = props.ratingFilter ? props.ratingFilter.split(",") : [];

      // Si "All" estaba seleccionado (vacío), current es []
      // Si el valor ya está, quitarlo
      if (current.includes(value)) {
        current = current.filter((v) => v !== value);
      } else {
        // Si no está, añadirlo
        current.push(value);
      }

      // Si nos quedamos sin nada, es "All"
      const newVal = current.join(",");
      emit("update:rating-filter", newVal);
      // No cerramos el dropdown para permitir múltiple selección
    };

    const getRatingLabel = (value) => {
      if (!value) return "All";
      const selected = value.split(",");
      if (selected.length === 1) {
        const opt = ratingOptions.find((o) => o.value === selected[0]);
        return opt ? opt.label : value;
      }
      return `${selected.length} Selected`;
    };

    const isSelected = (value) => {
      if (!value && !props.ratingFilter) return true;
      if (!value) return false;
      return props.ratingFilter.split(",").includes(value);
    };

    // Close dropdown on click outside
    const handleClickOutside = (e) => {
      const target = e.target;
      if (!target.closest(".custom-select")) {
        ratingDropdownOpen.value = false;
      }
      if (!target.closest(".limit-input-wrapper")) {
        showLimitTooltip.value = false;
      }
      if (!target.closest(".section-label-wrapper")) {
        showSearchTooltip.value = false;
      }
    };

    onMounted(() => {
      document.addEventListener("click", handleClickOutside);
    });

    onUnmounted(() => {
      document.removeEventListener("click", handleClickOutside);
    });

    onMounted(() => {
      fetchTrendingTags();
    });

    const refreshTrending = () => {
      fetchTrendingTags();
    };

    const selectTag = async (tagName) => {
      // Keep current rating in URL
      const query = { tags: tagName };

      if (props.ratingFilter) {
        query.rating = props.ratingFilter;
      }

      await router.push({
        path: "/",
        query: query,
      });
      closeSidebarOnMobile();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Autocomplete Logic
    const handleInput = (e) => {
      const value = e.target.value;
      emit("update:search-query", value);

      // Composable handles debounce internally
      fetchSuggestions(value);
      activeSuggestionIndex.value = -1;
    };

    const navigateSuggestions = (direction) => {
      if (suggestions.value.length === 0) return;

      activeSuggestionIndex.value += direction;

      if (activeSuggestionIndex.value < 0) {
        activeSuggestionIndex.value = suggestions.value.length - 1;
      } else if (activeSuggestionIndex.value >= suggestions.value.length) {
        activeSuggestionIndex.value = 0;
      }
    };

    const selectSuggestion = (tag) => {
      const newQuery = insertSuggestion(props.searchQuery, tag.name);

      emit("update:search-query", newQuery.replace(/ /g, ", "));
      clearSuggestions();
      // Keep focus
      if (searchInputRef.value) searchInputRef.value.focus();
    };

    const closeSidebarOnMobile = () => {
      // Check if running in browser environment
      if (
        typeof window !== "undefined" &&
        window.innerWidth <= 768 &&
        isSidebarVisible.value
      ) {
        toggleSidebar();
      }
    };

    const handleEnter = async () => {
      if (activeSuggestionIndex.value !== -1 && suggestions.value.length > 0) {
        selectSuggestion(suggestions.value[activeSuggestionIndex.value]);
      } else {
        // Update URL and scroll to top
        const trimmedQuery = props.searchQuery.replace(/, ?/g, " ").replace(/ +/g, " ").trim();
        if (trimmedQuery) {
          await router.push({ path: "/", query: { tags: trimmedQuery } });
          closeSidebarOnMobile();
        } else {
          // Navigate to root without tags param when search is empty
          await router.push({ path: "/" });
          closeSidebarOnMobile();
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
        clearSuggestions();
      }
    };

    const handleSearch = async () => {
      const trimmedQuery = props.searchQuery.replace(/, ?/g, " ").replace(/ +/g, " ").trim();

      // Update URL with current rating filter
      const query = {};

      if (trimmedQuery) {
        query.tags = trimmedQuery;
      }

      // Include current rating in URL if set
      if (props.ratingFilter) {
        query.rating = props.ratingFilter;
      }

      await router.push({
        path: "/",
        query: query,
      });

      closeSidebarOnMobile();
      window.scrollTo({ top: 0, behavior: "smooth" });
      clearSuggestions();
    };

    const handleBlur = () => {
      // Delay clear to allow click event to register
      setTimeout(() => {
        clearSuggestions();
      }, 200);
    };

    const handleLimitUpdate = (e) => {
      let val = parseInt(e.target.value);
      if (isNaN(val)) return;

      // Hard limits to prevent overload
      if (val > 200) val = 200;
      if (val < 10) val = 10;

      // Update input display if clamped
      if (val !== parseInt(e.target.value)) {
        e.target.value = val;
      }

      emit("update:limit", val);
    };

    return {
      trendingTags,
      loadingTrending,
      refreshTrending,
      selectTag,
      suggestions,
      loadingSuggestions,
      activeSuggestionIndex,
      handleInput,
      navigateSuggestions,
      selectSuggestion,
      handleEnter,
      handleSearch,
      handleBlur,

      // Limit Logic
      handleLimitUpdate,
      showLimitTooltip,
      showSearchTooltip,

      selectedTimeRange,
      onExtraAction,

      // Rating Logic
      ratingDropdownOpen,
      ratingOptions,
      toggleRatingDropdown,
      selectRating,
      getRatingLabel,
      isSelected,
      isSidebarVisible,
      toggleSidebar,
    };
  },
};
</script>

<style scoped>
.sidebar-container {
  position: sticky;
  top: 20px;
  align-self: flex-start;
  max-height: calc(100vh - 40px);
  width: 260px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  overflow: visible;
  min-height: 0;
}

.sidebar-container.is-collapsed {
  width: 0;
  margin-right: 0;
  height: auto !important;
  min-height: 0 !important;
  max-height: none !important;
  padding: 0;
  overflow: hidden;
  /* El gap del flex se mantendrá si no lo cambiamos en el padre, 
     pero desactivamos el tamaño del contenedor */
}

.sidebar-container.is-collapsed .sidebar {
  opacity: 0;
  visibility: hidden;
  border: none;
  box-shadow: none;
  pointer-events: none;
}

.sidebar-container.is-collapsed .sidebar-header {
  border-bottom: none;
  padding: 0;
  margin: 0;
  height: 0;
  overflow: hidden;
}

/* Enfoque simple - Eliminar complejidad */
.title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  background: linear-gradient(90deg, #fff, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  white-space: nowrap;
  /* SÓLO animar opacidad */
  transition: opacity 0.2s ease;
  display: block;
  opacity: 1;
}

/* Estado colapsado - Ocultar inmediatamente */
.sidebar-container.is-collapsed .title {
  opacity: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  /* Ocultar sin animación para evitar bugs */
  transition: opacity 0.1s ease;
}

/* Estado abierto - Aparecer con delay */
.sidebar-container:not(.is-collapsed) .title {
  opacity: 1;
  transition: opacity 0.3s ease 0.1s;
}

.sidebar {
  background: rgba(20, 20, 28, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  max-height: 100%;
  overflow-y: auto;
  overflow-x: visible;
  display: flex;
  flex-direction: column;
  transition: all 0.4s ease;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

.sidebar-header {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  min-height: 44px;
}

/* 5. Asegurar que el contenido también tenga timing sincronizado */
.sidebar-content {
  padding: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  opacity: 1;
  transform: translateY(0);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex: 1;
  max-height: calc(100vh - 90px);
}

.sidebar-content.faded {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Custom Scrollbar */
.sidebar::-webkit-scrollbar {
  width: 6px;
}

/* 6. Estado colapsado - contenido */
.sidebar-container.is-collapsed .sidebar-content {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  max-height: 0;
  padding: 0 20px;
  margin: 0;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}
.sidebar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}
.sidebar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

.sidebar-content::-webkit-scrollbar {
  width: 4px;
}
.sidebar-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

/* Sections */
.section-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #64748b;
  margin-bottom: 6px;
  font-weight: 700;
}

.section-label-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 6px;
}

.section-label-wrapper .section-label {
  margin-bottom: 0;
}

.info-icon-btn-search {
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 50%;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  flex-shrink: 0;
  margin-top: -1px;
}

.info-icon-btn-search i {
  font-size: 10px;
  color: #a78bfa;
}

.info-icon-btn-search:hover {
  background: rgba(167, 139, 250, 0.2);
  border-color: rgba(167, 139, 250, 0.4);
  transform: scale(1.1);
}

.search-tooltip {
  position: absolute;
  top: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 30, 40, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: #e2e8f0;
  white-space: nowrap;
  z-index: 200;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}

.input-wrapper {
  position: relative;
  margin-bottom: 6px;
}

.search-wrapper {
  z-index: 100; /* Ensure suggestions are on top */
}

.search-input {
  width: 100%;
  padding: 8px 40px 8px 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  color: #fff;
  font-size: 13px;
  transition: all 0.2s;
  height: 38px;
}

.search-input:focus {
  outline: none;
  border-color: #a78bfa;
  background: rgba(0, 0, 0, 0.3);
  box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.1);
}

.search-btn-icon {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  border: none;
  background: rgba(167, 139, 250, 0.1);
  color: #a78bfa;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;
}

.search-btn-icon:hover:not(:disabled) {
  background: #a78bfa;
  color: white;
  transform: translateY(-50%) scale(1.05);
}

.search-btn-icon:active:not(:disabled) {
  transform: translateY(-50%) scale(0.95);
}

.input-loader {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(167, 139, 250, 0.3);
  border-radius: 50%;
  border-top-color: #a78bfa;
  animation: spin 0.8s linear infinite;
}

.search-btn-icon:hover .input-loader {
  border-color: rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.hint {
  font-size: 10px;
  color: #64748b;
  margin-bottom: 8px;
}

.limit-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
}

.info-icon-btn-limit {
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  flex-shrink: 0;
}

.info-icon-btn-limit i {
  font-size: 11px;
  color: #a78bfa;
}

.info-icon-btn-limit:hover {
  background: rgba(167, 139, 250, 0.2);
  border-color: rgba(167, 139, 250, 0.4);
  transform: scale(1.1);
}

.limit-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: rgba(30, 30, 40, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(167, 139, 250, 0.3);
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: #e2e8f0;
  white-space: nowrap;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: all 0.2s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(5px);
}

.limit-tooltip-fade-enter-active,
.limit-tooltip-fade-leave-active {
  transition: all 0.2s ease;
}

.limit-tooltip-fade-enter-from,
.limit-tooltip-fade-leave-to {
  opacity: 0;
  transform: translateY(5px);
}

.action-btn {
  width: 100%;
  padding: 8px;
  border-radius: 6px;
  border: none;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow:
    0 4px 15px rgba(124, 58, 237, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 12px;
  font-weight: 700;
}

.action-btn.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow:
    0 8px 25px rgba(124, 58, 237, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  filter: brightness(1.1);
}

.action-btn.primary:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: 0 2px 10px rgba(124, 58, 237, 0.3);
}

.btn-loader {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.05);
  margin: 12px 0;
}

.option-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.opt-text {
  font-size: 12px;
  color: #cbd5e1;
}

.limit-hint {
  font-size: 10px;
  color: #64748b;
  margin-left: 4px;
}

.limit-input {
  width: 55px;
  padding: 4px 6px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #fff;
  text-align: center;
  font-size: 13px;
}

.rating-select {
  width: 130px;
  padding: 4px 6px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}

.rating-select option {
  background: #1e1e24;
}

.popular-section {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.shuffle-btn {
  background: transparent;
  border: none;
  color: #a78bfa;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  transition: transform 0.3s;
}

.shuffle-btn:hover {
  transform: rotate(180deg);
}

.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-chip {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 6px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(192, 132, 252, 0.2);
  color: #c084fc;
  transition: all 0.2s;
  font-weight: 500;
  line-height: 1.4;
  font-family: inherit;
  flex-grow: 1;
  text-align: center;
  justify-content: center;
  display: flex;
}

.tag-chip:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(192, 132, 252, 0.4);
  color: #fff;
}

/* Autocomplete Styles */
.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  background: #1a1a23;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 8px;
  margin-top: 4px;
  padding: 2px 0;
  list-style: none;
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
  overflow-x: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

/* Custom Scrollbar for suggestions */
.suggestions-list::-webkit-scrollbar {
  width: 6px;
}
.suggestions-list::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}
.suggestions-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
.suggestions-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

.suggestion-item {
  display: flex;
  justify-content: space-between;
  align-items: center; /* Center vertically */
  padding: 6px 10px;
  cursor: pointer;
  transition: background 0.1s;
  font-size: 12px;
}

.suggestion-item:hover,
.suggestion-item.active {
  background: rgba(167, 139, 250, 0.15);
}

.suggestion-name {
  font-weight: 500;
  word-break: break-word; /* Ensure it wraps */
  margin-right: 8px;
  line-height: 1.3;
}

.suggestion-count {
  color: #64748b;
  font-size: 11px;
  white-space: nowrap; /* Keep count on one line */
  flex-shrink: 0; /* Prevent key shrinking */
}

/* Tag Colors */
.tag-general {
  color: #a78bfa;
}
.tag-artist {
  color: #c084fc;
  font-weight: 700;
}
.tag-copyright {
  color: #d8b4fe;
  font-weight: 700;
}
.tag-character {
  color: #818cf8;
  font-weight: 700;
}
.tag-meta {
  color: #94a3b8;
}

/* === ESTILOS MÓVIL - TRANSICIÓN LIMPIA === */
@media (max-width: 1024px) {
  .sidebar-container {
    position: fixed;
    top: 0;
    left: 0;
    height: 100vh;
    max-height: 100vh;
    width: 280px;
    z-index: 1000;
    /* Estado inicial: fuera de pantalla */
    transform: translateX(-100%);
    /* SÓLO animar transform - el contenido permanece visible */
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    /* Eliminar todas las animaciones de opacidad en móvil */
    animation: none;
    opacity: 1 !important;
  }

  /* Estado ABIERTO (visible) */
  .sidebar-container:not(.is-collapsed) {
    transform: translateX(0);
    box-shadow: 15px 0 40px rgba(0, 0, 0, 0.3);
    transition:
      transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
      box-shadow 0.3s ease 0.1s;
  }

  /* Estado CERRADO (deslizando fuera) */
  .sidebar-container.is-collapsed {
    transform: translateX(-100%);
    box-shadow: none;
    transition: transform 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53);

    /* OVERRIDES CRÍTICOS: Mantener tamaño completo durante la animación */
    width: 280px !important;
    height: 100vh !important;
    min-height: 100vh !important;
    max-height: 100vh !important;
    padding: 0 !important;
    overflow: visible !important;
    border: none !important;
    background: transparent !important;
  }

  /* Sidebar interno - mantener estilo completo durante animación */
  .sidebar {
    width: 100% !important;
    height: 100% !important;
    max-height: none !important;
    min-height: 0 !important;
    background: rgba(20, 20, 28, 0.98) !important;
    backdrop-filter: blur(20px) !important;
    border: none !important;
    border-radius: 0 !important;
    border-top-right-radius: 16px !important;
    border-bottom-right-radius: 16px !important;
    display: flex !important;
    flex-direction: column !important;
    padding: 0 !important;
    box-shadow: none !important;
    overflow-y: auto !important;
  }

  /* Header visible durante toda la animación */
  .sidebar-header {
    width: auto !important;
    height: auto !important;
    display: flex !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
    padding: 10px 14px !important;
    margin: 0 !important;
    min-height: 44px !important;
    flex-shrink: 0 !important;
  }

  /* === CONTENIDO - ELIMINAR ANIMACIONES DE OPACIDAD EN MÓVIL === */
  .sidebar-content {
    /* Contenido SIEMPRE visible durante la animación en móvil */
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transform: none !important;
    /* Eliminar todas las transiciones que afecten opacidad/visibilidad */
    transition: none !important;

    /* Layout */
    height: calc(100% - 44px);
    max-height: none !important;
    padding: 12px !important;
    padding-bottom: max(12px, env(safe-area-inset-bottom)) !important;
    display: flex !important;
    flex-direction: column !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }

  /* Eliminar clase .faded en móvil */
  .sidebar-content.faded {
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transform: none !important;
    transition: none !important;
  }

  /* Eliminar estado colapsado del contenido en móvil */
  .sidebar-container.is-collapsed .sidebar-content {
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: none !important; /* Solo desactivar clicks durante animación */
    max-height: none !important;
    padding: 12px !important;
    margin: 0 !important;
    overflow: hidden !important;
    transition: none !important;
  }

  /* Asegurar que ocupe espacio mínimo necesario */
  .actions-grid {
    min-height: 100px;
  }

  /* El último elemento empuja hacia abajo */
  .actions-section:last-child {
    margin-top: auto;
    padding-bottom: 6px;
  }

  /* === TÍTULO Y BOTÓN === */
  .title {
    opacity: 1 !important;
    transition: none !important;
  }

  /* Ocultar botón de toggle interno en móvil */
  .sidebar-header .toggle-btn {
    display: none;
  }

  /* === SCROLLBAR EN MÓVIL === */
  .sidebar::-webkit-scrollbar {
    width: 4px;
  }

  .sidebar::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
  }

  .sidebar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }
}

/* Para desktop, podemos mantener una animación sutil PERO sin afectar móvil */
@media (min-width: 769px) {
  .sidebar-container {
    /* Solo en desktop, animación sutil de entrada */
    animation: sidebarEntranceDesktop 0.5s ease-out;
  }

  @keyframes sidebarEntranceDesktop {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}

.loading-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag-skeleton {
  width: 60px;
  height: 24px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    opacity: 0.5;
  }
  50% {
    opacity: 0.8;
  }
  100% {
    opacity: 0.5;
  }
}

/* Custom Select Styles */
.custom-select {
  position: relative;
  width: 140px;
}

.select-trigger {
  width: 100%;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
}

.select-trigger:hover,
.custom-select.is-open .select-trigger {
  background: rgba(0, 0, 0, 0.3);
  border-color: rgba(167, 139, 250, 0.5);
}

.chevron {
  font-size: 10px;
  opacity: 0.6;
  transition: transform 0.2s;
}

.custom-select.is-open .chevron {
  transform: rotate(180deg);
}

.custom-options {
  position: absolute;
  top: 100%;
  right: 0; /* Align right */
  width: 100%;
  min-width: 160px;
  background: #1a1a23;
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 8px;
  margin-top: 4px;
  padding: 2px;
  list-style: none;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

.custom-option {
  padding: 6px 10px;
  font-size: 12px;
  color: #cbd5e1;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.1s;
}

.custom-option:hover {
  background: rgba(167, 139, 250, 0.15);
  color: white;
}

.custom-option.selected {
  background: rgba(167, 139, 250, 0.1);
  color: #a78bfa;
  font-weight: 600;
}

.check {
  font-size: 12px;
  color: #a78bfa;
}

/* Dropdown Animation */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

/* Time Range Selector */
.time-range-selector {
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.range-label {
  font-size: 11px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.range-options {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
  padding: 2px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.range-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 10px;
  font-weight: 600;
  padding: 4px 0;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  text-transform: capitalize;
}

.range-btn:hover {
  color: #cbd5e1;
  background: rgba(255, 255, 255, 0.03);
}

.range-btn.active {
  background: #a78bfa;
  color: #16161d;
  box-shadow: 0 2px 8px rgba(167, 139, 250, 0.3);
}

/* Quick Actions */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.quick-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.quick-action-btn.loading {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.3);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.quick-action-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 6px 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: all 0.2s;
  color: #cbd5e1;
}

.quick-action-btn:hover {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.3);
  color: #fff;
  transform: translateY(-2px);
}

.quick-action-btn.active {
  background: #a78bfa;
  border-color: #a78bfa;
  color: #16161d;
  box-shadow: 0 4px 12px rgba(167, 139, 250, 0.4);
}

.quick-action-btn.active .action-icon {
  transform: scale(1.1);
}

.action-icon {
  font-size: 14px;
}

.action-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.sidebar-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 999;
  display: none;
}

@media (max-width: 1024px) {
  .sidebar-backdrop {
    display: block;
  }
}

.mobile-close-btn {
  display: none;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #fff;
  transition: all 0.2s ease;
}

.mobile-close-btn:hover {
  background: rgba(167, 139, 250, 0.2);
  border-color: rgba(167, 139, 250, 0.4);
}

@media (max-width: 1024px) {
  .mobile-close-btn {
    display: flex;
  }
}
</style>
