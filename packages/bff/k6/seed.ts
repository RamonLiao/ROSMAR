import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create test workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: 'perf-test-workspace' },
    update: {},
    create: {
      id: 'perf-test-workspace',
      name: 'Perf Test Workspace',
      ownerAddress: '0x0000000000000000000000000000000000000000000000000000000000000001',
    },
  });

  // Create test profile
  const profile = await prisma.profile.upsert({
    where: { id: 'perf-test-profile' },
    update: {},
    create: {
      id: 'perf-test-profile',
      workspaceId: workspace.id,
      primaryAddress: '0x0000000000000000000000000000000000000000000000000000000000000002',
      suinsName: 'perftest.sui',
      tags: ['vip', 'whale', 'defi'],
      tier: 3,
      engagementScore: 85,
      version: 1,
    },
  });

  // Add wallets
  await prisma.profileWallet.upsert({
    where: { id: 'perf-wallet-sui' },
    update: {},
    create: {
      id: 'perf-wallet-sui',
      profileId: profile.id,
      chain: 'sui',
      address: '0x0000000000000000000000000000000000000000000000000000000000000002',
    },
  });

  await prisma.profileWallet.upsert({
    where: { id: 'perf-wallet-evm' },
    update: {},
    create: {
      id: 'perf-wallet-evm',
      profileId: profile.id,
      chain: 'evm',
      address: '0x0000000000000000000000000000000000000000',
      ensName: 'perftest.eth',
    },
  });

  // Add timeline events
  const walletAddress = '0x0000000000000000000000000000000000000000000000000000000000000002';
  const events = Array.from({ length: 50 }, (_, i) => ({
    profileId: profile.id,
    address: walletAddress,
    eventType: i % 3 === 0 ? 'TransferObject' : i % 3 === 1 ? 'SwapEvent' : 'StakeEvent',
    collection: i % 2 === 0 ? 'SuiFrens' : null,
    amount: Math.random() * 1000,
    txDigest: `perftest-tx-${i}`,
    time: new Date(Date.now() - i * 3600_000),
  }));

  await prisma.walletEvent.createMany({ data: events });

  // Add social links
  await prisma.socialLink.upsert({
    where: { id: 'perf-social-discord' },
    update: {},
    create: {
      id: 'perf-social-discord',
      profileId: profile.id,
      platform: 'discord',
      platformUserId: '123456789',
    },
  });

  console.log('Perf seed complete: workspace=%s profile=%s', workspace.id, profile.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
