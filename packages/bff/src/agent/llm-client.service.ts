import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { generateText, streamText, stepCountIs, type LanguageModel, type GenerateTextResult, type StreamTextResult, type StopCondition } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';

export interface LlmConfig {
  provider: string;
  apiKey: string;
  model: LanguageModel;
}

@Injectable()
export class LlmClientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
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
    const apiKey =
      config?.apiKeyEncrypted ?? // TODO: Seal decrypt in production
      this.getPlatformKey(provider);

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
    params: { system?: string; prompt: string; tools?: any; maxSteps?: number },
  ): Promise<GenerateTextResult<any, any>> {
    const config = await this.resolveConfig(workspaceId);
    return generateText({
      model: config.model,
      system: params.system,
      prompt: params.prompt,
      tools: params.tools,
      ...(params.maxSteps ? { stopWhen: stepCountIs(params.maxSteps) } : {}),
    });
  }

  async stream(
    workspaceId: string,
    params: { system?: string; prompt: string; tools?: any },
  ): Promise<StreamTextResult<any, any>> {
    const config = await this.resolveConfig(workspaceId);
    return streamText({
      model: config.model,
      system: params.system,
      prompt: params.prompt,
      tools: params.tools,
    });
  }
}
