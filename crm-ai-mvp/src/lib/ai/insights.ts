import { AIInsight, Customer, DealContext, Interaction, IntentClass } from "../types";
import { computeLeadScore } from "./scoring";

function classifyIntent(score: number): IntentClass {
  if (score >= 75) return "High intent";
  if (score >= 45) return "Medium intent";
  return "Low intent";
}

function suggestContactTime(interactions: Interaction[]): string {
  const hourBuckets = interactions.map((i) => new Date(i.createdAt).getHours());
  if (!hourBuckets.length) return "Tomorrow 6:00 PM";
  const eveningCount = hourBuckets.filter((h) => h >= 17 && h <= 21).length;
  return eveningCount >= hourBuckets.length / 2 ? "Tomorrow 6:00 PM" : "Tomorrow 12:00 PM";
}

function recommendOffer(customer: Customer, leadScore: number): string {
  if (customer.interestType.toLowerCase().includes("real estate")) {
    return leadScore >= 70 ? "Share premium listing package with flexible payment plan" : "Share starter listing bundle and financing guide";
  }
  if (customer.budget >= 100000) return "Recommend premium package with priority support";
  return "Recommend entry package with limited-time discount";
}

export function generateInsight(input: {
  customer: Customer;
  interactions: Interaction[];
  deal: DealContext;
}): AIInsight {
  const { leadScore } = computeLeadScore({
    interactions: input.interactions,
    deal: input.deal,
    budget: input.customer.budget,
  });

  return {
    customerId: input.customer.id,
    likelihoodScore: leadScore,
    intentClass: classifyIntent(leadScore),
    bestContactTime: suggestContactTime(input.interactions),
    recommendedOffer: recommendOffer(input.customer, leadScore),
    modelVersion: "rules-v1",
    generatedAt: new Date().toISOString(),
  };
}
