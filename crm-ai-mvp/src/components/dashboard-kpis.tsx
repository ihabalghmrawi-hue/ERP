export function DashboardKPIs() {
  const cards = [
    { title: "Conversion Rate", value: "28%" },
    { title: "Active Leads", value: "32" },
    { title: "Top Sales Rep", value: "Rep #1" },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <article key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">{card.title}</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
        </article>
      ))}
    </section>
  );
}
