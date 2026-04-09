import { Injectable, Logger } from '@nestjs/common';
import type { ChannelAdapter } from './channel-adapter.interface';
import { EmailService } from '../../messaging/email.service';

@Injectable()
export class EmailChannelAdapter implements ChannelAdapter {
  readonly channel = 'email';
  private readonly logger = new Logger(EmailChannelAdapter.name);

  constructor(private readonly emailService: EmailService) {}

  async send(
    content: string,
    cfg: Record<string, any>,
  ): Promise<{ messageId: string }> {
    const profileId = cfg.profileId as string;
    const workspaceId = cfg.workspaceId as string;
    const subject =
      (cfg.subject as string) || 'Update from your community';

    if (!profileId || !workspaceId) {
      throw new Error(
        'profileId and workspaceId required for email adapter',
      );
    }

    const result = await this.emailService.sendMessage(workspaceId, {
      profileId,
      subject,
      body: content,
    });

    return { messageId: result.messageId };
  }
}
