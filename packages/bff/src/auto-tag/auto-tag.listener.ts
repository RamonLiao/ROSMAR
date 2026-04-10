import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AutoTagService } from './auto-tag.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AutoTagListener {
  private readonly logger = new Logger(AutoTagListener.name);

  constructor(
    private readonly autoTagService: AutoTagService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('indexer.event.*')
  async handleIndexerEvent(event: {
    event_id: string;
    event_type: string;
    profile_id?: string;
    address: string;
    data: Record<string, unknown>;
    tx_digest: string;
    timestamp: number;
  }) {
    if (!event.profile_id) return;

    try {
      const profile = await this.prisma.profile.findUnique({
        where: { id: event.profile_id },
        select: { id: true, tags: true },
      });
      if (!profile) return;

      const autoTags = await this.autoTagService.computeAutoTags(profile.id);
      const merged = this.autoTagService.mergeTags(profile.tags, autoTags);

      // Only update if tags actually changed
      if (
        JSON.stringify(merged.sort()) !== JSON.stringify(profile.tags.sort())
      ) {
        await this.prisma.profile.update({
          where: { id: profile.id },
          data: { tags: merged },
        });
        this.logger.log(
          `Updated auto-tags for profile ${profile.id}: ${autoTags.join(', ')}`,
        );
      }
    } catch (err) {
      this.logger.error(`Auto-tag failed for profile ${event.profile_id}`, err);
    }
  }
}
