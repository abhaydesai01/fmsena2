export type DiscountType = "none" | "round_off" | "special" | "slab_10" | "slab_15" | "slab_20";
export const SLAB_PCT: Record<string, number> = { slab_10: 10, slab_15: 15, slab_20: 20 };

// New fixed-month instalment plans (replaces old 3/4 split logic for new enrollments).
export type PlanKind = "plan_3" | "plan_4" | "plan_5";
export type LateJoinerMode =
  | "original"
  | "remaining_only"
  | "catchup_now"
  | "start_from_admission_month";

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

export const STANDARD_INSTALLMENT_OFFSETS = [0, 60, 120, 150, 180] as const;

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
  grossFee: number;
  discountType: DiscountType;
  roundedAmount?: number;
  specialAmount?: number;
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

export type InstallmentScheduleRow = {
  installment_no: number;
  month_label: string;
  due_date: string;
};

export function buildJoiningDateSchedule(opts: {
  joiningDate: string;
  count: number;
}): InstallmentScheduleRow[] {
  const start = new Date(opts.joiningDate);
  const offsets = STANDARD_INSTALLMENT_OFFSETS.slice(0, Math.max(1, Math.min(opts.count, 5)));
  return offsets.map((days, idx) => {
    const due = new Date(start);
    due.setDate(due.getDate() + days);
    return {
      installment_no: idx + 1,
      month_label: `Installment ${idx + 1}`,
      due_date: due.toISOString().slice(0, 10),
    };
  });
}

function monthGapPattern(plan: PlanKind): number[] {
  const months = PLAN_MONTHS[plan].map((m) => m.month);
  const gaps: number[] = [];
  for (let i = 1; i < months.length; i++) gaps.push(months[i] - months[i - 1]);
  return gaps;
}

function monthLabelForDate(date: Date): string {
  const month = date.toLocaleString("en-IN", { month: "short" });
  const year = date.getFullYear();
  return `${month} ${year}`;
}

export function buildInstallmentSchedule(opts: {
  plan: PlanKind;
  planYear: number;
  dueDay: number;
  admissionDate: string;
  mode: LateJoinerMode;
}): { schedule: InstallmentScheduleRow[]; missedCount: number } {
  const admissionIso = new Date(opts.admissionDate || new Date().toISOString().slice(0, 10))
    .toISOString()
    .slice(0, 10);

  const base = PLAN_MONTHS[opts.plan].map((m) => {
    const due = new Date(opts.planYear, m.month, opts.dueDay).toISOString().slice(0, 10);
    return { month_label: m.label, due_date: due };
  });
  const missed = base.filter((r) => r.due_date < admissionIso);
  const remaining = base.filter((r) => r.due_date >= admissionIso);

  if (opts.mode === "start_from_admission_month") {
    const count = PLAN_MONTHS[opts.plan].length;
    const gaps = monthGapPattern(opts.plan);
    const admissionDate = new Date(admissionIso);
    const first = new Date(admissionDate);
    const out: InstallmentScheduleRow[] = [
      {
        installment_no: 1,
        month_label: `Join Month (${monthLabelForDate(first)})`,
        due_date: first.toISOString().slice(0, 10),
      },
    ];
    let cursor = new Date(first.getFullYear(), first.getMonth(), opts.dueDay);
    for (let i = 1; i < count; i++) {
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + (gaps[i - 1] ?? 1), opts.dueDay);
      out.push({
        installment_no: i + 1,
        month_label: monthLabelForDate(cursor),
        due_date: cursor.toISOString().slice(0, 10),
      });
    }
    return { schedule: out, missedCount: missed.length };
  }

  let rows: Array<{ month_label: string; due_date: string }> = [];
  if (opts.mode === "original") {
    rows = base;
  } else if (opts.mode === "remaining_only") {
    rows = remaining.length > 0 ? remaining : [{ month_label: "At Admission", due_date: admissionIso }];
  } else {
    const out: Array<{ month_label: string; due_date: string }> = [];
    if (missed.length > 0) {
      out.push({
        month_label: `Catch-up (${missed.map((m) => m.month_label).join(" + ")})`,
        due_date: admissionIso,
      });
    }
    out.push(...remaining);
    rows = out.length > 0 ? out : [{ month_label: "At Admission", due_date: admissionIso }];
  }

  return {
    schedule: rows.map((r, i) => ({ ...r, installment_no: i + 1 })),
    missedCount: missed.length,
  };
}
