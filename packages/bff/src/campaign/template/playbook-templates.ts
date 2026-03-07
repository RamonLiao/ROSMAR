export interface PlaybookStep {
  type: string;
  config: Record<string, unknown>;
  delay?: number;
}

export interface PlaybookTemplate {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  steps: PlaybookStep[];
}

export const PLAYBOOK_TEMPLATES: PlaybookTemplate[] = [
  {
    id: 'nft-welcome',
    name: 'NFT Welcome Flow',
    description:
      'Onboard new NFT holders with a welcome message and Discord role grant.',
    triggerType: 'nft_minted',
    steps: [
      {
        type: 'send_telegram',
        config: { content: 'Welcome to our community! Your NFT is confirmed.' },
        delay: 3600000, // 1 hour
      },
      {
        type: 'grant_discord_role',
        config: { guildId: '', roleId: '' },
      },
    ],
  },
  {
    id: 'defi-activation',
    name: 'DeFi Activation',
    description:
      'Reward users who perform their first DeFi swap with a token airdrop.',
    triggerType: 'defi_action',
    steps: [
      {
        type: 'airdrop_token',
        config: { coinType: '0x2::sui::SUI', amount: '1000000000' },
      },
    ],
  },
  {
    id: 'dao-voting',
    name: 'DAO Voting Reward',
    description:
      'Thank DAO voters with a Discord message and issue a POAP badge.',
    triggerType: 'governance_vote',
    steps: [
      {
        type: 'send_discord',
        config: { content: 'Thanks for voting! Your participation matters.' },
      },
      {
        type: 'issue_poap',
        config: { poapTypeId: 'governance-voter' },
      },
    ],
  },
  {
    id: 'membership-tier',
    name: 'Membership Tier Upgrade',
    description:
      'Upgrade whale-tier members with a VIP Discord role and Telegram notification.',
    triggerType: 'segment_entered',
    steps: [
      {
        type: 'grant_discord_role',
        config: { guildId: '', roleId: '' },
      },
      {
        type: 'send_telegram',
        config: { content: 'Congrats! You have been upgraded to VIP tier.' },
      },
    ],
  },
];
