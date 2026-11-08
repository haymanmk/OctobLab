export interface ChartColors { fg: string; muted: string; line: string; accent: string; surface: string; ok: string }
export function readColors(el: Element): ChartColors {
  const cs = getComputedStyle(el);
  const v = (n: string, f: string) => cs.getPropertyValue(n).trim() || f;
  return { fg: v('--fg', '#1a1e27'), muted: v('--muted', '#5d6476'), line: v('--line', '#d5d9e2'), accent: v('--accent', '#2b4bd3'), surface: v('--surface', '#fff'), ok: v('--ok', '#1f7a4d') };
}
