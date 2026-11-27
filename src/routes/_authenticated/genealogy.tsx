import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/genealogy")({
  beforeLoad: () => {
    throw redirect({ to: "/recall", replace: true });
  },
});
