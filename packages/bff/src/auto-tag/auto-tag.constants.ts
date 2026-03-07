export const AUTO_TAG_PREFIX = 'auto:';

export const TAG_RULES = [
  {
    tag: 'NFT_Collector',
    eventTypes: ['MintNFTEvent', 'TransferObject'],
    minCount: 5,
    period: 'all',
  },
  {
    tag: 'DeFi_Power_User',
    eventTypes: ['SwapEvent', 'AddLiquidityEvent', 'StakeEvent'],
    minCount: 10,
    period: '30d',
  },
  {
    tag: 'DAO_Voter',
    eventTypes: ['VoteEvent', 'DelegateEvent'],
    minCount: 3,
    period: '90d',
  },
  {
    tag: 'Whale',
    eventTypes: ['SwapEvent', 'AddLiquidityEvent'],
    minAmountUsd: 100_000,
    period: '30d',
  },
  {
    tag: 'Diamond_Hands',
    eventTypes: ['StakeEvent'],
    minCount: 1,
    minHoldDays: 180,
    period: 'all',
  },
] as const;

export type TagRule = (typeof TAG_RULES)[number];
