import { Test } from '@nestjs/testing';
import { ProfileService } from './profile.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

// Mock the blockchain modules to avoid ESM import issues from @mysten/sui
jest.mock('../blockchain/sui.client', () => ({
  SuiClientService: jest.fn().mockImplementation(() => ({})),
}));
jest.mock('../blockchain/tx-builder.service', () => ({
  TxBuilderService: jest.fn().mockImplementation(() => ({})),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SuiClientService } = require('../blockchain/sui.client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { TxBuilderService } = require('../blockchain/tx-builder.service');

describe('ProfileService - Assets & Timeline', () => {
  let service: ProfileService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      walletEvent: { findMany: jest.fn(), count: jest.fn() },
      profile: {
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        ProfileService,
        { provide: PrismaService, useValue: prisma },
        { provide: SuiClientService, useValue: {} },
        { provide: TxBuilderService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => '' } },
      ],
    }).compile();

    service = module.get(ProfileService);
  });

  it('getAssets returns NFT and token aggregations', async () => {
    prisma.$queryRaw.mockResolvedValue([
      { collection: 'SuiFrens', event_type: 'MintNFTEvent', cnt: 3n, total_amount: null },
      { collection: null, event_type: 'StakeEvent', cnt: 5n, total_amount: 10000 },
    ]);

    const assets = await service.getAssets('profile-1');
    expect(assets.nfts).toHaveLength(1);
    expect(assets.nfts[0].collection).toBe('SuiFrens');
    expect(assets.defi).toHaveLength(1);
  });

  it('getTimeline returns paginated events', async () => {
    prisma.walletEvent.findMany.mockResolvedValue([
      { id: '1', eventType: 'SwapEvent', time: new Date(), amount: 100 },
    ]);
    prisma.walletEvent.count.mockResolvedValue(1);

    const result = await service.getTimeline('profile-1', 20, 0);
    expect(result.events).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
