export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: "At least 10 characters", test: (p) => p.length >= 10 },
  { label: "An upper-case letter", test: (p) => /[A-Z]/.test(p) },
  { label: "A lower-case letter", test: (p) => /[a-z]/.test(p) },
  { label: "A number", test: (p) => /\d/.test(p) },
  { label: "A symbol (like # or !)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];
export const passwordOk = (p: string) => PASSWORD_RULES.every((r) => r.test(p));
