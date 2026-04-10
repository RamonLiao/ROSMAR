import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface SendEmailDto {
  profileId: string;
  to?: string;
  subject: string;
  body: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private apiKey: string;
  private fromEmail: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('RESEND_API_KEY', '');
    this.fromEmail = this.configService.get<string>(
      'FROM_EMAIL',
      'noreply@rosmar.io',
    );
  }

  async sendMessage(workspaceId: string, dto: SendEmailDto): Promise<any> {
    const profile = await this.prisma.profile.findUniqueOrThrow({
      where: { id: dto.profileId },
      select: { email: true },
    });

    const toEmail = dto.to || profile.email;
    if (!toEmail) {
      throw new Error('No email address linked to profile');
    }

    let externalId = `email_mock_${Date.now()}`;
    let status = 'sent';

    if (this.apiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            from: this.fromEmail,
            to: [toEmail],
            subject: dto.subject,
            html: dto.body,
          }),
        });

        const result = await response.json();
        if (!response.ok) {
          status = 'failed';
          this.logger.error(`Resend API error: ${JSON.stringify(result)}`);
        } else {
          externalId = result.id;
        }
      } catch (err: any) {
        status = 'failed';
        this.logger.error(`Email send error: ${err.message}`);
      }
    } else {
      this.logger.warn('RESEND_API_KEY not set — email logged but not sent');
    }

    await this.prisma.message.create({
      data: {
        workspaceId,
        profileId: dto.profileId,
        channel: 'email',
        subject: dto.subject,
        body: dto.body,
        status,
        externalId,
        sentAt: new Date(),
      },
    });

    return { messageId: externalId, to: toEmail, status };
  }
}
