import { Customer, Interaction } from "./types";

export const customers: Customer[] = [
  {
    id: "c_1",
    name: "Mona Adel",
    phone: "+1-555-1022",
    email: "mona@example.com",
    location: "Austin, TX",
    budget: 180000,
    interestType: "Real Estate",
    tags: ["hot"],
    salesRepId: "rep_1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "c_2",
    name: "Omar Samir",
    phone: "+1-555-2033",
    email: "omar@example.com",
    location: "Dallas, TX",
    budget: 65000,
    interestType: "Finishing Package",
    tags: ["warm"],
    salesRepId: "rep_2",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const interactions: Interaction[] = [
  { id: "i_1", customerId: "c_1", kind: "call", note: "Asked for payment plan", respondedInMinutes: 8, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "i_2", customerId: "c_1", kind: "meeting", note: "Site visit done", respondedInMinutes: 30, createdAt: new Date(Date.now() - 43200000).toISOString() },
  { id: "i_3", customerId: "c_2", kind: "whatsapp", note: "Requested brochure", respondedInMinutes: 240, createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
];
