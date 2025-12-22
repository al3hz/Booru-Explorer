import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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
    }
  ]
})

router.afterEach((to) => {
  if (to.meta.title) {
    document.title = to.meta.title;
  }
});

export default router
