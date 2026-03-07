import { Controller, Get, Post, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../auth/guards/session.guard';
import { QuestService } from './quest.service';
import { QuestVerificationService } from './quest-verification.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { ClaimStepDto } from './dto/claim-step.dto';

@Controller('quests')
@UseGuards(SessionGuard)
export class QuestController {
  constructor(
    private readonly questService: QuestService,
    private readonly questVerificationService: QuestVerificationService,
  ) {}

  @Post()
  async createQuest(@Body() dto: CreateQuestDto) {
    return this.questService.createQuest(dto);
  }

  @Get()
  async listQuests(@Query('workspaceId') workspaceId: string) {
    return this.questService.listQuests(workspaceId);
  }

  @Get(':id')
  async getQuest(@Param('id') id: string) {
    return this.questService.getQuest(id);
  }

  @Put(':id')
  async updateQuest(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; isActive?: boolean },
  ) {
    return this.questService.updateQuest(id, body);
  }

  @Post(':id/steps/:stepId/claim')
  async claimStep(
    @Param('id') questId: string,
    @Param('stepId') stepId: string,
    @Body() dto: ClaimStepDto,
  ) {
    return this.questVerificationService.claimStep(
      questId,
      stepId,
      dto.profileId,
      dto.claimData,
    );
  }

  @Get(':id/progress/:profileId')
  async getProgress(
    @Param('id') questId: string,
    @Param('profileId') profileId: string,
  ) {
    return this.questService.getProgress(questId, profileId);
  }
}
