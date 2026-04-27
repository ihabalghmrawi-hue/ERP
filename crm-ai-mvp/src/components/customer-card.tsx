import { Customer } from "@/lib/types";

export function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{customer.name}</h3>
      <p className="text-sm text-slate-500">{customer.location}</p>
      <p className="mt-2 text-sm">Budget: ${customer.budget.toLocaleString()}</p>
      <p className="text-sm">Interest: {customer.interestType}</p>
      <div className="mt-3 flex gap-2">
        {customer.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium capitalize">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
