import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    // If there's a saved position (browser back/forward), use it
    if (savedPosition) {
      return savedPosition;
    }
    // If navigating to a hash anchor, scroll to it
    if (to.hash) {
      return { el: to.hash, behavior: 'smooth' };
    }
    // Otherwise, scroll to top
    return { top: 0, behavior: 'smooth' };
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
      meta: { title: 'Booru Explorer | Anime Image Board' }
    },
    {
      path: '/comments',
      name: 'comments',
      component: () => import('../views/CommentsView.vue'),
      meta: { title: 'Comments | Booru Explorer' }
    },
    {
      path: '/wiki/:query',
      name: 'wiki',
      component: () => import('../views/WikiView.vue'),
      meta: { title: 'Wiki | Booru Explorer' }
    },
    {
      path: '/pools',
      name: 'pools',
      component: () => import('../views/PoolsView.vue'),
      meta: { title: 'Pools | Booru Explorer' }
    },
    {
      path: '/pools/:id',
      name: 'pool-detail',
      component: () => import('../views/PoolDetailView.vue'),
      meta: { title: 'Pool | Booru Explorer' }
    }
  ]
})

router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title;
  }
});

export default router
