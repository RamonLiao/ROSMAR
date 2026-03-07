import { Test } from '@nestjs/testing';
import { BroadcastService } from './broadcast.service';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelAdapterRegistry } from './adapters/channel-adapter.registry';

describe('BroadcastService', () => {
  let service: BroadcastService;
  let prisma: any;
  let registry: any;

  beforeEach(async () => {
    prisma = {
      broadcast: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      broadcastDelivery: {
        create: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    registry = {
      get: jest.fn(),
      getAll: jest.fn().mockReturnValue([]),
    };

    const module = await Test.createTestingModule({
      providers: [
        BroadcastService,
        { provide: PrismaService, useValue: prisma },
        { provide: ChannelAdapterRegistry, useValue: registry },
      ],
    }).compile();

    service = module.get(BroadcastService);
  });

  describe('create', () => {
    it('should create a draft broadcast', async () => {
      const dto = { title: 'Hello', content: 'World', channels: ['telegram', 'discord'] };
      prisma.broadcast.create.mockResolvedValue({ id: 'b-1', ...dto, status: 'draft' });

      const result = await service.create('ws-1', dto);

      expect(prisma.broadcast.create).toHaveBeenCalledWith({
        data: {
          workspaceId: 'ws-1',
          title: 'Hello',
          content: 'World',
          contentHtml: undefined,
          channels: ['telegram', 'discord'],
          segmentId: undefined,
          status: 'draft',
        },
      });
      expect(result.status).toBe('draft');
    });
  });

  describe('update', () => {
    it('should update a draft broadcast', async () => {
      prisma.broadcast.findUnique.mockResolvedValue({ id: 'b-1', status: 'draft' });
      prisma.broadcast.update.mockResolvedValue({ id: 'b-1', title: 'Updated' });

      const result = await service.update('b-1', { title: 'Updated' });

      expect(prisma.broadcast.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { title: 'Updated' },
      });
      expect(result.title).toBe('Updated');
    });

    it('should reject updates on non-draft broadcasts', async () => {
      prisma.broadcast.findUnique.mockResolvedValue({ id: 'b-1', status: 'sent' });

      await expect(service.update('b-1', { title: 'Updated' })).rejects.toThrow(
        'Cannot edit a broadcast that is not in draft status',
      );
    });
  });

  describe('send', () => {
    it('should send to all channels and create deliveries', async () => {
      prisma.broadcast.findUnique.mockResolvedValue({
        id: 'b-1',
        content: 'Hello world',
        channels: ['telegram', 'discord'],
        status: 'draft',
      });

      const telegramAdapter = { channel: 'telegram', send: jest.fn().mockResolvedValue({ messageId: 'tg-123' }) };
      const discordAdapter = { channel: 'discord', send: jest.fn().mockResolvedValue({ messageId: 'dc-456' }) };

      registry.get.mockImplementation((ch: string) => {
        if (ch === 'telegram') return telegramAdapter;
        if (ch === 'discord') return discordAdapter;
        return undefined;
      });

      prisma.broadcastDelivery.create.mockResolvedValue({});
      prisma.broadcast.update.mockResolvedValue({ id: 'b-1', status: 'sent' });

      await service.send('b-1');

      expect(prisma.broadcast.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { status: 'sending' },
      });

      expect(telegramAdapter.send).toHaveBeenCalledWith('Hello world', {});
      expect(discordAdapter.send).toHaveBeenCalledWith('Hello world', {});

      expect(prisma.broadcastDelivery.create).toHaveBeenCalledTimes(2);

      // Final status update to 'sent'
      expect(prisma.broadcast.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { status: 'sent', sentAt: expect.any(Date) },
      });
    });

    it('should mark delivery as failed if adapter throws', async () => {
      prisma.broadcast.findUnique.mockResolvedValue({
        id: 'b-1',
        content: 'Hello',
        channels: ['telegram'],
        status: 'draft',
      });

      const telegramAdapter = {
        channel: 'telegram',
        send: jest.fn().mockRejectedValue(new Error('API error')),
      };
      registry.get.mockReturnValue(telegramAdapter);

      prisma.broadcastDelivery.create.mockResolvedValue({});
      prisma.broadcast.update.mockResolvedValue({});

      await service.send('b-1');

      expect(prisma.broadcastDelivery.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          broadcastId: 'b-1',
          channel: 'telegram',
          status: 'failed',
          error: 'API error',
        }),
      });
    });
  });

  describe('schedule', () => {
    it('should set status to scheduled with scheduledAt', async () => {
      prisma.broadcast.findUnique.mockResolvedValue({ id: 'b-1', status: 'draft' });
      prisma.broadcast.update.mockResolvedValue({ id: 'b-1', status: 'scheduled' });

      const date = new Date('2026-04-01T10:00:00Z');
      await service.schedule('b-1', date);

      expect(prisma.broadcast.update).toHaveBeenCalledWith({
        where: { id: 'b-1' },
        data: { status: 'scheduled', scheduledAt: date },
      });
    });
  });

  describe('list', () => {
    it('should return broadcasts with delivery counts', async () => {
      prisma.broadcast.findMany.mockResolvedValue([
        { id: 'b-1', title: 'Test', _count: { deliveries: 5 } },
      ]);

      const result = await service.list('ws-1');

      expect(prisma.broadcast.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        include: { _count: { select: { deliveries: true } } },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getAnalytics', () => {
    it('should return per-channel delivery status counts', async () => {
      prisma.broadcastDelivery.groupBy.mockResolvedValue([
        { channel: 'telegram', status: 'delivered', _count: { status: 3 } },
        { channel: 'telegram', status: 'failed', _count: { status: 1 } },
        { channel: 'discord', status: 'delivered', _count: { status: 5 } },
      ]);

      const result = await service.getAnalytics('b-1');

      expect(prisma.broadcastDelivery.groupBy).toHaveBeenCalledWith({
        by: ['channel', 'status'],
        where: { broadcastId: 'b-1' },
        _count: { status: true },
      });
      expect(result).toHaveLength(3);
    });
  });
});
