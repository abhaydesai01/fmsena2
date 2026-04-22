import type { Database } from "@/integrations/supabase/types";
export type DiscountType = Database["public"]["Enums"]["discount_type"];
export const SLAB_PCT: Record<string, number> = { slab_10: 10, slab_15: 15, slab_20: 20 };
export function calculateNetPayable(opts: {
  grossFee: number; discountType: DiscountType;
  roundedAmount?: number; specialAmount?: number;
}): { netPayable: number; discountAmount: number; installmentCount: 3 | 4 } {
  const gross = Number(opts.grossFee || 0);
  if (opts.discountType === "round_off") {
    const net = Number(opts.roundedAmount ?? gross);
    return { netPayable: net, discountAmount: Math.max(0, gross - net), installmentCount: 3 };
  }
  if (opts.discountType === "special") {
    const disc = Number(opts.specialAmount ?? 0);
    return { netPayable: Math.max(0, gross - disc), discountAmount: disc, installmentCount: 4 };
  }
  const pct = SLAB_PCT[opts.discountType] || 0;
  const disc = Math.round((gross * pct) / 100);
  return { netPayable: gross - disc, discountAmount: disc, installmentCount: 3 };
}
export function splitInstallments(net: number, count: 3 | 4): number[] {
  const base = Math.floor(net / count);
  const rem = net - base * count;
  const arr = Array(count).fill(base);
  arr[count - 1] += rem;
  return arr;
}
export function defaultDueDates(admissionDate: Date, count: 3 | 4): Date[] {
  const offsets = count === 3 ? [0, 4, 8] : [0, 3, 6, 10];
  return offsets.map((m, i) => {
    const d = new Date(admissionDate);
    d.setMonth(d.getMonth() + m);
    if (i === 0) d.setDate(d.getDate() + 7);
    return d;
  });
}
