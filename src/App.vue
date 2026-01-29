<template>
  <div id="app" class="app-container">
    <SearchHeader @logo-click="handleLogoClick" />

    <router-view v-slot="{ Component, route }">
      <transition :name="route.meta.transition || 'fade'" mode="out-in">
        <!-- 
          keep-alive solo para rutas que lo especifiquen en meta.keepAlive
          La key incluye el path y refreshKey para forzar recarga cuando sea necesario
        -->
        <keep-alive v-if="route.meta.keepAlive">
          <component :is="Component" :key="`${route.path}-${refreshKey}`" />
        </keep-alive>
        <component
          :is="Component"
          :key="`${route.path}-${refreshKey}`"
          v-else
        />
      </transition>
    </router-view>

    <AppFooter />
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useQueryClient } from "@tanstack/vue-query";
import SearchHeader from "./components/SearchHeader.vue";
import AppFooter from "./components/AppFooter.vue";
import "./styles/global.css";

// ==========================================
// ROUTER & QUERY CLIENT
// ==========================================
const route = useRoute();
const router = useRouter();
const queryClient = useQueryClient();

// Key para forzar re-render de componentes cuando se hace click en logo
const refreshKey = ref(0);

// ==========================================
// NAVEGACIÓN Y REFRESH
// ==========================================
const handleLogoClick = async () => {
  const isHome = route.path === "/";
  const hasNoQuery = Object.keys(route.query).length === 0;

  if (isHome && hasNoQuery) {
    // Estamos en home limpio: invalidar queries y forzar re-render
    refreshKey.value++;

    // Invalidar todas las queries de posts para refrescar datos
    await queryClient.invalidateQueries({
      queryKey: ["posts"],
      refetchType: "active",
    });

    // Scroll al top suave
    window.scrollTo({ top: 0, behavior: "smooth" });

    console.log("[App] Home refreshed");
  } else {
    // Navegar a home limpio
    await router.push({ path: "/", query: {} });
  }
};

// ==========================================
// SCROLL TO HASH (Anclas en URL)
// ==========================================
watch(
  () => route.hash,
  (newHash) => {
    if (newHash) {
      nextTick(() => {
        // Esperar a que termine la transición de ruta
        setTimeout(() => {
          const element = document.querySelector(newHash);
          if (element) {
            element.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }, 350); // Delay ligeramente mayor que la duración de la transición CSS
      });
    }
  },
  { immediate: true },
);

// ==========================================
// MANEJO GLOBAL DE ERRORES NO CAPTURADOS
// ==========================================
window.addEventListener("unhandledrejection", (event) => {
  console.error("[Unhandled Promise Rejection]", event.reason);
  // Prevenir que Vue Query mute el error
  event.preventDefault();
});
</script>

<style>
/* ==========================================
   TRANSICIONES DE RUTA
   ========================================== */
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

/* Slide horizontal */
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

/* Slide vertical (útil para modales/mobile) */
.slide-up-enter-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 1, 1);
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* ==========================================
   LAYOUT BASE
   ========================================== */
.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  /* Prevenir scroll horizontal accidental durante transiciones */
  overflow-x: hidden;
}

/* El contenido principal ocupa todo el espacio disponible */
.app-container > main,
.app-container > .router-view-wrapper,
.app-container > :nth-child(2) {
  flex: 1;
  width: 100%;
}

/* Header y footer no se encogen */
.app-container > header,
.app-container > footer,
.app-container > :first-child,
.app-container > :last-child {
  flex-shrink: 0;
}

/* Mejorar rendimiento de animaciones */
[class*="-enter-active"],
[class*="-leave-active"] {
  will-change: opacity, transform;
  pointer-events: none; /* Prevenir clicks durante transición */
}
</style>
