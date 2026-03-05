import { createRouter, createWebHistory } from "vue-router";
import { manager } from "./auth";
import LoginPage from "./pages/LoginPage.vue";
import DashboardPage from "./pages/DashboardPage.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/login", component: LoginPage },
    { path: "/dashboard", component: DashboardPage, meta: { requiresAuth: true } },
    { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
  ],
});

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !manager.isAuthenticated()) {
    return "/login";
  }
});

manager.onAuthChange((state) => {
  if (!state.isAuthenticated && router.currentRoute.value.meta.requiresAuth) {
    router.push("/login");
  }
});

export default router;
