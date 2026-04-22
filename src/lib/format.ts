export const inr = (n: number | string | null | undefined) => {
  const num = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num);
};

export const inrPlain = (n: number | string | null | undefined) => {
  const num = Number(n ?? 0);
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(num);
};

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const daysBetween = (a: Date | string, b: Date | string = new Date()) => {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.floor((d2.getTime() - d1.getTime()) / 86400000);
};

export const discountLabel = (t: string) => {
  switch (t) {
    case "round_off": return "Round-Off";
    case "slab_10": return "Slab 10%";
    case "slab_15": return "Slab 15%";
    case "slab_20": return "Slab 20%";
    case "special": return "Special";
    default: return t;
  }
};

export const modeLabel = (m: string) => ({
  cash: "Cash", upi: "UPI", cheque: "Cheque", dd: "DD", card: "Card",
}[m] || m);

export const exportCSV = (filename: string, rows: Record<string, unknown>[]) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};