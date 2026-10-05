import { useEffect, useState } from "react";

/**
 * Number box that keeps what the user typed (so "12." or "0.0" can be typed
 * on the way to "12.5" / "0.05"), blocks minus/exponent keys and reports the
 * parsed value (undefined when empty).
 */
export function DecimalInput({
  value, onValue, className, ...rest
}: {
  value: number | undefined | null | "";
  onValue: (v: number | undefined) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [text, setText] = useState(value == null || value === "" ? "" : String(value));
  useEffect(() => {
    const cur = text === "" ? undefined : Number(text);
    const next = value == null || value === "" ? undefined : Number(value);
    if (cur !== next) setText(next == null ? "" : String(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      className={className}
      value={text}
      onKeyDown={(e) => { if (["-", "e", "E", "+"].includes(e.key)) e.preventDefault(); rest.onKeyDown?.(e); }}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        if (t !== "" && !/^\d*\.?\d*$/.test(t)) return;
        setText(t);
        onValue(t === "" || t === "." ? undefined : Number(t));
      }}
    />
  );
}
