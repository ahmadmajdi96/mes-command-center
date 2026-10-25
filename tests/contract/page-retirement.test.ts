import { describe, expect, it } from "vitest";
import { activeNotificationLink, RETIRED_PAGE_ROOTS } from "../../src/lib/page-retirement";
import { KINDS } from "../../src/lib/record-kinds";
import { existsSync } from "node:fs";

describe("Planning and Workforce page retirement", () => {
  it.each(RETIRED_PAGE_ROOTS)("does not navigate to retired %s alerts", (root) => {
    expect(activeNotificationLink(`/${root}`)).toBeNull();
    expect(activeNotificationLink(`/${root}/example?tab=details#record`)).toBeNull();
    for (const suffix of [".tsx", ".index.tsx"]) {
      expect(existsSync(`src/routes/_authenticated/${root}${suffix}`)).toBe(false);
    }
  });
  it("keeps retained execution and trace destinations", () => {
    for (const path of ["/work-orders/WO-1", "/record/trace/PO-1", "/material-lots/LOT-1", "/access", "/operator/ST-1"]) {
      expect(activeNotificationLink(path)).toBe(path);
    }
    expect(activeNotificationLink("/users-extra")).toBe("/users-extra");
  });
  it("retires generic workforce and inventory screens without removing order evidence", () => {
    for (const kind of ["assignment", "stock", "receipt"]) {
      expect(activeNotificationLink(`/record/${kind}/example`)).toBeNull();
      expect(KINDS[kind]).toBeUndefined();
    }
    expect(KINDS.trace.table).toBe("production_orders");
    expect(KINDS.trace.back).toBe("/traceability");
  });
  it("preserves shared PMS services", () => {
    for (const file of ["production-orders-db.ts", "products-db.ts", "batches-db.ts", "shifts-store.ts", "mes-store.tsx", "hmi-db.ts", "mes/orders.functions.ts", "mes/operations.functions.ts"]) {
      expect(existsSync(`src/lib/${file}`)).toBe(true);
    }
  });
});