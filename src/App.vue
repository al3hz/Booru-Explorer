<template>
  <div id="app" class="app-container">
    <SearchHeader @logo-click="handleLogoClick" />
    
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" :key="viewKey" />
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
      refreshKey: 0
    };
  },
  computed: {
    viewKey() {
      return this.$route.fullPath + '-' + this.refreshKey;
    }
  },
  methods: {
    handleLogoClick() {
      // Si ya estamos en el home sin queries, forzamos recarga
      if (this.$route.path === '/' && Object.keys(this.$route.query).length === 0) {
        this.refreshKey++;
      }
    }
  }
};
</script>

<style>
/* Page transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

<style src="./styles/global.css"></style>
