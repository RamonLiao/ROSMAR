import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuestDto } from './dto/create-quest.dto';

@Injectable()
export class QuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createQuest(dto: CreateQuestDto) {
    return this.prisma.$transaction(async (tx) => {
      const quest = await tx.quest.create({
        data: {
          workspaceId: dto.workspaceId,
          name: dto.name,
          description: dto.description,
          rewardType: dto.rewardType || 'BADGE',
          rewardConfig: (dto.rewardConfig || {}) as Prisma.InputJsonValue,
        },
      });

      for (let i = 0; i < dto.steps.length; i++) {
        const step = dto.steps[i];
        await tx.questStep.create({
          data: {
            questId: quest.id,
            orderIndex: i,
            title: step.title,
            description: step.description,
            actionType: step.actionType,
            actionConfig: (step.actionConfig || {}) as Prisma.InputJsonValue,
            verificationMethod: step.verificationMethod || 'INDEXER',
            chain: step.chain || 'SUI',
          },
        });
      }

      return quest;
    });
  }

  async listQuests(workspaceId: string) {
    return this.prisma.quest.findMany({
      where: { workspaceId, isActive: true },
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { completions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuest(questId: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
      include: {
        steps: { orderBy: { orderIndex: 'asc' } },
        _count: { select: { completions: true } },
      },
    });

    if (!quest) {
      throw new NotFoundException(`Quest ${questId} not found`);
    }

    return quest;
  }

  async updateQuest(questId: string, data: { name?: string; description?: string; isActive?: boolean }) {
    return this.prisma.quest.update({
      where: { id: questId },
      data,
    });
  }

  async getProgress(questId: string, profileId: string) {
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
      include: {
        steps: {
          orderBy: { orderIndex: 'asc' },
          include: {
            stepCompletions: {
              where: { profileId },
            },
          },
        },
      },
    });

    if (!quest) {
      throw new NotFoundException(`Quest ${questId} not found`);
    }

    const questCompletion = await this.prisma.questCompletion.findUnique({
      where: { questId_profileId: { questId, profileId } },
    });

    return {
      questId,
      profileId,
      completed: !!questCompletion,
      completedAt: questCompletion?.completedAt ?? null,
      steps: quest.steps.map((step) => ({
        id: step.id,
        title: step.title,
        orderIndex: step.orderIndex,
        completed: step.stepCompletions.length > 0,
        completedAt: step.stepCompletions[0]?.completedAt ?? null,
      })),
    };
  }

  async completeQuest(questId: string, profileId: string, badgeSuiId?: string) {
    const completion = await this.prisma.questCompletion.upsert({
      where: { questId_profileId: { questId, profileId } },
      create: { questId, profileId, badgeSuiId },
      update: {},
    });

    this.eventEmitter.emit('quest.completed', { questId, profileId });

    return completion;
  }
}
