<template>
  <div class="sidebar-container" :class="{ 'is-collapsed': !filtersVisible }">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h2 class="title">Pool Filters</h2>
        <button class="mobile-close-btn" @click="toggleSidebar" v-if="filtersVisible && isMobile">
          <i class="lni lni-close"></i>
        </button>
      </div>

      <div class="sidebar-content" :class="{ 'faded': !filtersVisible }">
        <!-- Search Queries -->
        <div class="search-section">
          <div class="section-label-wrapper">
            <label class="section-label">Search</label>
          </div>
          
          <div class="input-wrapper">
            <i class="lni lni-search-alt"></i>
            <input 
              id="search-name"
              name="search-name"
              aria-label="Search by name"
              v-model="localFilters.name" 
              @keyup.enter="applyFilters" 
              placeholder="Search by name..." 
              type="text"
              class="search-input"
            />
          </div>
          
          <div class="input-wrapper mt-2">
            <i class="lni lni-text-align-left"></i>
            <input 
              id="search-description"
              name="search-description"
              aria-label="Search by description"
              v-model="localFilters.description" 
              @keyup.enter="applyFilters" 
              placeholder="Description..." 
              type="text"
              class="search-input"
            />
          </div>
        </div>

        <div class="divider"></div>

        <!-- Category Filter -->
        <div class="options-section">
          <h3 class="section-label">Category</h3>
          
          <div class="filter-options">
            <button 
              v-for="cat in ['series', 'collection']" 
              :key="cat"
              class="filter-chip tag-chip"
              :class="{ active: localFilters.category === cat, disabled: loading }"
              @click="toggleCategory(cat)"
              :disabled="loading"
            >
              {{ cat.charAt(0).toUpperCase() + cat.slice(1) }}
            </button>
          </div>
        </div>

        <div class="divider"></div>

        <!-- Order Filter -->
        <div class="options-section">
          <h3 class="section-label">Sort Order</h3>
          
          <div class="filter-options">
            <button 
              v-for="opt in sortOptions" 
              :key="opt.value"
              class="filter-chip tag-chip"
              :class="{ active: localFilters.order === opt.value, disabled: loading }"
              @click="setOrder(opt.value)"
              :disabled="loading"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Apply Button -->
        <div class="divider"></div>
        
        <div class="actions-section">
          <button 
            class="action-btn primary" 
            @click="applyFilters" 
            :disabled="loading" 
            :style="{ opacity: loading ? 0.7 : 1 }"
          >
            <i class="lni" :class="loading ? 'lni-spinner lni-spin' : 'lni-funnel'"></i>
            {{ loading ? 'Updating...' : 'Apply Filters' }}
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<script>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { usePoolFilters } from '../composables/usePoolFilters';

export default {
  name: 'PoolsSidebar',
  props: {
    filters: {
      type: Object,
      required: true
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:filters', 'search'],
  setup(props, { emit }) {
    const { filtersVisible, toggleFilters } = usePoolFilters();
    const isMobile = ref(false);
    
    // Local copy for editing
    const localFilters = ref({ ...props.filters });
    
    // Sync when props change
    watch(() => props.filters, (newVal) => {
      localFilters.value = { ...newVal };
    }, { deep: true });

    const sortOptions = [
      { label: 'Updated', value: 'updated_at' },
      { label: 'Created', value: 'created_at' },
      { label: 'Name', value: 'name' },
      { label: 'Post Count', value: 'post_count' },
    ];

    const toggleCategory = (cat) => {
      if (props.loading) return;
      localFilters.value.category = localFilters.value.category === cat ? '' : cat;
      applyFilters();
    };

    const setOrder = (order) => {
      if (props.loading) return;
      localFilters.value.order = order;
      applyFilters();
    };

    const applyFilters = () => {
      emit('update:filters', localFilters.value);
      emit('search');
      closeSidebarOnMobile();
    };

    const checkMobile = () => {
      isMobile.value = window.innerWidth <= 768;
    };

    const toggleSidebar = () => {
      toggleFilters();
    };

    const closeSidebarOnMobile = () => {
      if (isMobile.value && filtersVisible.value) {
        toggleFilters();
      }
    };

    onMounted(() => {
      checkMobile();
      window.addEventListener('resize', checkMobile);
    });

    onUnmounted(() => {
      window.removeEventListener('resize', checkMobile);
    });

    return {
      filtersVisible,
      localFilters,
      sortOptions,
      isMobile,
      toggleCategory,
      setOrder,
      applyFilters,
      toggleSidebar
    };
  }
}
</script>

<style scoped>
/* === ESTILOS PRINCIPALES - COPIADOS DEL PRIMER COMPONENTE === */
.sidebar-container {
  position: sticky;
  top: 240px; /* Reduced sticky top slightly as we now use margin-top for initial position */
  margin-left: 20px;
  margin-right: 20px; /* Restored gap between sidebar and cards */
  margin-top: 60px; /* Push down to align with cards, skipping the 'Collections' header */
  align-self: flex-start;
  max-height: calc(100vh - 150px);
  width: 300px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 90;
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

/* Título con gradiente */
.title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(90deg, #fff, #a78bfa);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  white-space: nowrap;
  transition: opacity 0.2s ease;
  display: block;
  opacity: 1;
}

.sidebar-container.is-collapsed .title {
  opacity: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  transition: opacity 0.1s ease;
}

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

/* Contenido */
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

.sidebar-container.is-hidden {
  width: 0;
  opacity: 0;
  margin-left: 0;
  margin-right: 0;
  margin-top: 60px; /* Maintain vertical flow stability even when hidden/animating */
  pointer-events: none;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-content.faded {
  opacity: 0;
  pointer-events: none;
  visibility: hidden;
  transform: translateY(-10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

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

/* Custom Scrollbar */
.sidebar::-webkit-scrollbar { 
  width: 6px; 
}

.sidebar::-webkit-scrollbar-track { 
  background: rgba(0, 0, 0, 0.2); 
  border-radius: 4px; 
}

.sidebar::-webkit-scrollbar-thumb { 
  background: rgba(255,255,255,0.15); 
  border-radius: 4px; 
}

.sidebar::-webkit-scrollbar-thumb:hover { 
  background: rgba(255,255,255,0.25); 
}

.sidebar-content::-webkit-scrollbar { 
  width: 4px; 
}

.sidebar-content::-webkit-scrollbar-thumb { 
  background: rgba(255,255,255,0.1); 
  border-radius: 4px; 
}

/* Secciones */
.section-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #64748b;
  margin-bottom: 10px;
  font-weight: 700;
}

/* Inputs */
.search-section {
  margin-bottom: 5px;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.input-wrapper i {
  position: absolute;
  left: 12px;
  color: #64748b;
  font-size: 14px;
  z-index: 2;
}

.search-input {
  width: 100%;
  padding: 12px 12px 12px 36px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
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

/* Filter Chips */
.filter-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-chip {
  font-size: 13px;
  padding: 5px 10px;
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

.filter-chip:hover:not(.disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(192, 132, 252, 0.4);
  color: #fff;
}

.filter-chip.active {
  background: rgba(167, 139, 250, 0.2);
  border-color: #a78bfa;
  color: #fff;
}

.filter-chip.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Divider */
.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.05);
  margin: 20px 0;
}

/* Botón principal */
.action-btn {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: none;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.action-btn.primary {
  background: linear-gradient(135deg, #8b5cf6, #7c3aed);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  text-transform: uppercase;
  letter-spacing: 1px;
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

.action-btn.primary:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Botón de cerrar en móvil */
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

/* === ESTILOS MÓVIL - TRANSICIÓN LIMPIA === */
@media (max-width: 768px) {
  .sidebar-container {
    position: fixed;
    top: 0;
    left: 0;
    margin-left: 0;
    height: 100vh;
    max-height: 100vh;
    width: 280px;
    z-index: 1000;
    transform: translateX(-100%);
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    opacity: 1 !important;
  }
  
  .sidebar-container:not(.is-collapsed) {
    transform: translateX(0);
    box-shadow: 15px 0 40px rgba(0,0,0,0.3);
    transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                box-shadow 0.3s ease 0.1s;
  }
  
  .sidebar-container.is-collapsed {
    transform: translateX(-100%);
    box-shadow: none;
    transition: transform 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53);
    width: 280px !important;
    height: 100vh !important;
    min-height: 100vh !important;
    max-height: 100vh !important;
    padding: 0 !important;
    overflow: visible !important;
    border: none !important;
    background: transparent !important;
  }
  
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
  
  .sidebar-content {
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transform: none !important;
    transition: none !important;
    height: calc(100% - 60px);
    max-height: none !important;
    padding: 20px !important;
    padding-bottom: max(20px, env(safe-area-inset-bottom)) !important;
    display: flex !important;
    flex-direction: column !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
  }
  
  .sidebar-content.faded {
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: auto !important;
    transform: none !important;
    transition: none !important;
  }
  
  .sidebar-container.is-collapsed .sidebar-content {
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: none !important;
    max-height: none !important;
    padding: 20px !important;
    margin: 0 !important;
    overflow: hidden !important;
    transition: none !important;
  }
  
  .title {
    opacity: 1 !important;
    transition: none !important;
  }
  
  .mobile-close-btn {
    display: flex;
  }
  
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

/* Para desktop */
@media (min-width: 769px) {
  .sidebar-container {
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

/* Clases de utilidad */
.mt-2 { margin-top: 8px; }
</style>
