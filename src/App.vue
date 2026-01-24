<template>
  <div id="app" class="app-container">
    <SearchHeader @logo-click="handleLogoClick" />

    <router-view v-slot="{ Component, route }">
      <transition
        :name="route.meta.transition || 'fade'"
        mode="out-in"
        @after-enter="scrollToHash"
      >
        <component :is="Component" :key="getRouteKey(route)" />
      </transition>
    </router-view>

    <AppFooter />
  </div>
</template>

<script>
import SearchHeader from "./components/SearchHeader.vue";
import AppFooter from "./components/AppFooter.vue";

export default {
  name: "App",
  components: {
    SearchHeader,
    AppFooter,
  },
  data() {
    return {
      refreshKey: 0,
    };
  },
  computed: {
    getRouteKey() {
      return (route) => {
        return `${route.path}#${this.refreshKey}`;
      };
    },
  },
  methods: {
    handleLogoClick() {
      // Preservar todos los query parameters actuales al navegar al home
      const currentQuery = { ...this.$route.query };

      // Solo refrescar si estamos en home Y no hay parámetros de búsqueda
      const isHomeWithNoQuery =
        this.$route.path === "/" && Object.keys(currentQuery).length === 0;

      if (isHomeWithNoQuery) {
        // Si estamos en home sin parámetros, refrescar
        this.refreshKey++;
      } else {
        // Si no estamos en home o tenemos parámetros, navegar a home preservando los parámetros
        this.$router.push({
          path: "/",
          query: currentQuery, // Preservar rating, tags, etc.
        });
      }
    },

    scrollToHash() {
      if (this.$route.hash) {
        setTimeout(() => {
          const element = document.querySelector(this.$route.hash);
          if (element) {
            element.scrollIntoView({ behavior: "smooth" });
          }
        }, 100);
      }
    },
  },

  mounted() {
    // Inicializar cualquier lógica necesaria
  },

  beforeUnmount() {
    // Cleanup si es necesario
  },
};
</script>

<style>
/* Transiciones mejoradas */
.fade-enter-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 1, 1);
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Transiciones adicionales que puedes usar en las rutas */
.slide-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Estructura básica mejorada */
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.app-container > *:not(router-view) {
  flex-shrink: 0;
}

.app-container > router-view {
  flex: 1;
}
</style>

<style src="./styles/global.css"></style>
