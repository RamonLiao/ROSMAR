import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class UsageTrackingService {
  private readonly logger = new Logger(UsageTrackingService.name);

  async trackUsage(params: {
    workspaceId: string;
    userId: string;
    agentType: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
  }): Promise<void> {
    const estimatedCost =
      params.promptTokens * 0.00001 + params.completionTokens * 0.00003;

    this.logger.log(
      `Usage tracked: ${params.agentType} — ${params.promptTokens}+${params.completionTokens} tokens (~$${estimatedCost.toFixed(4)})`,
    );

    // TODO: persist to AiUsageLog table once migration is added
  }
}
