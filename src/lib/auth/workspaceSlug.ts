/**
 * onboarding: the remembered workspace slug for sign-in. Same key the
 * session writes on login (`saas.tenantSlug`); falls back to memory when
 * localStorage is unavailable (private mode, blocked storage).
 */
const KEY = "saas.tenantSlug";
let memory: string | null = null;

export function getRememberedWorkspace(): string | null {
  try {
    if (typeof window !== "undefined") return window.localStorage.getItem(KEY) ?? memory;
  } catch {
    /* storage blocked: use the in-memory copy */
  }
  return memory;
}

export function rememberWorkspace(slug: string) {
  memory = slug;
  try {
    window.localStorage.setItem(KEY, slug);
  } catch {
    /* ignore */
  }
}

export function forgetWorkspace() {
  memory = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
