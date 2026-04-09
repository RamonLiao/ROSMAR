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
  {
    id: 're-engagement',
    name: 'Re-engagement Campaign',
    description:
      'Win back users who left a segment with email and Telegram outreach.',
    triggerType: 'segment_exited',
    steps: [
      {
        type: 'send_email',
        config: {
          subject: 'We miss you!',
          content:
            "Come back and check out what's new in our community.",
        },
      },
      {
        type: 'send_telegram',
        config: {
          content:
            "Hey! We noticed you've been away. Come check out what's new!",
        },
        delay: 86400000,
      },
    ],
  },
  {
    id: 'social-announcement',
    name: 'Cross-Platform Announcement',
    description:
      'Announce updates across X, Discord, and Telegram simultaneously.',
    triggerType: 'segment_entered',
    steps: [
      {
        type: 'send_x',
        config: { content: 'Big news from our community! Check it out.' },
      },
      {
        type: 'send_discord',
        config: {
          content: 'Big news! Check the announcement channel for details.',
        },
      },
      {
        type: 'send_telegram',
        config: { content: 'Big news! Check it out.' },
      },
    ],
  },
];
