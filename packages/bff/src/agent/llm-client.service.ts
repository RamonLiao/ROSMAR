import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { UsageTrackingService } from './usage-tracking.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import {
  generateText,
  streamText,
  stepCountIs,
  type LanguageModel,
  type GenerateTextResult,
  type StreamTextResult,
  type StopCondition,
} from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export interface LlmConfig {
  provider: string;
  apiKey: string;
  model: LanguageModel;
}

export interface LlmCallParams {
  system?: string;
  prompt: string;
  tools?: any;
  maxSteps?: number;
  userId: string;
  agentType: string;
}

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly usageTracking: UsageTrackingService,
    private readonly encryption: EncryptionService,
  ) {}

  async resolveConfig(workspaceId: string): Promise<LlmConfig> {
    const config = await this.prisma.workspaceAiConfig.findUnique({
      where: { workspaceId },
    });

    // Check quota (only for platform-key users; BYOK users pay their own way)
    if (
      config &&
      !config.apiKeyEncrypted &&
      Number(config.usedQuotaUsd) >= Number(config.monthlyQuotaUsd)
    ) {
      throw new ForbiddenException('AI quota exceeded for this workspace');
    }

    const provider = config?.provider ?? 'anthropic';
    const apiKey = config?.apiKeyEncrypted
      ? this.encryption.decrypt(config.apiKeyEncrypted)
      : this.getPlatformKey(provider);

    return {
      provider,
      apiKey,
      model: this.createModel(provider, apiKey),
    };
  }

  private getPlatformKey(provider: string): string {
    const keyMap: Record<string, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
    };
    return this.configService.get<string>(
      keyMap[provider] ?? 'ANTHROPIC_API_KEY',
      '',
    );
  }

  private createModel(provider: string, apiKey: string): LanguageModel {
    if (provider === 'openai') {
      const openai = createOpenAI({ apiKey });
      return openai('gpt-4o');
    }
    const anthropic = createAnthropic({ apiKey });
    return anthropic('claude-sonnet-4-20250514');
  }

  async generate(
    workspaceId: string,
    params: LlmCallParams,
  ): Promise<GenerateTextResult<any, any>> {
    const config = await this.resolveConfig(workspaceId);
    const result = await generateText({
      model: config.model,
      system: params.system,
      prompt: params.prompt,
      tools: params.tools,
      ...(params.maxSteps ? { stopWhen: stepCountIs(params.maxSteps) } : {}),
    });

    // Fire-and-forget usage tracking
    this.trackFromResult(workspaceId, params, result).catch((err) =>
      this.logger.warn('Usage tracking failed', err),
    );

    return result;
  }

  async stream(
    workspaceId: string,
    params: LlmCallParams,
  ): Promise<StreamTextResult<any, any>> {
    const config = await this.resolveConfig(workspaceId);
    const result = streamText({
      model: config.model,
      system: params.system,
      prompt: params.prompt,
      tools: params.tools,
    });

    // Track usage after stream completes
    result.usage.then((usage) =>
      this.usageTracking
        .trackUsage({
          workspaceId,
          userId: params.userId,
          agentType: params.agentType,
          model: (config.model as any).modelId ?? 'unknown',
          promptTokens: usage.inputTokens ?? 0,
          completionTokens: usage.outputTokens ?? 0,
        })
        .catch((err) => this.logger.warn('Usage tracking failed', err)),
    );

    return result;
  }

  private async trackFromResult(
    workspaceId: string,
    params: LlmCallParams,
    result: GenerateTextResult<any, any>,
  ): Promise<void> {
    await this.usageTracking.trackUsage({
      workspaceId,
      userId: params.userId,
      agentType: params.agentType,
      model: result.response?.modelId ?? 'unknown',
      promptTokens: (result.usage as any)?.inputTokens ?? (result.usage as any)?.promptTokens ?? 0,
      completionTokens: (result.usage as any)?.outputTokens ?? (result.usage as any)?.completionTokens ?? 0,
    });
  }
}
