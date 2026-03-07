import { Test } from '@nestjs/testing';
import { AutoTagListener } from './auto-tag.listener';
import { AutoTagService } from './auto-tag.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AutoTagListener', () => {
  let listener: AutoTagListener;
  let autoTagService: { computeAutoTags: jest.Mock; mergeTags: jest.Mock };
  let prisma: { profile: { findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    autoTagService = {
      computeAutoTags: jest.fn(),
      mergeTags: jest.fn(),
    };
    prisma = {
      profile: { findUnique: jest.fn(), update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        AutoTagListener,
        { provide: AutoTagService, useValue: autoTagService },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    listener = module.get(AutoTagListener);
  });

  it('should skip event without profile_id', async () => {
    await listener.handleIndexerEvent({
      event_id: '1',
      event_type: 'MintNFTEvent',
      address: '0xabc',
      data: {},
      tx_digest: '0x123',
      timestamp: Date.now(),
    });

    expect(autoTagService.computeAutoTags).not.toHaveBeenCalled();
  });

  it('should compute and update tags when profile_id present', async () => {
    const profile = { id: 'p1', tags: ['vip'] };
    prisma.profile.findUnique.mockResolvedValue(profile);
    autoTagService.computeAutoTags.mockResolvedValue(['auto:NFT_Collector']);
    autoTagService.mergeTags.mockReturnValue(['vip', 'auto:NFT_Collector']);

    await listener.handleIndexerEvent({
      event_id: '1',
      event_type: 'MintNFTEvent',
      profile_id: 'p1',
      address: '0xabc',
      data: {},
      tx_digest: '0x123',
      timestamp: Date.now(),
    });

    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { tags: expect.arrayContaining(['vip', 'auto:NFT_Collector']) },
    });
  });
});
