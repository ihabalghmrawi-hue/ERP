import { FollowUp, LeadStatus } from "../types";

const leadStatusCadenceHours: Record<LeadStatus, number> = {
  hot: 24,
  warm: 72,
  cold: 168,
};

export function scheduleFollowUp(params: {
  customerId: string;
  leadStatus: LeadStatus;
  lastInteractionAt: string;
  manualDueAt?: string;
}): FollowUp {
  const baseline = new Date(params.lastInteractionAt);
  const dueAt = params.manualDueAt
    ? new Date(params.manualDueAt)
    : new Date(baseline.getTime() + leadStatusCadenceHours[params.leadStatus] * 60 * 60 * 1000);

  return {
    id: crypto.randomUUID(),
    customerId: params.customerId,
    dueAt: dueAt.toISOString(),
    reminderText: `Call this client on ${dueAt.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", weekday: "short", month: "short", day: "numeric" })}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

export function snoozeFollowUp(followUp: FollowUp, hours = 24): FollowUp {
  const snoozedUntil = new Date(new Date(followUp.dueAt).getTime() + hours * 60 * 60 * 1000).toISOString();
  return { ...followUp, status: "snoozed", snoozedUntil };
}
