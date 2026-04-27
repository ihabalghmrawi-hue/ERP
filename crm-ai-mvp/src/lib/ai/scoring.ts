import { DealContext, Interaction, LeadScoreResult, LeadStatus } from "../types";

export interface LeadScoringConfig {
  recencyWeight: number;
  frequencyWeight: number;
  responseSpeedWeight: number;
  stageWeight: number;
  budgetWeight: number;
  engagementWeight: number;
  inactivityPenaltyPerDay: number;
}

export const defaultScoringConfig: LeadScoringConfig = {
  recencyWeight: 24,
  frequencyWeight: 18,
  responseSpeedWeight: 16,
  stageWeight: 14,
  budgetWeight: 14,
  engagementWeight: 14,
  inactivityPenaltyPerDay: 1.2,
};

const stageMap: Record<DealContext["stage"], number> = {
  lead: 30,
  contacted: 50,
  negotiation: 80,
  closed: 100,
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function computeLeadScore(params: {
  interactions: Interaction[];
  deal: DealContext;
  budget: number;
  now?: Date;
  config?: Partial<LeadScoringConfig>;
}): LeadScoreResult {
  const now = params.now ?? new Date();
  const config = { ...defaultScoringConfig, ...params.config };
  const interactions = [...params.interactions].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const latest = interactions[0];
  const daysSinceLast = latest ? (now.getTime() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60 * 24) : 60;

  const recencyScore = clamp(100 - daysSinceLast * 4);
  const frequencyScore = clamp(interactions.length * 12);

  const avgResponseMinutes =
    interactions.filter((i) => typeof i.respondedInMinutes === "number").reduce((sum, i) => sum + (i.respondedInMinutes ?? 0), 0) /
    Math.max(interactions.filter((i) => typeof i.respondedInMinutes === "number").length, 1);
  const responseSpeedScore = clamp(100 - avgResponseMinutes / 3);

  const stageScore = stageMap[params.deal.stage];
  const budgetScore = clamp((params.budget / 200000) * 100);
  const engagementScore = clamp(params.deal.engagementLevel);

  const weighted =
    (recencyScore * config.recencyWeight +
      frequencyScore * config.frequencyWeight +
      responseSpeedScore * config.responseSpeedWeight +
      stageScore * config.stageWeight +
      budgetScore * config.budgetWeight +
      engagementScore * config.engagementWeight) /
    100;

  const inactivityPenalty = Math.max(0, daysSinceLast - 3) * config.inactivityPenaltyPerDay;
  const leadScore = clamp(Math.round(weighted - inactivityPenalty));

  const leadStatus: LeadStatus = leadScore >= 75 ? "hot" : leadScore >= 45 ? "warm" : "cold";

  return {
    leadScore,
    leadStatus,
    explanation: [
      `Recency ${recencyScore.toFixed(0)} based on ${daysSinceLast.toFixed(1)} days since last interaction`,
      `Frequency ${frequencyScore.toFixed(0)} from ${interactions.length} interactions`,
      `Response speed ${responseSpeedScore.toFixed(0)} from average ${avgResponseMinutes.toFixed(0)} minutes`,
      `Stage ${params.deal.stage} contributes ${stageScore}`,
      `Budget contributes ${budgetScore.toFixed(0)}`,
      `Engagement contributes ${engagementScore.toFixed(0)}`,
      `Inactivity penalty applied: ${inactivityPenalty.toFixed(1)}`,
    ],
  };
}
