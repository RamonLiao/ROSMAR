import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GdprService } from './gdpr.service';
import { GdprExecutorService } from './gdpr-executor.service';
import { GdprExportService } from './gdpr-export.service';
import { GdprCleanupJob } from './gdpr-cleanup.job';
import { PrismaService } from '../prisma/prisma.service';

describe('GdprService', () => {
  let gdprService: GdprService;
  let executorService: GdprExecutorService;
  let exportService: GdprExportService;
  let cleanupJob: GdprCleanupJob;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      profile: {
        findUniqueOrThrow: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      gdprDeletionLog: {
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      socialLink: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      profileWallet: {
        findMany: jest.fn(),
      },
      deal: {
        findMany: jest.fn(),
      },
      questCompletion: {
        findMany: jest.fn(),
      },
      segmentMembership: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module = await Test.createTestingModule({
      providers: [
        GdprService,
        GdprExecutorService,
        GdprExportService,
        GdprCleanupJob,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    gdprService = module.get(GdprService);
    executorService = module.get(GdprExecutorService);
    exportService = module.get(GdprExportService);
    cleanupJob = module.get(GdprCleanupJob);
  });

  // T23 tests

  it('initiateDeletion — sets profile PENDING_DELETION + creates log with 7-day grace', async () => {
    prisma.profile.update.mockResolvedValue({});
    prisma.gdprDeletionLog.create.mockResolvedValue({});

    await gdprService.initiateDeletion('ws1', 'p1', 'admin@example.com', 'CONSENT_WITHDRAWN');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        gdprStatus: 'PENDING_DELETION',
        gdprScheduledAt: expect.any(Date),
      },
    });
    expect(prisma.gdprDeletionLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'ws1',
        profileId: 'p1',
        requestedBy: 'admin@example.com',
        legalBasis: 'CONSENT_WITHDRAWN',
        dataCategories: ['profile', 'social', 'wallets', 'segments'],
        status: 'PENDING',
        scheduledAt: expect.any(Date),
      }),
    });

    // Verify 7-day grace period
    const scheduledAt = prisma.gdprDeletionLog.create.mock.calls[0][0].data.scheduledAt as Date;
    const diff = scheduledAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(diff).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000);
  });

  it('cancelDeletion — within grace period resets status to NONE', async () => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now
    prisma.profile.findUniqueOrThrow.mockResolvedValue({
      id: 'p1',
      gdprStatus: 'PENDING_DELETION',
      gdprScheduledAt: futureDate,
    });
    prisma.profile.update.mockResolvedValue({});
    prisma.gdprDeletionLog.updateMany.mockResolvedValue({ count: 1 });

    await gdprService.cancelDeletion('p1');

    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { gdprStatus: 'NONE', gdprScheduledAt: null },
    });
    expect(prisma.gdprDeletionLog.updateMany).toHaveBeenCalledWith({
      where: { profileId: 'p1', status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
  });

  it('cancelDeletion after grace period — throws BadRequestException', async () => {
    const pastDate = new Date(Date.now() - 1000); // already past
    prisma.profile.findUniqueOrThrow.mockResolvedValue({
      id: 'p1',
      gdprStatus: 'PENDING_DELETION',
      gdprScheduledAt: pastDate,
    });

    await expect(gdprService.cancelDeletion('p1')).rejects.toThrow(BadRequestException);
    await expect(gdprService.cancelDeletion('p1')).rejects.toThrow('Grace period expired');
  });

  it('getStatus — returns current gdprStatus from profile', async () => {
    prisma.profile.findUniqueOrThrow.mockResolvedValue({
      id: 'p1',
      gdprStatus: 'PENDING_DELETION',
    });

    const result = await gdprService.getStatus('p1');

    expect(result).toEqual({ profileId: 'p1', gdprStatus: 'PENDING_DELETION' });
  });

  it('executeDeletion — nullifies PII and sets COMPLETED', async () => {
    prisma.profile.update.mockResolvedValue({});
    prisma.socialLink.deleteMany.mockResolvedValue({ count: 2 });
    prisma.segmentMembership.deleteMany.mockResolvedValue({ count: 1 });
    prisma.gdprDeletionLog.updateMany.mockResolvedValue({ count: 1 });

    await executorService.execute('p1');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: {
        email: null,
        phone: null,
        suinsName: null,
        telegramChatId: null,
        discordWebhookUrl: null,
        gdprStatus: 'COMPLETED',
        gdprCompletedAt: expect.any(Date),
      },
    });
  });

  it('executeDeletion — deletes social links', async () => {
    prisma.profile.update.mockResolvedValue({});
    prisma.socialLink.deleteMany.mockResolvedValue({ count: 3 });
    prisma.segmentMembership.deleteMany.mockResolvedValue({ count: 0 });
    prisma.gdprDeletionLog.updateMany.mockResolvedValue({ count: 1 });

    await executorService.execute('p1');

    expect(prisma.socialLink.deleteMany).toHaveBeenCalledWith({
      where: { profileId: 'p1' },
    });
  });

  it('exportProfile — returns complete JSON dump', async () => {
    const profile = { id: 'p1', name: 'Alice', gdprStatus: 'NONE' };
    const socialLinks = [{ id: 'sl1', platform: 'discord' }];
    const wallets = [{ id: 'w1', address: '0x123' }];
    const deals = [{ id: 'd1', title: 'Deal 1' }];
    const questCompletions = [{ id: 'qc1', questId: 'q1' }];

    prisma.profile.findUniqueOrThrow.mockResolvedValue(profile);
    prisma.socialLink.findMany.mockResolvedValue(socialLinks);
    prisma.profileWallet.findMany.mockResolvedValue(wallets);
    prisma.deal.findMany.mockResolvedValue(deals);
    prisma.questCompletion.findMany.mockResolvedValue(questCompletions);

    const result = await exportService.export('p1');

    expect(result).toEqual({
      profile,
      socialLinks,
      wallets,
      deals,
      questCompletions,
      exportedAt: expect.any(String),
    });
  });

  it('exportProfile after deletion — throws (COMPLETED → no PII)', async () => {
    prisma.profile.findUniqueOrThrow.mockResolvedValue({
      id: 'p1',
      gdprStatus: 'COMPLETED',
    });

    await expect(exportService.export('p1')).rejects.toThrow(BadRequestException);
    await expect(exportService.export('p1')).rejects.toThrow('PII already deleted');
  });

  it('GdprCleanupJob run — finds eligible profiles and executes deletion', async () => {
    const eligible = [
      { id: 'p1', gdprStatus: 'PENDING_DELETION', gdprScheduledAt: new Date(Date.now() - 1000) },
      { id: 'p2', gdprStatus: 'PENDING_DELETION', gdprScheduledAt: new Date(Date.now() - 2000) },
    ];
    prisma.profile.findMany.mockResolvedValue(eligible);
    prisma.profile.update.mockResolvedValue({});
    prisma.socialLink.deleteMany.mockResolvedValue({ count: 0 });
    prisma.segmentMembership.deleteMany.mockResolvedValue({ count: 0 });
    prisma.gdprDeletionLog.updateMany.mockResolvedValue({ count: 1 });

    const count = await cleanupJob.run();

    expect(count).toBe(2);
    expect(prisma.profile.findMany).toHaveBeenCalledWith({
      where: {
        gdprStatus: 'PENDING_DELETION',
        gdprScheduledAt: { lte: expect.any(Date) },
      },
    });
    // executor.execute called for each profile
    expect(prisma.profile.update).toHaveBeenCalledTimes(2);
  });
});
