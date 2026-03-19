import { Test } from '@nestjs/testing';
import { EventIngestListener } from './event-ingest.listener';
import { PrismaService } from '../prisma/prisma.service';
import { EngagementService } from '../engagement/engagement.service';
import type { IndexerEventDto } from './indexer-event.dto';

describe('EventIngestListener', () => {
  let listener: EventIngestListener;
  let prisma: {
    profile: { findFirst: jest.Mock; findUnique: jest.Mock };
    walletEvent: { create: jest.Mock };
  };
  let engagementService: { recalculateAndPersist: jest.Mock };

  const baseEvent: IndexerEventDto = {
    event_id: 'evt-1',
    event_type: 'SwapEvent',
    address: '0xabc123',
    data: { token: 'SUI', amount: 1000 },
    tx_digest: '0xtx1',
    timestamp: 1710000000000,
  };

  beforeEach(async () => {
    prisma = {
      profile: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      walletEvent: { create: jest.fn() },
    };
    engagementService = { recalculateAndPersist: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        EventIngestListener,
        { provide: PrismaService, useValue: prisma },
        { provide: EngagementService, useValue: engagementService },
      ],
    }).compile();

    listener = module.get(EventIngestListener);
  });

  it('writes indexer event to wallet_events table', async () => {
    prisma.profile.findUnique.mockResolvedValue({ workspaceId: 'ws-1' });

    await listener.handleEvent({ ...baseEvent, profile_id: 'p-1' });

    expect(prisma.walletEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        address: '0xabc123',
        eventType: 'SwapEvent',
        txDigest: '0xtx1',
        profileId: 'p-1',
        workspaceId: 'ws-1',
        token: 'SUI',
        amount: 1000,
      }),
    });
  });

  it('recalculates engagement score after ingestion', async () => {
    prisma.profile.findUnique.mockResolvedValue({ workspaceId: 'ws-1' });

    await listener.handleEvent({ ...baseEvent, profile_id: 'p-1' });

    expect(engagementService.recalculateAndPersist).toHaveBeenCalledWith(
      'p-1',
      'ws-1',
    );
  });

  it('skips if no profile_id and no matching address', async () => {
    prisma.profile.findFirst.mockResolvedValue(null);

    await listener.handleEvent(baseEvent);

    expect(prisma.walletEvent.create).not.toHaveBeenCalled();
    expect(engagementService.recalculateAndPersist).not.toHaveBeenCalled();
  });

  it('resolves profile from address if profile_id missing', async () => {
    prisma.profile.findFirst.mockResolvedValue({
      id: 'resolved-p',
      workspaceId: 'ws-2',
    });

    await listener.handleEvent(baseEvent);

    expect(prisma.profile.findFirst).toHaveBeenCalledWith({
      where: { wallets: { some: { address: '0xabc123' } } },
      select: { id: true, workspaceId: true },
    });
    expect(prisma.walletEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        profileId: 'resolved-p',
        workspaceId: 'ws-2',
      }),
    });
    expect(engagementService.recalculateAndPersist).toHaveBeenCalledWith(
      'resolved-p',
      'ws-2',
    );
  });
});
