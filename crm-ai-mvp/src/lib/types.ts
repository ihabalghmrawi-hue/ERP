export type LeadStatus = "hot" | "warm" | "cold";
export type IntentClass = "High intent" | "Medium intent" | "Low intent";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  location: string;
  budget: number;
  interestType: string;
  tags: LeadStatus[];
  salesRepId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Interaction {
  id: string;
  customerId: string;
  kind: "call" | "whatsapp" | "meeting";
  note: string;
  respondedInMinutes?: number;
  createdAt: string;
}

export interface DealContext {
  stage: "lead" | "contacted" | "negotiation" | "closed";
  engagementLevel: number; // 0-100
}

export interface LeadScoreResult {
  leadScore: number;
  leadStatus: LeadStatus;
  explanation: string[];
}

export interface AIInsight {
  customerId: string;
  likelihoodScore: number;
  intentClass: IntentClass;
  bestContactTime: string;
  recommendedOffer: string;
  modelVersion: string;
  generatedAt: string;
}

export interface FollowUp {
  id: string;
  customerId: string;
  dueAt: string;
  reminderText: string;
  status: "pending" | "done" | "snoozed" | "cancelled";
  snoozedUntil?: string;
  createdAt: string;
}
