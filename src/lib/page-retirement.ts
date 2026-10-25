/** UI-only retirement: data, permissions, API routes and shared services remain active. */
export const RETIRED_PAGE_ROOTS = [
  "products", "recipes", "production-orders", "planner", "scheduling", "reports", "inventory",
  "users", "assignments", "skills", "shifts",
] as const;

/** Stored alerts can outlive their destination screens. Do not expose stale navigation. */
export function activeNotificationLink(link: string | null): string | null {
  if (!link) return null;
  const pathname = link.split(/[?#]/, 1)[0];
  const root = pathname.split("/")[1];
  if (RETIRED_PAGE_ROOTS.some((page) => page === root)) return null;
  if (/^\/record\/(assignment|stock|receipt)(\/|$)/.test(pathname)) return null;
  return link;
}