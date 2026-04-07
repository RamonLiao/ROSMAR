import { Injectable } from '@nestjs/common';
import { LlmClientService } from '../llm-client.service';

export type ContentChannel = 'telegram' | 'discord' | 'email' | 'x';

export interface GenerateContentParams {
  workspaceId: string;
  userId: string;
  segmentDescription: string;
  channel: ContentChannel;
  tone: string;
}

export interface GenerateContentResult {
  content: string;
  subject?: string;
}

const CHANNEL_RULES: Record<ContentChannel, string> = {
  telegram:
    'Format: Telegram message. Use markdown formatting. Max 4096 characters. Emoji usage is encouraged. Keep paragraphs short for mobile readability.',
  discord:
    'Format: Discord message. Use markdown formatting. Embed-friendly structure. Can use rich formatting (bold, italic, code blocks, bullet lists). Keep under 2000 chars.',
  x:
    'Format: X/Twitter post. STRICT max 280 characters including hashtags. Suggest 1-3 relevant hashtags. Be concise and punchy.',
  email:
    'Format: Email. Output MUST start with "SUBJECT: <subject line>" followed by "---" on the next line, then the HTML body. Use proper HTML tags (<p>, <h2>, <ul>, etc.).',
};

@Injectable()
export class ContentService {
  constructor(private readonly llmClient: LlmClientService) {}

  async generateContent(
    params: GenerateContentParams,
  ): Promise<GenerateContentResult> {
    const { workspaceId, userId, segmentDescription, channel, tone } = params;

    const system = [
      'You are a marketing copywriter for a Web3 CRM platform.',
      `Tone: ${tone}.`,
      CHANNEL_RULES[channel],
      'Write compelling marketing copy targeting the described audience segment.',
      'Do NOT include any preamble or explanation — output ONLY the final copy.',
    ].join('\n');

    const prompt = `Target audience: ${segmentDescription}\n\nGenerate ${channel} marketing content.`;

    const result = await this.llmClient.generate(workspaceId, {
      system,
      prompt,
      userId,
      agentType: 'content',
    });

    return this.parseResponse(result.text, channel);
  }

  private parseResponse(
    text: string,
    channel: ContentChannel,
  ): GenerateContentResult {
    if (channel === 'email') {
      const subjectMatch = text.match(/^SUBJECT:\s*(.+)/m);
      const subject = subjectMatch?.[1]?.trim();
      const bodyStart = text.indexOf('---');
      const content =
        bodyStart >= 0 ? text.slice(bodyStart + 3).trim() : text;
      return { content, subject };
    }

    return { content: text };
  }
}
