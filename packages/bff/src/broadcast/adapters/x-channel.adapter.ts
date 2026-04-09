import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { SocialLinkService } from '../../social/social-link.service';
import type { ChannelAdapter } from './channel-adapter.interface';

@Injectable()
export class XChannelAdapter implements ChannelAdapter {
  readonly channel = 'x';
  private readonly logger = new Logger(XChannelAdapter.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly socialLinkService: SocialLinkService,
  ) {}

  async send(
    content: string,
    cfg: Record<string, any>,
  ): Promise<{ messageId: string }> {
    const workspaceId = cfg.workspaceId;
    if (!workspaceId) {
      throw new Error('workspaceId is required for X channel');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    // Find owner profile by workspace's ownerAddress
    const ownerProfile = await this.prisma.profile.findFirst({
      where: {
        workspaceId,
        primaryAddress: workspace.ownerAddress,
      },
      select: { id: true },
    });
    if (!ownerProfile) {
      throw new Error('No owner profile found for workspace');
    }

    const socialLink = await this.prisma.socialLink.findUnique({
      where: {
        profileId_platform: {
          profileId: ownerProfile.id,
          platform: 'x',
        },
      },
    });
    if (!socialLink?.oauthTokenEncrypted) {
      throw new Error('X OAuth token not found for workspace owner');
    }

    const accessToken = this.socialLinkService.decryptToken(
      socialLink.oauthTokenEncrypted,
    );

    const text =
      content.length > 280 ? content.slice(0, 277) + '...' : content;

    const url = 'https://api.x.com/2/tweets';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text }),
    });

    if (res.status === 401) {
      throw new Error(
        'X OAuth token expired – user must re-authenticate via SocialLink',
      );
    }

    if (!res.ok) {
      const err = await res.text();
      this.logger.error(`X API error: ${err}`);
      throw new Error(`X API error: ${res.status}`);
    }

    const data = await res.json();
    return { messageId: data.data?.id ?? '' };
  }
}
