import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** Link a list row to its detail page. */
export function RecLink({ kind, id, children, className }: { kind: string; id: string; children: ReactNode; className?: string }) {
  return (
    <Link to="/record/$kind/$id" params={{ kind, id: String(id) }} className={className ?? "text-primary hover:underline"}>
      {children}
    </Link>
  );
}
