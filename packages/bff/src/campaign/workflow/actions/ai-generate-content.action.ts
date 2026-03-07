import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LlmClientService } from '../../../agent/llm-client.service';

export interface AiGenerateContentConfig {
  prompt: string;
  workspaceId: string;
  channel?: 'telegram' | 'discord' | 'email' | 'x';
  tone?: string;
}

@Injectable()
export class AiGenerateContentAction {
  private readonly logger = new Logger(AiGenerateContentAction.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmClient: LlmClientService,
  ) {}

  async execute(profileId: string, config: AiGenerateContentConfig): Promise<void> {
    const channel = config.channel ?? 'telegram';
    const tone = config.tone ?? 'professional';

    const system = [
      'You are a marketing copywriter for a Web3 CRM platform.',
      `Tone: ${tone}.`,
      `Channel: ${channel}.`,
      'Write compelling marketing copy targeting the described audience segment.',
      'Do NOT include any preamble or explanation — output ONLY the final copy.',
    ].join('\n');

    const result = await this.llmClient.generate(config.workspaceId, {
      system,
      prompt: config.prompt,
    });

    this.logger.log(
      `AI content generated for profile ${profileId}: ${result.text.substring(0, 80)}...`,
    );

    // Store the generated content in the most recent action log's metadata
    const latestLog = await this.prisma.workflowActionLog.findFirst({
      where: { profileId, actionType: 'ai_generate_content' },
      orderBy: { createdAt: 'desc' },
    });

    if (latestLog) {
      await this.prisma.workflowActionLog.update({
        where: { id: latestLog.id },
        data: { metadata: { content: result.text } },
      });
    }
  }
}
