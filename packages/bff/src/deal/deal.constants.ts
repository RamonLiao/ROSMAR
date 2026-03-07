/**
 * Deal stage mapping — single source of truth for BFF.
 * Must stay in sync with:
 *   - crm_core::deal (STAGE_LEAD..STAGE_LOST = 0..5)
 *   - frontend: packages/frontend/src/lib/constants.ts (DEAL_STAGES)
 */
export const DEAL_STAGES = {
  prospecting: { u8: 0, label: 'Prospecting' },
  qualification: { u8: 1, label: 'Qualification' },
  proposal: { u8: 2, label: 'Proposal' },
  negotiation: { u8: 3, label: 'Negotiation' },
  closed_won: { u8: 4, label: 'Closed Won' },
  closed_lost: { u8: 5, label: 'Closed Lost' },
} as const;

export type DealStage = keyof typeof DEAL_STAGES;

/**
 * Valid stage transitions — BFF-side state machine guard.
 * "disputed" is a P4 addition for escrow dispute flows.
 */
export const VALID_TRANSITIONS: Record<string, string[]> = {
  prospecting: ['qualification'],
  qualification: ['proposal'],
  proposal: ['negotiation'],
  negotiation: ['closed_won', 'closed_lost', 'disputed'],
  closed_won: ['closed'],
  closed_lost: ['closed'],
  disputed: ['negotiation', 'closed_won', 'closed_lost'],
  closed: [],
};
