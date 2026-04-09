import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelAdapterRegistry } from './adapters/channel-adapter.registry';
import type {
  CreateBroadcastDto,
  UpdateBroadcastDto,
} from './dto/broadcast.dto';

export interface TemplateContext {
  profile?: {
    name?: string;
    primaryAddress?: string;
    ensName?: string;
    tier?: string;
  };
  workspace?: { name?: string };
}

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ChannelAdapterRegistry,
  ) {}

  renderTemplate(content: string, context: TemplateContext): string {
    return content.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_match, obj, key) => {
      const value = (context as any)?.[obj]?.[key];
      return value != null ? String(value) : _match;
    });
  }

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
      throw new BadRequestException(
        'Cannot edit a broadcast that is not in draft status',
      );
    }

    return this.prisma.broadcast.update({
      where: { id },
      data: { ...dto },
    });
  }

  async send(id: string) {
    const broadcast = await this.prisma.broadcast.findUnique({
      where: { id },
      include: { workspace: { select: { name: true } } },
    });
    if (!broadcast) throw new NotFoundException('Broadcast not found');

    // Set status to sending
    await this.prisma.broadcast.update({
      where: { id },
      data: { status: 'sending' },
    });

    const workspaceCtx: TemplateContext = {
      workspace: { name: (broadcast as any).workspace?.name ?? '' },
    };

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

      // Email channel: per-recipient with profile context
      if (channel === 'email' && broadcast.segmentId) {
        try {
          const stats = await this.sendEmailPerRecipient(
            broadcast,
            workspaceCtx,
          );
          if (stats.delivered > 0) allFailed = false;
        } catch (err: any) {
          this.logger.error(
            `Failed email per-recipient send: ${err.message}`,
          );
          await this.prisma.broadcastDelivery.create({
            data: {
              broadcastId: id,
              channel,
              status: 'failed',
              error: err.message,
            },
          });
        }
        continue;
      }

      // Non-email channels: render with workspace context only
      const rendered = this.renderTemplate(broadcast.content, workspaceCtx);

      try {
        const result = await adapter.send(rendered, {
          workspaceId: broadcast.workspaceId,
        });
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

  private async sendEmailPerRecipient(
    broadcast: any,
    workspaceCtx: TemplateContext,
  ): Promise<{ total: number; delivered: number; failed: number }> {
    const members = await this.prisma.segmentMember.findMany({
      where: { segmentId: broadcast.segmentId },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            primaryAddress: true,
            ensName: true,
            tier: true,
            email: true,
          },
        },
      },
    });

    const emailAdapter = this.registry.get('email')!;
    let delivered = 0;
    let failed = 0;

    for (const member of members) {
      const profile = member.profile;
      if (!profile?.email) continue;

      const context: TemplateContext = {
        ...workspaceCtx,
        profile: {
          name: profile.name ?? undefined,
          primaryAddress: profile.primaryAddress ?? undefined,
          ensName: profile.ensName ?? undefined,
          tier: profile.tier ?? undefined,
        },
      };

      const rendered = this.renderTemplate(broadcast.content, context);

      try {
        const result = await emailAdapter.send(rendered, {
          profileId: profile.id,
          workspaceId: broadcast.workspaceId,
          subject: broadcast.title,
        });
        await this.prisma.broadcastDelivery.create({
          data: {
            broadcastId: broadcast.id,
            channel: 'email',
            status: 'delivered',
            platformMessageId: result.messageId,
            deliveredAt: new Date(),
          },
        });
        delivered++;
      } catch (err: any) {
        this.logger.error(
          `Email to profile ${profile.id} failed: ${err.message}`,
        );
        await this.prisma.broadcastDelivery.create({
          data: {
            broadcastId: broadcast.id,
            channel: 'email',
            status: 'failed',
            error: err.message,
          },
        });
        failed++;
      }
    }

    return { total: members.length, delivered, failed };
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
