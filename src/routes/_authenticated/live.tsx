import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/live")({
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "production-monitoring", replace: true });
  },
});
