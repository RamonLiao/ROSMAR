import { Test } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WhaleAlertListener } from './whale-alert.listener';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WhaleAlertListener', () => {
  let listener: WhaleAlertListener;
  let notificationService: { create: jest.Mock };

  beforeEach(async () => {
    notificationService = { create: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        WhaleAlertListener,
        { provide: NotificationService, useValue: notificationService },
        {
          provide: PrismaService,
          useValue: {
            profile: { findUnique: jest.fn().mockResolvedValue({ workspaceId: 'ws1' }) },
            workspace: { findUnique: jest.fn().mockResolvedValue({ whaleThresholds: [] }) },
          },
        },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    listener = module.get(WhaleAlertListener);
  });

  it('should create notification for whale alert', async () => {
    await listener.handleWhaleAlert({
      event_id: '1',
      event_type: 'WhaleAlert',
      profile_id: 'p1',
      address: '0xwhale123abc',
      data: {
        amount: 500000,
        token: 'SUI',
        tx_type: 'SwapEvent',
      },
      tx_digest: '0xabc',
      timestamp: Date.now(),
    });

    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'whale_alert',
        title: expect.stringContaining('Whale'),
      }),
    );
  });
});
