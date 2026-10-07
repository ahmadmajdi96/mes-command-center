import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { ghost } from "@/components/qp-ui";

const KEY = "mes-floor-mode";

/** Large-text, high-contrast mode for shop-floor screens viewed from a distance. */
export function FloorModeToggle() {
  const [on, setOn] = useState(() => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } });
  useEffect(() => {
    document.documentElement.classList.toggle("floor-mode", on);
    try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* ignore */ }
    return () => document.documentElement.classList.remove("floor-mode");
  }, [on]);
  return (
    <button className={ghost + " flex items-center gap-1.5"} onClick={() => setOn(!on)} title="Large text for viewing from a distance">
      {on ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
      {on ? "Normal size" : "Floor mode"}
    </button>
  );
}
