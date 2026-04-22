import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Hammer } from "lucide-react";

export const Route = createFileRoute("/_auth/audit")({ component: Page });

function Page() {
  return (
    <div>
      <PageHeader title="Audit Trail" description="Append-only log of every action with actor, timestamp, and reason." />
      <EmptyState
        icon={Hammer}
        title="Module coming online"
        description="This module is part of the ENA Fees Management scope and will be completed in the next iteration. The database schema, business rules, and access policies are already provisioned."
      />
    </div>
  );
}
