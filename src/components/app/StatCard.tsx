import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ElementType, ReactNode } from "react";

export function StatCard({
  label, value, hint, icon: Icon, tone = "default",
}: {
  label: string; value: ReactNode; hint?: string; icon?: ElementType;
  tone?: "default" | "success" | "warning" | "destructive" | "info";
}) {
  const toneCls: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    destructive: "bg-destructive/15 text-destructive",
    info: "bg-info/15 text-info",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-bold text-foreground [font-variant-numeric:tabular-nums]">
              {value}
            </div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
          </div>
          {Icon && (
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", toneCls[tone])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}