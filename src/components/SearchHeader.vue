<template>
  <header class="app-header" :class="{ 'header-hidden': isHeaderHidden }">
    <div class="header-inner">
      <div class="header-left">
        <!-- Sidebar Toggle Button (Far Left) -->
        <button 
          class="toggle-menu-btn" 
          @click.stop="toggleSidebar"
          :title="isSidebarVisible ? 'Hide filters' : 'Show filters'"
        >
          <i :class="isSidebarVisible ? 'lni lni-chevron-left' : 'lni lni-menu'"></i>
        </button>

        <div class="brand-section">
          <div class="logo-container" @click="handleLogoClick">
            <img 
              src="https://danbooru.donmai.us/packs/static/danbooru-logo-128x128-ea111b6658173e847734.png" 
              alt="Danbooru Logo" 
              class="logo-icon"
            />
            <div class="logo-glow"></div>
          </div>
          <div class="brand-text">
            <h1>Booru Explorer</h1>
            <div class="badge-container">
              <span class="version-badge">v1.2</span>
              <span class="author-badge">Made by Overlain</span>
            </div>
          </div>
        </div>
      </div>

      <nav class="header-nav">
        <router-link to="/" class="nav-item" active-class="active">
          <i class="lni lni-home"></i>
          <span>Posts</span>
        </router-link>
        <router-link to="/comments" class="nav-item" active-class="active">
          <i class="lni lni-comments"></i>
          <span>Comments</span>
        </router-link>
        <router-link to="/wiki/danbooru" class="nav-item" active-class="active">
          <i class="lni lni-library"></i>
          <span>Wiki</span>
        </router-link>

      </nav>
    </div>
    <div class="header-border"></div>
  </header>
</template>

<script>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useLayout } from '../composables/useLayout';

export default {
  name: "SearchHeader",
  emits: ['logo-click'],
  setup(props, { emit }) {
    const router = useRouter();
    const { isSidebarVisible, toggleSidebar } = useLayout();
    const isHeaderHidden = ref(false);
    let lastScrollY = typeof window !== 'undefined' ? window.pageYOffset : 0;

    const handleScroll = () => {
      // Solo en móviles/tablets (<= 768px)
      if (window.innerWidth > 768) {
        if (isHeaderHidden.value) isHeaderHidden.value = false;
        return;
      }
      
      const currentScrollY = window.pageYOffset;
      
      // Ignorar rebotes en iOS
      if (currentScrollY < 0) return;

      // Tolerancia pequeña para evitar parpadeos
      if (Math.abs(currentScrollY - lastScrollY) < 5) return;

      // Si estamos muy arriba, siempre mostrar
      if (currentScrollY < 50) {
        isHeaderHidden.value = false;
      } else {
        // Ocultar si bajamos, mostrar si subimos
        isHeaderHidden.value = currentScrollY > lastScrollY;
      }
      
      lastScrollY = currentScrollY;
    };

    onMounted(() => {
      window.addEventListener('scroll', handleScroll, { passive: true });
    });

    onUnmounted(() => {
      window.removeEventListener('scroll', handleScroll);
    });

    const handleLogoClick = () => {
      emit('logo-click');
      router.push('/');
    };

    return {
      handleLogoClick,
      isSidebarVisible,
      toggleSidebar,
      isHeaderHidden
    };
  }
};
</script>

<style scoped>
.app-header {
  position: relative;
  background: rgba(20, 20, 28, 0.4);
  margin-bottom: 40px;
  z-index: 100;
  transition: all 0.3s ease;
}

@media (max-width: 768px) {
  .app-header {
    position: sticky;
    top: -1px;
    z-index: 500;
    background: rgba(20, 20, 28, 0.7);
    backdrop-filter: blur(12px);
    margin-bottom: 24px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), 
                opacity 0.3s ease;
  }
}

.header-hidden {
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
}

@keyframes headerSlideDown {
  0% {
    opacity: 0;
    transform: translateY(-50px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes popIn {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes fadeInRight {
  0% {
    opacity: 0;
    transform: translateX(-20px);
  }
  100% {
    opacity: 1;
    transform: translateX(0);
  }
}

.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  max-width: 1600px;
  margin: 0 auto;
  animation: headerSlideDown 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}

.header-border {
  height: 1px;
  width: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(167, 139, 250, 0.5) 50%,
    transparent 100%
  );
  box-shadow: 0 0 10px rgba(167, 139, 250, 0.3);
}

.header-left {
  display: flex;
  align-items: center;
}

.brand-section {
  display: flex;
  align-items: center;
  gap: 16px;
  animation: fadeInRight 0.5s ease 0.2s backwards;
}

.logo-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s backwards;
}

.toggle-menu-btn {
  background: rgba(167, 139, 250, 0.1);
  border: 1px solid rgba(167, 139, 250, 0.2);
  color: #a78bfa;
  width: 44px; /* Slightly larger for the far-left position */
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 20px;
  margin-right: 20px;
  flex-shrink: 0;
  z-index: 100;
}

.toggle-menu-btn:hover {
  background: rgba(167, 139, 250, 0.2);
  border-color: rgba(167, 139, 250, 0.4);
  transform: scale(1.05);
  box-shadow: 0 0 15px rgba(167, 139, 250, 0.15);
}

.logo-icon {
  width: 32px;
  height: 32px;
  z-index: 2;
  object-fit: contain;
  cursor: pointer;
}

.logo-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background: radial-gradient(circle, rgba(167, 139, 250, 0.4) 0%, transparent 70%);
  filter: blur(5px);
  z-index: 1;
}

.brand-text h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.5px;
  background: linear-gradient(to right, #ffffff, #e2e8f0);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.badge-container {
  display: flex;
  align-items: center;
  margin-top: 2px;
}

.version-badge {
  font-size: 10px;
  padding: 2px 8px;
  background: linear-gradient(90deg, rgba(167, 139, 250, 0.1), rgba(192, 132, 252, 0.1));
  border: 1px solid rgba(167, 139, 250, 0.2);
  color: #c084fc;
  border-radius: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.author-badge {
  font-size: 10px;
  padding: 2px 8px;
  background: linear-gradient(90deg, rgba(167, 139, 250, 0.2), rgba(192, 132, 252, 0.2));
  border: 1px solid rgba(167, 139, 250, 0.3);
  color: #e2e8f0;
  border-radius: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  margin-left: 8px;
  transition: all 0.3s ease;
}

.author-badge:hover {
  background: linear-gradient(90deg, rgba(167, 139, 250, 0.3), rgba(192, 132, 252, 0.3));
  border-color: rgba(167, 139, 250, 0.5);
  box-shadow: 0 0 10px rgba(167, 139, 250, 0.2);
  color: #fff;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 30px;
  transition: all 0.3s ease;
  cursor: pointer;
  text-decoration: none;
  color: #cbd5e1;
  font-size: 14px;
  font-weight: 500;
  animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}

.nav-item:nth-child(1) { animation-delay: 0.2s; }
.nav-item:nth-child(2) { animation-delay: 0.3s; }
.nav-item:nth-child(3) { animation-delay: 0.4s; }

.nav-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(167, 139, 250, 0.2);
  transform: translateY(-1px);
  color: #fff;
}

.nav-item.active {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.3);
  color: #fff;
}

.nav-item i {
  font-size: 16px;
  color: #a78bfa;
}



.lang-code-mobile {
  display: none;
}

@media (max-width: 768px) {
  .header-inner {
    padding: 12px 16px;
    display: grid;
    grid-template-columns: auto 1fr; /* Toggle on left, Nav takes rest */
    grid-template-areas: 
      "brand brand"
      "toggle nav";
    gap: 16px;
    align-items: center;
  }
  
  .toggle-menu-btn {
    grid-area: toggle;
    margin-right: 0; /* Let grid gap handle it */
    width: 36px;
    height: 36px;
  }

  .header-nav {
    grid-area: nav;
    justify-content: center; /* Center nav items in their space */
    width: 100%;
    margin-left: 0;
  }
  
  .header-left {
    display: contents; /* Allows children to participate in parent grid directly */
  }

  .brand-section {
    grid-area: brand;
    width: 100%;
    justify-content: center;
    gap: 10px;
  }

  .brand-text {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .brand-text h1 {
    font-size: 18px; /* Slightly smaller to fit in a row */
  }
  
  .badge-container {
    margin-top: 0;
    gap: 0;
  }

  .author-badge {
    display: none; /* Hide author badge on mobile to save space */
  }

  .header-nav {
    width: 100%;
    justify-content: center;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px; /* Space for scrollbar if needed */
  }

  .nav-item {
    font-size: 13px;
    padding: 6px 12px;
    white-space: nowrap;
  }
  
  .lang-label {
    display: none;
  }
  
  .lang-trigger {
    padding: 8px;
    min-width: auto;
    gap: 4px;
  }

  .lang-code-mobile {
    display: block;
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 11px;
    letter-spacing: 0.5px;
    background: rgba(255, 255, 255, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
    color: #e2e8f0;
  }

  .chevron {
    display: none;
  }
}

/* Language Dropdown Styles */
.header-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lang-dropdown-container {
  position: relative;
}

.lang-trigger {
  color: #c084fc;
  font-weight: 600;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
  justify-content: space-between;
}



.lang-trigger.active {
  background: rgba(167, 139, 250, 0.15);
  border-color: rgba(167, 139, 250, 0.4);
}

.chevron {
  font-size: 10px;
  opacity: 0.7;
}

.lang-dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 8px;
  width: 160px;
  background: rgba(30, 30, 40, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(167, 139, 250, 0.2);
  border-radius: 12px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 1000;
  box-shadow: 0 10px 40px rgba(0,0,0,0.5);
  transform-origin: top right;
}

.lang-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  color: #cbd5e1;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.lang-option:hover {
  background: rgba(167, 139, 250, 0.15);
  color: #fff;
}

.lang-option.active {
  background: rgba(167, 139, 250, 0.25);
  color: #a78bfa;
  font-weight: 600;
}

.flag {
  font-size: 16px;
}

.check {
  margin-left: auto;
  font-size: 12px;
  color: #a78bfa;
}

/* Transitions */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.2s ease;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
</style>
