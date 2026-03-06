import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { ProfileModule } from './profile/profile.module';
import { OrganizationModule } from './organization/organization.module';
import { DealModule } from './deal/deal.module';
import { SegmentModule } from './segment/segment.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { CampaignModule } from './campaign/campaign.module';
import { VaultModule } from './vault/vault.module';
import { MessagingModule } from './messaging/messaging.module';
import { NotificationModule } from './notification/notification.module';
import { TicketModule } from './ticket/ticket.module';
import { TestAuthModule } from './auth/test-auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    BlockchainModule,
    WorkspaceModule,
    ProfileModule,
    OrganizationModule,
    DealModule,
    SegmentModule,
    AnalyticsModule,
    CampaignModule,
    VaultModule,
    MessagingModule,
    NotificationModule,
    TicketModule,
    ...(process.env.NODE_ENV === 'test' ? [TestAuthModule] : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
