import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../../../messaging/email.service';
import { PrismaService } from '../../../prisma/prisma.service';

export interface SendEmailConfig {
  subject: string;
  body: string;
  workspaceId: string;
}

@Injectable()
export class SendEmailAction {
  private readonly logger = new Logger(SendEmailAction.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(profileId: string, config: SendEmailConfig): Promise<void> {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: profileId },
      select: { email: true, workspaceId: true },
    });

    if (!profile.email) {
      this.logger.warn(`No email for profile ${profileId} — skipping`);
      return;
    }

    const workspaceId = config.workspaceId || profile.workspaceId;

    await this.emailService.sendMessage(workspaceId, {
      profileId,
      subject: config.subject,
      body: config.body,
    });

    this.logger.log(`Email sent to profile ${profileId}`);
  }
}
