import { Test } from '@nestjs/testing';
import { AutoTagService } from './auto-tag.service';
import { PrismaService } from '../prisma/prisma.service';
import { AUTO_TAG_PREFIX } from './auto-tag.constants';

describe('AutoTagService', () => {
  let service: AutoTagService;
  let prisma: { $queryRaw: jest.Mock; profile: { update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      profile: { update: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [AutoTagService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AutoTagService);
  });

  it('should add NFT_Collector tag when >= 5 NFT events', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ cnt: 6n }])
      .mockResolvedValueOnce([{ cnt: 0n }])
      .mockResolvedValueOnce([{ cnt: 0n }])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ cnt: 0n }]);

    const tags = await service.computeAutoTags('profile-1');
    expect(tags).toContain(`${AUTO_TAG_PREFIX}NFT_Collector`);
  });

  it('should NOT add NFT_Collector when < 5 events', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ cnt: 2n }])
      .mockResolvedValueOnce([{ cnt: 0n }])
      .mockResolvedValueOnce([{ cnt: 0n }])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ cnt: 0n }]);

    const tags = await service.computeAutoTags('profile-1');
    expect(tags).not.toContain(`${AUTO_TAG_PREFIX}NFT_Collector`);
  });

  it('should merge auto tags with existing manual tags', () => {
    const existing = ['vip', `${AUTO_TAG_PREFIX}old_tag`];
    const autoTags = [`${AUTO_TAG_PREFIX}NFT_Collector`];

    const merged = service.mergeTags(existing, autoTags);
    expect(merged).toContain('vip');
    expect(merged).toContain(`${AUTO_TAG_PREFIX}NFT_Collector`);
    expect(merged).not.toContain(`${AUTO_TAG_PREFIX}old_tag`);
  });
});
