import { useAuthStore } from "@/app/stores/auth";

export function bootstrapAuthFromHash() {
  const hash = window.location.hash;
  if (!hash.startsWith("#t=")) return;
  const token = hash.slice(3);
  if (!token) return;
  useAuthStore.getState().setToken(token);
  history.replaceState(null, "", window.location.pathname + window.location.search);
}

export function startLogin() {
  window.location.href = "/api/auth/login";
}

export function logout() {
  useAuthStore.getState().clear();
  window.location.href = "/login";
}
