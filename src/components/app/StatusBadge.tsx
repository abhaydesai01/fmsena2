import { cn } from "@/lib/utils";
const map: Record<string, string> = {
  paid: "bg-success/15 text-success",
  due: "bg-muted text-foreground",
  partial: "bg-info/15 text-info",
  overdue: "bg-destructive/15 text-destructive",
  active: "bg-success/15 text-success",
  full: "bg-warning/20 text-warning-foreground",
  closed: "bg-muted text-muted-foreground",
  cleared: "bg-success/15 text-success",
  pending: "bg-warning/20 text-warning-foreground",
  bounced: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground line-through",
  discontinued: "bg-destructive/15 text-destructive",
  completed: "bg-info/15 text-info",
};
export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize", map[status] || "bg-muted text-foreground")}>
      {status.replace("_", " ")}
    </span>
  );
}
