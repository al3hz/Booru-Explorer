<template>
  <div class="sidebar-container" :class="{ 'is-collapsed': !sidebarVisible }">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2 class="title">Filters</h2>
        <button 
          class="toggle-btn"
          @click="$emit('toggle-sidebar')"
          :title="sidebarVisible ? 'Collapse menu' : 'Expand menu'"
        >
          <span class="icon">◀</span>
        </button>
      </div>

      <div class="sidebar-content" :class="{ 'faded': !sidebarVisible }">
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
                You can search up to 2 tags
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
              <span v-if="loading || loadingSuggestions" class="input-loader"></span>
              <span v-else>🔍</span>
            </button> 

            <!-- Autocomplete Dropdown -->
            <ul class="suggestions-list" v-if="suggestions.length > 0">
              <li 
                v-for="(tag, index) in suggestions" 
                :key="tag.name"
                class="suggestion-item"
                :class="{ 'active': index === activeSuggestionIndex }"
                @mousedown.prevent="selectSuggestion(tag)"
              >
                <span class="suggestion-name" :class="tag.class">{{ tag.name }}</span>
                <span class="suggestion-count">{{ formatCount(tag.post_count) }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="divider"></div>

        <div class="options-section">
          <h3 class="section-label">Filters</h3>
          
          <div class="option-row">
            <label class="opt-text" for="limit-input">Results per page</label>
            <div class="limit-input-wrapper">
              <input
                id="limit-input"
                name="limit"
                type="number"
                :value="limit"
                @input="handleLimitUpdate"
                min="1"
                max="100"
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
                  Min: 1, Max: 100 posts
                </div>
              </transition>
            </div>
          </div>

          <div class="option-row">
            <span class="opt-text">Rating</span>
            <div class="custom-select" :class="{ 'is-open': ratingDropdownOpen }">
              <button class="select-trigger" @click.stop="toggleRatingDropdown">
                <span class="selected-value">{{ getRatingLabel(ratingFilter) }}</span>
                <span class="chevron">▼</span>
              </button>
              
              <transition name="dropdown-fade">
                <ul v-if="ratingDropdownOpen" class="custom-options">
                  <li 
                    v-for="opt in ratingOptions" 
                    :key="opt.value"
                    class="custom-option"
                    :class="{ 'selected': ratingFilter === opt.value }"
                    @click="selectRating(opt.value)"
                  >
                    <span class="option-label">{{ opt.label }}</span>
                    <span v-if="ratingFilter === opt.value" class="check">✓</span>
                  </li>
                </ul>
              </transition>
            </div>
          </div>
        </div>

        <div class="divider"></div>

        <div class="accordion-section popular-section" :class="{ open: activeSection === 'trending' }">
          <div class="accordion-header" @click="toggleSection('trending')">
            <h3 class="section-label">Trending (Top 15)</h3>
            <span class="accordion-arrow">▼</span>
          </div>
          
          <div class="accordion-content">
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
        </div>

        <div class="divider"></div>

        <div class="accordion-section actions-section" :class="{ open: activeSection === 'extra' }">
          <div class="accordion-header" @click="toggleSection('extra')">
            <h3 class="section-label">Extra</h3>
            <span class="accordion-arrow">▼</span>
          </div>
          
          <div class="accordion-content">
            <div class="actions-grid">
              <button class="quick-action-btn" @click="$emit('trigger-action', 'most-liked')" title="Most Liked (Month)">
                <span class="action-icon">❤️</span>
                <span class="action-label">Likes (M)</span>
              </button>
              <button class="quick-action-btn" @click="$emit('trigger-action', 'most-favorited')" title="Most Favorited (Month)">
                <span class="action-icon">⭐</span>
                <span class="action-label">Favs (M)</span>
              </button>
              <button class="quick-action-btn" @click="$emit('trigger-action', 'deleted')" title="Deleted Posts (Month)">
                <span class="action-icon">🗑️</span>
                <span class="action-label">Deleted (M)</span>
              </button>
              <button class="quick-action-btn" @click="$emit('trigger-action', 'random')" title="Random Post">
                <span class="action-icon">🎲</span>
                <span class="action-label">Random</span>
              </button>
              <button class="quick-action-btn" @click="$emit('trigger-action', 'hot')" title="Trending Posts (Day)">
                <span class="action-icon">🔥</span>
                <span class="action-label">Trending</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useDanbooruAutocomplete } from "../composables/useDanbooruAutocomplete";
import { useDanbooruTrending } from "../composables/useDanbooruTrending";

export default {
  name: "SearchForm",
  components: {
  },
  props: {
    searchQuery: { type: String, default: "" },
    loading: { type: Boolean, default: false },
    limit: { type: Number, default: 20 },
    ratingFilter: { type: String, default: "" },
    posts: { type: Array, default: () => [] },
    sidebarVisible: { type: Boolean, default: true },
  },
  emits: [
    "update:search-query",
    "update:limit",
    "update:rating-filter",
    "search",
    "example-clicked",
    "toggle-sidebar",
    "trigger-action",
    "search-error",
  ],
  setup(props, { emit }) {
    const router = useRouter();
    const route = useRoute();
    const { suggestions, fetchSuggestions, clearSuggestions, loadingSuggestions } = useDanbooruAutocomplete();
    const { trendingTags, loadingTrending, fetchTrendingTags } = useDanbooruTrending();
    
    // Accordion state - default to trending
    const activeSection = ref("trending");
    
    const toggleSection = (section) => {
      if (activeSection.value === section) {
        // Optional: allow closing all sections? For now, keep it toggleable or strict accordion
        activeSection.value = null; 
      } else {
        activeSection.value = section;
      }
    };
    
    const activeSuggestionIndex = ref(-1);
    const searchInputRef = ref(null);
    let debounceTimeout = null;

    // Rating Dropdown Logic
    const ratingDropdownOpen = ref(false);
    const showLimitTooltip = ref(false);
    const showSearchTooltip = ref(false);
    const ratingOptions = [
      { value: '', label: 'All' },
      { value: 'general', label: 'General (G)' },
      { value: 'safe', label: 'Safe (S)' },
      { value: 'questionable', label: 'Questionable (Q)' },
      { value: 'explicit', label: 'Explicit (E)' }
    ];

    const toggleRatingDropdown = () => {
      ratingDropdownOpen.value = !ratingDropdownOpen.value;
    };

    const selectRating = (value) => {
      emit('update:rating-filter', value);
      ratingDropdownOpen.value = false;
    };

    const getRatingLabel = (value) => {
      const opt = ratingOptions.find(o => o.value === value);
      return opt ? opt.label : value;
    };

    // Close dropdown on click outside
    onMounted(() => {
      document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target.closest('.custom-select')) {
          ratingDropdownOpen.value = false;
        }
        if (!target.closest('.limit-input-wrapper')) {
          showLimitTooltip.value = false;
        }
        if (!target.closest('.section-label-wrapper')) {
          showSearchTooltip.value = false;
        }
      });
    });

    onMounted(() => {
      fetchTrendingTags();
    });

    const refreshTrending = () => {
      fetchTrendingTags();
    };

    const selectTag = async (tagName) => {
      // Update URL and scroll to top
      await router.push({ path: '/', query: { tags: tagName } });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Autocomplete Logic
    const handleInput = (e) => {
      const value = e.target.value;
      emit("update:search-query", value);
      
      if (debounceTimeout) clearTimeout(debounceTimeout);
      
      debounceTimeout = setTimeout(() => {
        fetchSuggestions(value);
        activeSuggestionIndex.value = -1;
      }, 300);
    };

    const formatCount = (count) => {
      if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
      if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
      return count;
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
      // Reemplazar el último término con el tag seleccionado
      const terms = props.searchQuery.split(/([,，\s]+)/);
      // Encontrar el último término significativo y reemplazarlo
      // Esta lógica es simple, para un manejo robusto de cursores se requeriría más código
      // Por ahora, asumimos que siempre reemplazamos lo que se está escribiendo al final
      
      // Simplemente añadimos el tag si es el comienzo, o reemplazamos el ultimo
      const currentQuery = props.searchQuery;
      // Buscamos el último separador. Si no hay, reemplazamos todo.
      // Pero ojo, si escribimos "blue_hair, 1girl", queremos reemplazar "1girl".
      
      // Una forma más segura: reemplazar lo que coincide con el término de búsqueda actual
      // Pero como fetchSuggestions usa lastTerm, podemos reconstruir
      
      const lastTermMatch = currentQuery.match(/([^\s,，]+)$/);
      let newQuery = "";
      
      if (lastTermMatch) {
         // Reemplazar el final del string
         newQuery = currentQuery.substring(0, lastTermMatch.index) + tag.name + " ";
      } else {
         // Fallback por si acaso
         newQuery = currentQuery + " " + tag.name + " ";
      }

      emit("update:search-query", newQuery);
      clearSuggestions();
      // Keep focus
      if(searchInputRef.value) searchInputRef.value.focus();
    };

    const handleEnter = async () => {
      if (activeSuggestionIndex.value !== -1 && suggestions.value.length > 0) {
        selectSuggestion(suggestions.value[activeSuggestionIndex.value]);
      } else {
        // Update URL and scroll to top
        const trimmedQuery = props.searchQuery.trim();
        if (trimmedQuery) {
          await router.push({ path: '/', query: { tags: trimmedQuery } });
        } else {
          // Navigate to root without tags param when search is empty
          await router.push({ path: '/' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
        clearSuggestions();
      }
    };

    const handleSearch = async () => {
      // Validate tag count before search
      const trimmedQuery = props.searchQuery.trim();
      const tags = trimmedQuery
        .split(/[,，\s]+/)
        .map(t => t.trim())
        .filter(t => t.length > 0 && !t.startsWith('rating:') && !t.startsWith('order:') && !t.startsWith('status:') && !t.startsWith('age:') && !t.startsWith('-'));
      
      if (tags.length > 2) {
        // Emit error to parent
        emit('search-error', `You can only search up to 2 tags at a time. You entered ${tags.length} tags: ${tags.join(', ')}`);
        return;
      }
      
      // Update URL and scroll to top when search button is clicked
      if (trimmedQuery) {
        await router.push({ 
          path: '/', 
          query: { 
            tags: trimmedQuery,
            rating: route.query.rating || undefined
          } 
        });
      } else {
        // Navigate to root without tags param when search is empty
        await router.push({ 
          path: '/', 
          query: { 
            rating: route.query.rating || undefined 
          } 
        });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
      if (val > 100) val = 100;
      if (val < 1) val = 1;
      
      // Update input display if clamped
      if (val !== parseInt(e.target.value)) {
        e.target.value = val;
      }
      
      emit('update:limit', val);
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
      formatCount,

      // Limit Logic
      handleLimitUpdate,
      showLimitTooltip,
      showSearchTooltip,

      // Accordion
      activeSection,
      toggleSection,
      
      // Rating Logic
      ratingDropdownOpen,
      ratingOptions,
      toggleRatingDropdown,
      selectRating,
      getRatingLabel
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
  width: 300px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  overflow: visible;
  min-height: 0;
}


.sidebar-container.is-collapsed {
  width: 60px;
  height: auto !important;
  min-height: 0 !important;
  max-height: 60px !important;
  padding: 4px;
  overflow: hidden;
  contain: content;
}

.sidebar-container.is-collapsed .sidebar {
  background: rgba(20, 20, 28, 0.6);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(167, 139, 250, 0.3);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  width: 100%;
  height: 52px; /* Altura fija */
  min-height: 52px; /* Altura mínima fija */
  max-height: 52px; /* Altura máxima fija */
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  /* Prevenir desbordamiento */
  overflow: hidden;
}

/* Hover effect for the collapsed box */
.sidebar-container.is-collapsed:hover .sidebar {
  border-color: rgba(167, 139, 250, 0.6);
  box-shadow: 0 0 15px rgba(167, 139, 250, 0.15); /* Soft glow */
  background: rgba(30, 30, 40, 0.8);
}

.sidebar-container.is-collapsed .sidebar-header {
  border-bottom: none;
  padding: 0;
  margin: 0;
  height: 52px;
  width: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Enfoque simple - Eliminar complejidad */
.title {
  margin: 0;
  font-size: 18px;
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
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  min-height: 60px;
}



/* 1. Botón de toggle - Sincronizar todo */
.toggle-btn {
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 8px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #a78bfa;
  /* Animación MÁS RÁPIDA para el botón */
  transition: all 0.15s ease;
  /* Asegurar que el contenido no se desborde */
  overflow: hidden;
  position: relative;
}

/* 2. Icono dentro del botón */
.toggle-btn .icon {
  font-size: 14px;
  line-height: 1;
  display: inline-block;
  /* Transición instantánea para el icono */
  transition: transform 0.15s ease;
  will-change: transform;
}

/* 3. Cuando el sidebar está COLAPSADO */
.sidebar-container.is-collapsed .toggle-btn {
  width: 44px;
  height: 44px;
  /* Animación más rápida que el contenedor */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 4. IMPORTANTE: Sincronizar el cambio de icono */
.sidebar-container.is-collapsed .toggle-btn .icon {
  /* Rotar el icono existente en lugar de cambiarlo */
  transform: rotate(180deg);
  transition: transform 0.2s ease 0.05s; /* Pequeño delay */
}

/* 5. Estado normal (no colapsado) */
.sidebar-container:not(.is-collapsed) .toggle-btn .icon {
  transform: rotate(0deg);
  transition: transform 0.2s ease;
}

/* 6. Hover states sincronizados */
.toggle-btn:hover {
  background: rgba(167, 139, 250, 0.15);
  color: #fff;
  transform: scale(1.05);
  transition: all 0.2s ease;
}

.sidebar-container.is-collapsed .toggle-btn:hover {
  transform: scale(1.05);
}

/* 5. Asegurar que el contenido también tenga timing sincronizado */
.sidebar-content {
  padding: 20px;
  overflow-y: auto;
  overflow-x: hidden;
  opacity: 1;
  transform: translateY(0);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  flex: 1;
  max-height: calc(100vh - 140px);
}

.sidebar-content.faded {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Custom Scrollbar */
.sidebar::-webkit-scrollbar { width: 6px; }

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




.sidebar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
.sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }
.sidebar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }

.sidebar-content::-webkit-scrollbar { width: 4px; }
.sidebar-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

/* Sections */
.section-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #64748b;
  margin-bottom: 10px;
  font-weight: 700;
}

/* Accordion Styles */
.accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  padding: 12px 0;
  user-select: none;
  transition: color 0.2s;
}

.accordion-header:hover {
  color: #a78bfa;
}

.accordion-header:hover .section-label {
  color: #a78bfa;
}

.accordion-header .section-label {
  margin-bottom: 0; /* Align perfectly with arrow */
}

.accordion-arrow {
  font-size: 12px;
  color: #94a3b8;
  transition: transform 0.3s ease;
}

.open .accordion-header .accordion-arrow {
  transform: rotate(180deg);
}

.accordion-content {
  display: grid;
  grid-template-rows: 0fr;
  overflow: hidden; /* Prevent ghost scrollbars */
  transition: grid-template-rows 0.3s ease-out, opacity 0.3s ease, margin 0.3s ease;
  opacity: 0;
}

.open .accordion-content {
  grid-template-rows: 1fr;
  opacity: 1;
  margin-top: 10px;
}

.accordion-content > div {
  overflow: hidden;
  min-height: 0;
}

.section-label-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
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
  padding: 8px 12px;
  font-size: 11px;
  color: #e2e8f0;
  white-space: nowrap;
  z-index: 200;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}


.input-wrapper {
  position: relative;
  margin-bottom: 8px;
}

.search-wrapper {
  z-index: 100; /* Ensure suggestions are on top */
}

.search-input {
  width: 100%;
  padding: 12px 45px 12px 12px; /* Extra padding for button */
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px; /* More rounded */
  color: #fff;
  font-size: 14px;
  transition: all 0.2s;
  height: 48px;
}

.search-input:focus {
  outline: none;
  border-color: #a78bfa;
  background: rgba(0, 0, 0, 0.3);
  box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.1);
}

.search-btn-icon {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  border: none;
  background: rgba(167, 139, 250, 0.1);
  color: #a78bfa;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  transition: all 0.2s;
}

.search-btn-icon:hover:not(:disabled) {
  background: #a78bfa;
  color: white;
  transform: translateY(-50%) scale(1.05); /* Keep vertical centering */
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
  to { transform: rotate(360deg); }
}

.hint {
  font-size: 10px;
  color: #64748b;
  margin-bottom: 12px;
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
  padding: 8px 12px;
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
  padding: 10px;
  border-radius: 8px;
  border: none;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  text-transform: uppercase;
  letter-spacing: 1px;
  font-size: 14px;
  font-weight: 700;
}

.action-btn.primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(124, 58, 237, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  filter: brightness(1.1);
}

.action-btn.primary:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: 0 2px 10px rgba(124, 58, 237, 0.3);
}

.btn-loader {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.05);
  margin: 20px 0;
}

.option-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.opt-text {
  font-size: 13px;
  color: #cbd5e1;
}

.limit-hint {
  font-size: 10px;
  color: #64748b;
  margin-left: 4px;
}

.limit-input {
  width: 60px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: #fff;
  text-align: center;
  font-size: 13px;
}

.rating-select {
  width: 140px;
  padding: 6px;
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
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.shuffle-btn {
  background: transparent;
  border: none;
  color: #a78bfa;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  transition: transform 0.3s;
}

.shuffle-btn:hover {
  transform: rotate(180deg);
}

.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-chip {
  font-size: 13px; /* Increased from 12px */
  padding: 5px 10px; /* Increased from 4px 8px */
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
  padding: 4px 0;
  list-style: none;
  z-index: 1000;
  max-height: 250px;
  overflow-y: auto;
  overflow-x: hidden;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
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
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.1s;
  font-size: 13px;
}

.suggestion-item:hover, .suggestion-item.active {
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
.tag-general { color: #a78bfa; }
.tag-artist { color: #c084fc; font-weight: 700; }
.tag-copyright { color: #d8b4fe; font-weight: 700; }
.tag-character { color: #818cf8; font-weight: 700; }
.tag-meta { color: #94a3b8; }

/* === ESTILOS MÓVIL - TRANSICIÓN LIMPIA === */
@media (max-width: 768px) {
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
    box-shadow: 15px 0 40px rgba(0,0,0,0.3);
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
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
    padding: 16px !important;
    margin: 0 !important;
    min-height: 60px !important;
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
    height: calc(100% - 60px); /* 100% menos el header */
    max-height: none !important;
    padding: 20px !important;
    padding-bottom: max(20px, env(safe-area-inset-bottom)) !important;
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
    padding: 20px !important;
    margin: 0 !important;
    overflow: hidden !important;
    transition: none !important;
  }
  
  /* === ACORDEÓN EXTRA - SIEMPRE ABIERTO EN MÓVIL === */
  .actions-section {
    position: relative;
    flex-shrink: 0;
    margin-bottom: 20px;
  }
  
  .actions-section .accordion-header {
    pointer-events: none;
    cursor: default;
  }
  
  .actions-section .accordion-arrow {
    display: none;
  }
  
  .actions-section .accordion-content {
    grid-template-rows: 1fr !important;
    opacity: 1 !important;
    margin-top: 10px !important;
    display: block !important;
    height: auto !important;
    overflow: visible !important;
  }
  
  /* Asegurar que ocupe espacio mínimo necesario */
  .actions-grid {
    min-height: 120px;
  }
  
  /* El último elemento empuja hacia abajo */
  .actions-section:last-child {
    margin-top: auto;
    padding-bottom: 10px;
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
  gap: 8px;
}

.tag-skeleton {
  width: 60px;
  height: 24px;
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { opacity: 0.5; }
  50% { opacity: 0.8; }
  100% { opacity: 0.5; }
}

/* Custom Select Styles */
.custom-select {
  position: relative;
  width: 140px;
}

.select-trigger {
  width: 100%;
  padding: 8px 12px;
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

.select-trigger:hover, .custom-select.is-open .select-trigger {
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
  padding: 4px;
  list-style: none;
  z-index: 1000;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}

.custom-option {
  padding: 8px 12px;
  font-size: 13px;
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

/* Quick Actions */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.actions-grid .quick-action-btn:last-child {
  grid-column: 1 / -1;
  background: rgba(167, 139, 250, 0.1); /* Slight highlight */
  border-color: rgba(167, 139, 250, 0.2);
}

.actions-grid .quick-action-btn:last-child:hover {
  background: rgba(167, 139, 250, 0.2);
}

.quick-action-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 10px 4px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
  color: #cbd5e1;
}

.quick-action-btn:hover {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.3);
  color: #fff;
  transform: translateY(-2px);
}

.action-icon {
  font-size: 16px;
}

.action-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
