import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/telemetry")({
  beforeLoad: () => {
    throw redirect({ to: "/", hash: "telemetry", replace: true });
  },
});
