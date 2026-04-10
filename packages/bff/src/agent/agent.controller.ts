import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { RbacGuard, WRITE } from '../auth/guards/rbac.guard';
import { RequirePermissions } from '../auth/decorators/permissions';
import { CurrentUser } from '../auth/decorators/current-user';
import type { UserPayload } from '../auth/auth.service';

export class UpdateAiConfigDto {
  @IsString()
  @IsOptional()
  provider?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsNumber()
  @IsOptional()
  monthlyQuotaUsd?: number;

  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

@Controller('agent')
@UseGuards(SessionGuard, RbacGuard)
export class AgentController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  @Get('config')
  async getConfig(@CurrentUser() user: UserPayload) {
    const config = await this.prisma.workspaceAiConfig.findUnique({
      where: { workspaceId: user.workspaceId },
    });

    if (!config) {
      return {
        provider: 'anthropic',
        hasApiKey: false,
        monthlyQuotaUsd: 10,
        usedQuotaUsd: 0,
        isEnabled: true,
      };
    }

    return {
      provider: config.provider,
      hasApiKey: !!config.apiKeyEncrypted,
      monthlyQuotaUsd: Number(config.monthlyQuotaUsd),
      usedQuotaUsd: Number(config.usedQuotaUsd),
      isEnabled: config.isEnabled,
    };
  }

  @Put('config')
  @RequirePermissions(WRITE)
  async updateConfig(
    @CurrentUser() user: UserPayload,
    @Body() dto: UpdateAiConfigDto,
  ) {
    const data: Record<string, any> = {};
    if (dto.provider !== undefined) data.provider = dto.provider;
    if (dto.apiKey !== undefined) {
      data.apiKeyEncrypted = this.encryption.encrypt(dto.apiKey);
    }
    if (dto.monthlyQuotaUsd !== undefined)
      data.monthlyQuotaUsd = dto.monthlyQuotaUsd;
    if (dto.isEnabled !== undefined) data.isEnabled = dto.isEnabled;

    const config = await this.prisma.workspaceAiConfig.upsert({
      where: { workspaceId: user.workspaceId },
      update: data,
      create: {
        workspaceId: user.workspaceId,
        quotaResetAt: new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          1,
        ),
        ...data,
      },
    });

    return {
      provider: config.provider,
      hasApiKey: !!config.apiKeyEncrypted,
      monthlyQuotaUsd: Number(config.monthlyQuotaUsd),
      usedQuotaUsd: Number(config.usedQuotaUsd),
      isEnabled: config.isEnabled,
    };
  }

  @Get('usage')
  async getUsage(@CurrentUser() user: UserPayload) {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    const logs = await this.prisma.llmUsageLog.findMany({
      where: {
        workspaceId: user.workspaceId,
        createdAt: { gte: startOfMonth },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      logs: logs.map((log) => ({
        id: log.id,
        agentType: log.agentType,
        model: log.model,
        promptTokens: log.promptTokens,
        completionTokens: log.completionTokens,
        estimatedCostUsd: Number(log.estimatedCostUsd),
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }
}
