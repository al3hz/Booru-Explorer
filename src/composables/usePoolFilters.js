import { ref } from 'vue';

// Global state singleton with persistence
const savedState = localStorage.getItem('pool_filters_visible');
const filtersVisible = ref(savedState === 'true');

export function usePoolFilters() {
  const toggleFilters = () => {
    filtersVisible.value = !filtersVisible.value;
    localStorage.setItem('pool_filters_visible', filtersVisible.value);
  };

  return {
    filtersVisible,
    toggleFilters
  };
}
