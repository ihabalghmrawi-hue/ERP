import { notFound } from "next/navigation";
import { customers, interactions } from "@/lib/mock-db";
import { generateInsight } from "@/lib/ai/insights";

export default function CustomerProfilePage({ params }: { params: { id: string } }) {
  const customer = customers.find((item) => item.id === params.id);
  if (!customer) return notFound();

  const timeline = interactions.filter((item) => item.customerId === customer.id);
  const insight = generateInsight({
    customer,
    interactions: timeline,
    deal: { stage: "contacted", engagementLevel: 66 },
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <h1 className="text-2xl font-bold">{customer.name}</h1>

        <section className="grid gap-3 sm:grid-cols-3">
          <article className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Likelihood Score</p>
            <p className="text-2xl font-semibold">{insight.likelihoodScore}</p>
          </article>
          <article className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Intent Class</p>
            <p className="text-2xl font-semibold">{insight.intentClass}</p>
          </article>
          <article className="rounded-xl border bg-white p-4">
            <p className="text-sm text-slate-500">Best Contact Time</p>
            <p className="text-2xl font-semibold">{insight.bestContactTime}</p>
          </article>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Recommended Offer</h2>
          <p className="mt-2 text-slate-600">{insight.recommendedOffer}</p>
        </section>

        <section className="rounded-xl border bg-white p-4">
          <h2 className="text-lg font-semibold">Activity Timeline</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {timeline.map((item) => (
              <li key={item.id}>
                [{item.kind}] {item.note} — {new Date(item.createdAt).toLocaleString("en-US")}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
