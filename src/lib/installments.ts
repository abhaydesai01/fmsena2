export type DiscountType = "none" | "round_off" | "special" | "slab_10" | "slab_15" | "slab_20";
export const SLAB_PCT: Record<string, number> = { slab_10: 10, slab_15: 15, slab_20: 20 };

// New fixed-month instalment plans (replaces old 3/4 split logic for new enrollments).
export type PlanKind = "plan_3" | "plan_4" | "plan_5";

// Months are 0-indexed (June = 5)
export const PLAN_MONTHS: Record<PlanKind, { label: string; month: number }[]> = {
  plan_3: [
    { label: "June", month: 5 },
    { label: "August", month: 7 },
    { label: "October", month: 9 },
  ],
  plan_4: [
    { label: "June", month: 5 },
    { label: "August", month: 7 },
    { label: "October", month: 9 },
    { label: "November", month: 10 },
  ],
  plan_5: [
    { label: "June", month: 5 },
    { label: "August", month: 7 },
    { label: "October", month: 9 },
    { label: "November", month: 10 },
    { label: "December", month: 11 },
  ],
};

export const PLAN_LABEL: Record<PlanKind, string> = {
  plan_3: "Plan 1 · 3 instalments",
  plan_4: "Plan 2 · 4 instalments",
  plan_5: "Plan 3 · 5 instalments",
};

export const PLAN_NEXT: Record<PlanKind, PlanKind | null> = {
  plan_3: "plan_4",
  plan_4: "plan_5",
  plan_5: null,
};

/** Generate due dates for a plan. dueDay defaults to the 5th. */
export function planDueDates(plan: PlanKind, year: number, dueDay = 5): Date[] {
  return PLAN_MONTHS[plan].map(({ month }) => new Date(year, month, dueDay));
}

/** Even-split helper for new plans (admin can edit per-instalment after). */
export function evenSplit(net: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(net / count);
  const rem = net - base * count;
  const arr = Array(count).fill(base);
  arr[count - 1] += rem;
  return arr;
}

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
