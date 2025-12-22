<template>
  <header class="app-header">
    <div class="header-inner">
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
import { useRouter } from 'vue-router';

export default {
  name: "SearchHeader",
  emits: ['logo-click'],
  setup(props, { emit }) {
    const router = useRouter();

    const handleLogoClick = () => {
      emit('logo-click');
      router.push('/');
    };

    return {
      handleLogoClick
    };
  }
};
</script>

<style scoped>
.app-header {
  position: relative; /* Static flow, but relative container */
  background: rgba(20, 20, 28, 0.4);
  margin-bottom: 40px; /* Increased from 24px to prevent collisions */
}

.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  max-width: 1600px;
  margin: 0 auto;
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

.brand-section {
  display: flex;
  align-items: center;
  gap: 16px;
}

.logo-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.logo-icon {
  width: 32px;
  height: 32px;
  z-index: 2;
  object-fit: contain;
}

.logo-glow {
  position: absolute;
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
}

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
    flex-direction: column;
    gap: 16px;
  }
  
  .brand-section {
    width: 100%;
    justify-content: center;
  }

  .brand-text {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .brand-text h1 {
    font-size: 20px;
  }
  
  .badge-container {
    justify-content: center;
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
