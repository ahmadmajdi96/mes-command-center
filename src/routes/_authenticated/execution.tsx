import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/execution")({
  beforeLoad: () => {
    throw redirect({ to: "/mobile", replace: true });
  },
});
