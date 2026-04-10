import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QuestService } from './quest.service';
import { IndexerVerifier } from './verifiers/indexer.verifier';
import { RpcVerifier } from './verifiers/rpc.verifier';
import { ManualVerifier } from './verifiers/manual.verifier';
import { StepVerifier } from './verifiers/step-verifier.interface';

@Injectable()
export class QuestVerificationService {
  private verifiers: Map<string, StepVerifier>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly questService: QuestService,
    private readonly indexerVerifier: IndexerVerifier,
    private readonly rpcVerifier: RpcVerifier,
    private readonly manualVerifier: ManualVerifier,
  ) {
    this.verifiers = new Map<string, StepVerifier>();
    this.verifiers.set('INDEXER', this.indexerVerifier);
    this.verifiers.set('RPC', this.rpcVerifier);
    this.verifiers.set('MANUAL', this.manualVerifier);
  }

  async claimStep(
    questId: string,
    stepId: string,
    profileId: string,
    claimData: Record<string, unknown> = {},
  ) {
    // Verify quest exists
    const quest = await this.prisma.quest.findUnique({
      where: { id: questId },
      include: { steps: true },
    });

    if (!quest) {
      throw new NotFoundException(`Quest ${questId} not found`);
    }

    const step = quest.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundException(
        `Step ${stepId} not found in quest ${questId}`,
      );
    }

    // Check if already completed
    const existing = await this.prisma.questStepCompletion.findUnique({
      where: { stepId_profileId: { stepId, profileId } },
    });

    if (existing) {
      return { status: 'already_completed', completion: existing };
    }

    // Run verifier
    const verifier = this.verifiers.get(step.verificationMethod);
    if (!verifier) {
      throw new Error(
        `Unknown verification method: ${step.verificationMethod}`,
      );
    }

    const result = await verifier.verify(
      profileId,
      {
        actionType: step.actionType,
        actionConfig: step.actionConfig as Record<string, unknown>,
      },
      claimData,
    );

    if (!result.verified) {
      return { status: 'pending', verified: false };
    }

    // Create step completion
    const completion = await this.prisma.questStepCompletion.create({
      data: {
        stepId,
        profileId,
        txDigest: result.txDigest,
        verifiedBy: step.verificationMethod,
      },
    });

    // Check if all steps are now completed
    const totalSteps = quest.steps.length;
    const completedSteps = await this.prisma.questStepCompletion.count({
      where: {
        profileId,
        step: { questId },
      },
    });

    if (completedSteps >= totalSteps) {
      await this.questService.completeQuest(questId, profileId);
      return { status: 'quest_completed', completion };
    }

    return { status: 'step_completed', completion };
  }
}
