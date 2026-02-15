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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
