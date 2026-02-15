import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface SendEmailDto {
  profileId: string;
  to?: string;
  subject: string;
  body: string;
  templateId?: string;
  variables?: Record<string, any>;
}

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async sendMessage(workspaceId: string, dto: SendEmailDto): Promise<any> {
    const toEmail = dto.to || (await this.getEmailForProfile(dto.profileId));

    // TODO: Integrate with email provider (SendGrid, AWS SES, etc.)
    console.log(`Sending email to ${toEmail}:`, dto.subject);

    // In production:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(this.configService.get('SENDGRID_API_KEY'));
    //
    // const msg = {
    //   to: toEmail,
    //   from: this.configService.get('FROM_EMAIL'),
    //   subject: dto.subject,
    //   text: dto.body,
    //   html: dto.body,
    //   templateId: dto.templateId,
    //   dynamicTemplateData: dto.variables,
    // };
    //
    // const result = await sgMail.send(msg);
    // const messageId = result[0].headers['x-message-id'];

    const messageId = `email_${Date.now()}`;

    // Log to database
    await this.prisma.$executeRaw`
      INSERT INTO messages (
        workspace_id, profile_id, channel, subject, body, status, external_id, sent_at
      ) VALUES (${workspaceId}, ${dto.profileId}, 'email', ${dto.subject}, ${dto.body}, 'sent', ${messageId}, now())
    `;

    return {
      messageId,
      to: toEmail,
      status: 'sent',
    };
  }

  private async getEmailForProfile(profileId: string): Promise<string> {
    // TODO: Query profile's email address
    const result = await this.prisma.$queryRaw<Array<{ email: string }>>`
      SELECT email FROM profile_contacts WHERE profile_id = ${profileId}
    `;

    if (result.length === 0 || !result[0].email) {
      throw new Error('No email address linked to profile');
    }

    return result[0].email;
  }
}
