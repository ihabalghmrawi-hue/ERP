import { DashboardKPIs } from "@/components/dashboard-kpis";
import { FollowUpsList } from "@/components/followups-list";
import { CustomerCard } from "@/components/customer-card";
import { customers } from "@/lib/mock-db";

export default function CRMHomePage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">AI CRM Dashboard</h1>
        <DashboardKPIs />
        <FollowUpsList />

        <section>
          <h2 className="mb-3 text-lg font-semibold">Customers</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {customers.map((customer) => (
              <CustomerCard key={customer.id} customer={customer} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
