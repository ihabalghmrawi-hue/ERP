import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export const SAAS_KEY = "saas:data";
export const tenantKey = (id: string) => `tenant:${id}`;
