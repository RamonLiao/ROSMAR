import { TimeElapsedProcessor } from './time-elapsed.processor';

// Mock WorkflowEngine to avoid transitive @mysten/sui imports
jest.mock('../workflow/workflow.engine', () => ({
  WorkflowEngine: jest.fn().mockImplementation(() => ({
    startWorkflow: jest.fn(),
  })),
}));

describe('TimeElapsedProcessor', () => {
  let processor: TimeElapsedProcessor;
  let prisma: any;
  let workflowEngine: any;

  beforeEach(() => {
    prisma = {
      campaignTrigger: { findMany: jest.fn() },
      profile: { findMany: jest.fn() },
    };
    workflowEngine = { startWorkflow: jest.fn() };

    processor = new TimeElapsedProcessor(prisma, workflowEngine);
  });

  // ─── parseDuration ──────────────────────────────────────
  describe('parseDuration', () => {
    it('parses minutes', () => {
      expect(TimeElapsedProcessor.parseDuration('30m')).toBe(30 * 60_000);
    });

    it('parses hours', () => {
      expect(TimeElapsedProcessor.parseDuration('2h')).toBe(2 * 3_600_000);
    });

    it('parses days', () => {
      expect(TimeElapsedProcessor.parseDuration('7d')).toBe(7 * 86_400_000);
    });

    it('returns 0 for invalid format', () => {
      expect(TimeElapsedProcessor.parseDuration('abc')).toBe(0);
      expect(TimeElapsedProcessor.parseDuration('')).toBe(0);
      expect(TimeElapsedProcessor.parseDuration('10x')).toBe(0);
    });
  });

  // ─── process ────────────────────────────────────────────
  describe('process', () => {
    const makeTrigger = (overrides = {}) => ({
      id: 'trigger-1',
      campaignId: 'campaign-1',
      triggerType: 'time_elapsed',
      triggerConfig: { field: 'createdAt', operator: 'gt', value: '7d' },
      isEnabled: true,
      campaign: {
        id: 'campaign-1',
        status: 'active',
        segmentId: 'seg-1',
        workflowSteps: [{ type: 'send_telegram', config: {} }],
      },
      ...overrides,
    });

    it('should trigger workflow for matching profiles', async () => {
      prisma.campaignTrigger.findMany.mockResolvedValue([makeTrigger()]);
      prisma.profile.findMany.mockResolvedValue([
        { id: 'profile-1' },
        { id: 'profile-2' },
      ]);

      await processor.process({} as any);

      expect(prisma.profile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            segmentMemberships: { some: { segmentId: 'seg-1' } },
            NOT: { workflowExecutions: { some: { campaignId: 'campaign-1' } } },
          }),
          select: { id: true },
          take: 100,
        }),
      );

      expect(workflowEngine.startWorkflow).toHaveBeenCalledWith(
        'campaign-1',
        [{ type: 'send_telegram', config: {} }],
        ['profile-1', 'profile-2'],
      );
    });

    it('should NOT trigger when no profiles match', async () => {
      prisma.campaignTrigger.findMany.mockResolvedValue([makeTrigger()]);
      prisma.profile.findMany.mockResolvedValue([]);

      await processor.process({} as any);

      expect(workflowEngine.startWorkflow).not.toHaveBeenCalled();
    });

    it('should skip inactive campaigns', async () => {
      prisma.campaignTrigger.findMany.mockResolvedValue([
        makeTrigger({
          campaign: { ...makeTrigger().campaign, status: 'draft' },
        }),
      ]);

      await processor.process({} as any);

      expect(prisma.profile.findMany).not.toHaveBeenCalled();
      expect(workflowEngine.startWorkflow).not.toHaveBeenCalled();
    });

    it('should skip triggers with invalid duration', async () => {
      prisma.campaignTrigger.findMany.mockResolvedValue([
        makeTrigger({
          triggerConfig: { field: 'createdAt', operator: 'gt', value: 'bad' },
        }),
      ]);

      await processor.process({} as any);

      expect(prisma.profile.findMany).not.toHaveBeenCalled();
      expect(workflowEngine.startWorkflow).not.toHaveBeenCalled();
    });

    it('should handle zero triggers', async () => {
      prisma.campaignTrigger.findMany.mockResolvedValue([]);

      await processor.process({} as any);

      expect(workflowEngine.startWorkflow).not.toHaveBeenCalled();
    });
  });
});
