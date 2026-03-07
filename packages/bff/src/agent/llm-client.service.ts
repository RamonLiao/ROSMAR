import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LlmConfig {
  provider: string;
  apiKey: string;
  model: string;
}

export interface GenerateTextResult {
  text: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface StreamTextResult {
  textStream: AsyncIterable<string>;
  usage: Promise<{ promptTokens: number; completionTokens: number }>;
}

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async resolveConfig(workspaceId: string): Promise<LlmConfig> {
    // TODO: per-workspace config from DB once aiConfig column is added
    return {
      provider: this.configService.get<string>('AI_PROVIDER', 'openai'),
      apiKey: this.configService.get<string>('OPENAI_API_KEY', ''),
      model: this.configService.get<string>('AI_MODEL', 'gpt-4o-mini'),
    };
  }

  async generate(
    workspaceId: string,
    params: { system?: string; prompt: string; tools?: any },
  ): Promise<GenerateTextResult> {
    const config = await this.resolveConfig(workspaceId);
    this.logger.log(`Generating text with ${config.provider}/${config.model}`);

    // TODO: integrate real LLM SDK (openai / anthropic)
    return {
      text: `[LLM response for: ${params.prompt.slice(0, 50)}...]`,
      usage: { promptTokens: 100, completionTokens: 50 },
    };
  }

  async stream(
    workspaceId: string,
    params: { system?: string; prompt: string; tools?: any },
  ): Promise<StreamTextResult> {
    const config = await this.resolveConfig(workspaceId);
    this.logger.log(`Streaming text with ${config.provider}/${config.model}`);

    const text = `[LLM stream for: ${params.prompt.slice(0, 50)}...]`;

    return {
      textStream: (async function* () {
        yield text;
      })(),
      usage: Promise.resolve({ promptTokens: 100, completionTokens: 50 }),
    };
  }
}
