import { Injectable, Logger } from '@nestjs/common';
import { QuestService } from '../../../quest/quest.service';

@Injectable()
export class AssignQuestAction {
  private readonly logger = new Logger(AssignQuestAction.name);

  constructor(private readonly questService: QuestService) {}

  async execute(profileId: string, config: { questId: string }): Promise<void> {
    try {
      // Check if profile already completed this quest
      const progress = await this.questService.getProgress(config.questId, profileId);
      if (progress.completed) {
        this.logger.log(`Profile ${profileId} already completed quest ${config.questId}`);
        return;
      }
      this.logger.log(`Quest ${config.questId} assigned to profile ${profileId}`);
    } catch (error: any) {
      this.logger.error(`Failed to assign quest: ${error.message}`);
      throw error;
    }
  }
}
