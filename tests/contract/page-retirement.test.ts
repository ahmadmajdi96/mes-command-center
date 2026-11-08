import { describe, expect, it } from "vitest";
import { activeNotificationLink, RETIRED_PAGE_ROOTS, RETIRED_RECORD_KINDS } from "../../src/lib/page-retirement";
import { KINDS } from "../../src/lib/record-kinds";
import { existsSync } from "node:fs";

describe("Retired UI pages", () => {
  it.each(RETIRED_PAGE_ROOTS)("does not navigate to retired %s alerts", (root) => {
    expect(activeNotificationLink(`/${root}`)).toBeNull();
    expect(activeNotificationLink(`/${root}/example?tab=details#record`)).toBeNull();
    for (const suffix of [".tsx", ".index.tsx"]) {
      expect(existsSync(`src/routes/_authenticated/${root}${suffix}`)).toBe(false);
    }
  });
  it("keeps retained execution and trace destinations", () => {
    for (const path of ["/work-orders/WO-1", "/record/trace/PO-1", "/material-lots/LOT-1", "/profile", "/stations/ST-1"]) {
      expect(activeNotificationLink(path)).toBe(path);
    }
    expect(activeNotificationLink("/users-extra")).toBe("/users-extra");
  });
  it("retires generic workforce and inventory screens without removing order evidence", () => {
    for (const kind of RETIRED_RECORD_KINDS) {
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
  it.each(["execution", "mobile", "hmi", "operator", "step-templates"])("removes %s UI routes including station subpages", (root) => {
    expect(activeNotificationLink(`/${root}/ST-1`)).toBeNull();
    expect(existsSync(`src/routes/_authenticated/${root}.$stationId.tsx`)).toBe(false);
  });
  it("keeps runtime, template and offline execution dependencies available", () => {
    for (const file of ["src/lib/offline-queue.ts", "src/lib/mes-data.ts", "src/lib/mes/execution.functions.ts", "src/components/operation-execution.tsx", "src/components/evidence-uploader.tsx"]) {
      expect(existsSync(file)).toBe(true);
    }
  });
  it("preserves authorization and ERP/portal services after retiring their management pages", () => {
    for (const file of ["src/lib/access.tsx", "src/lib/mes/authz.functions.ts", "src/lib/mes/auth.functions.ts", "src/lib/mes/erp.functions.ts", "src/lib/mes/erp-ingest.server.ts", "src/lib/mes/portals.functions.ts", "src/lib/mes/portals.server.ts", "src/routes/api/public/portals.$connectionId.ts", "src/routes/api/mes/v1/erp.$entity.ts"]) {
      expect(existsSync(file)).toBe(true);
    }
  });
});