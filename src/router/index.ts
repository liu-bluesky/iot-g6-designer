import type { App } from 'vue';
import { createRouter, createWebHashHistory } from 'vue-router';

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'iot-designer',
      meta: {
        title: '物联网图纸设计器',
      },
      component: () => import('@/view/index.vue'),
    },
  ],
});

export function setupRouter(app: App<Element>) {
  app.use(router);
}

export default router;
