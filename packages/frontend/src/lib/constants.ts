/**
 * Single source of truth for deal pipeline stages.
 * Used by kanban board, create dialog, and stage updates.
 */
export const DEAL_STAGES = [
  { value: "prospecting", label: "Prospecting" },
  { value: "qualification", label: "Qualification" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "closed_won", label: "Closed Won" },
  { value: "closed_lost", label: "Closed Lost" },
] as const;

export type DealStage = (typeof DEAL_STAGES)[number]["value"];
