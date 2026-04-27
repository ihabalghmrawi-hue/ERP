const reminders = [
  "Call Mona Adel tomorrow at 6:00 PM",
  "Send WhatsApp brochure to Omar Samir at 12:00 PM",
];

export function FollowUpsList() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold">Daily Follow-ups</h2>
      <ul className="mt-3 list-disc space-y-2 pl-4 text-sm text-slate-600">
        {reminders.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
