import { useEffect, useRef } from "react";
import bwipjs from "bwip-js/browser";

export function DataMatrix({ text, scale = 4, className }: { text: string; scale?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      bwipjs.toCanvas(ref.current, {
        bcid: "datamatrix",
        text,
        scale,
        includetext: false,
        backgroundcolor: "FFFFFF",
        paddingwidth: 6,
        paddingheight: 6,
      });
    } catch (e) {
      // Ignore render errors on very short strings
      console.warn("datamatrix render failed", e);
    }
  }, [text, scale]);
  return <canvas ref={ref} className={className} aria-label={`DataMatrix ${text}`} />;
}
