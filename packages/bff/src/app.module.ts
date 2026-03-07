import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
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
import { WebhookModule } from './webhook/webhook.module';
import { AutoTagModule } from './auto-tag/auto-tag.module';
import { EngagementModule } from './engagement/engagement.module';
import { AgentModule } from './agent/agent.module';
import { SocialModule } from './social/social.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { QuestModule } from './quest/quest.module';
import { GdprModule } from './gdpr/gdpr.module';
import { CacheModule } from './common/cache/cache.module';
import { HealthModule } from './common/health/health.module';
import { LoggingModule } from './common/logging/logging.module';
import { ThrottleConfig } from './common/throttle/throttle.config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ThrottleConfig,
    PrismaModule,
    CacheModule,
    HealthModule,
    LoggingModule,
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
    WebhookModule,
    AutoTagModule,
    EngagementModule,
    AgentModule,
    SocialModule,
    BroadcastModule,
    QuestModule,
    GdprModule,
    ...(process.env.NODE_ENV === 'test' ? [TestAuthModule] : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
