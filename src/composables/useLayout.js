import { ref } from 'vue';

// Singleton state - default to visible on desktop, hidden on mobile
const isSidebarVisible = ref(typeof window !== 'undefined' ? window.innerWidth > 768 : true);

export function useLayout() {
  const toggleSidebar = () => {
    isSidebarVisible.value = !isSidebarVisible.value;
  };

  const setSidebarVisible = (value) => {
    isSidebarVisible.value = value;
  };

  return {
    isSidebarVisible,
    toggleSidebar,
    setSidebarVisible
  };
}
