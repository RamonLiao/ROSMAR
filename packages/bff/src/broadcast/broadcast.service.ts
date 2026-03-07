import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelAdapterRegistry } from './adapters/channel-adapter.registry';
import type { CreateBroadcastDto, UpdateBroadcastDto } from './dto/broadcast.dto';

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ChannelAdapterRegistry,
  ) {}

  async create(workspaceId: string, dto: CreateBroadcastDto) {
    return this.prisma.broadcast.create({
      data: {
        workspaceId,
        title: dto.title,
        content: dto.content,
        contentHtml: dto.contentHtml,
        channels: dto.channels,
        segmentId: dto.segmentId,
        status: 'draft',
      },
    });
  }

  async update(id: string, dto: UpdateBroadcastDto) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id } });
    if (!broadcast) throw new NotFoundException('Broadcast not found');
    if (broadcast.status !== 'draft') {
      throw new BadRequestException('Cannot edit a broadcast that is not in draft status');
    }

    return this.prisma.broadcast.update({
      where: { id },
      data: { ...dto },
    });
  }

  async send(id: string) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id } });
    if (!broadcast) throw new NotFoundException('Broadcast not found');

    // Set status to sending
    await this.prisma.broadcast.update({
      where: { id },
      data: { status: 'sending' },
    });

    const channels = broadcast.channels as string[];
    let allFailed = true;

    for (const channel of channels) {
      const adapter = this.registry.get(channel);
      if (!adapter) {
        this.logger.warn(`No adapter found for channel: ${channel}`);
        await this.prisma.broadcastDelivery.create({
          data: {
            broadcastId: id,
            channel,
            status: 'failed',
            error: `No adapter for channel: ${channel}`,
          },
        });
        continue;
      }

      try {
        const result = await adapter.send(broadcast.content, {});
        await this.prisma.broadcastDelivery.create({
          data: {
            broadcastId: id,
            channel,
            status: 'delivered',
            platformMessageId: result.messageId,
            deliveredAt: new Date(),
          },
        });
        allFailed = false;
      } catch (err: any) {
        this.logger.error(`Failed to send to ${channel}: ${err.message}`);
        await this.prisma.broadcastDelivery.create({
          data: {
            broadcastId: id,
            channel,
            status: 'failed',
            error: err.message,
          },
        });
      }
    }

    // Final status
    await this.prisma.broadcast.update({
      where: { id },
      data: {
        status: allFailed ? 'failed' : 'sent',
        sentAt: new Date(),
      },
    });
  }

  async schedule(id: string, scheduledAt: Date) {
    const broadcast = await this.prisma.broadcast.findUnique({ where: { id } });
    if (!broadcast) throw new NotFoundException('Broadcast not found');
    if (broadcast.status !== 'draft') {
      throw new BadRequestException('Can only schedule draft broadcasts');
    }

    return this.prisma.broadcast.update({
      where: { id },
      data: { status: 'scheduled', scheduledAt },
    });
  }

  async list(workspaceId: string) {
    return this.prisma.broadcast.findMany({
      where: { workspaceId },
      include: { _count: { select: { deliveries: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAnalytics(id: string) {
    return this.prisma.broadcastDelivery.groupBy({
      by: ['channel', 'status'],
      where: { broadcastId: id },
      _count: { status: true },
    });
  }
}
