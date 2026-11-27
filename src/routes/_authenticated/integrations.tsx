import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/integrations")({
  beforeLoad: () => {
    throw redirect({ to: "/integration-health", search: { view: "connections" }, replace: true });
  },
});
