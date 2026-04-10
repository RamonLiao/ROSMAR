// Mock ESM blockchain deps before any imports
jest.mock('@mysten/sui/transactions', () => ({ Transaction: jest.fn() }));
jest.mock('@mysten/sui/jsonRpc', () => ({ SuiJsonRpcClient: jest.fn() }));
jest.mock('@mysten/sui/keypairs/ed25519', () => ({
  Ed25519Keypair: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { DealEventListener } from './deal-event.listener';
import { EscrowService } from './escrow.service';
import { NotificationService } from '../notification/notification.service';

describe('DealEventListener', () => {
  let listener: DealEventListener;
  let escrowService: jest.Mocked<EscrowService>;
  let notificationService: jest.Mocked<NotificationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DealEventListener,
        {
          provide: EscrowService,
          useValue: {
            getEscrowByDealId: jest.fn(),
            release: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    listener = module.get(DealEventListener);
    escrowService = module.get(EscrowService);
    notificationService = module.get(NotificationService);
  });

  const basePayload = {
    dealId: 'deal-1',
    stage: 'closed_won',
    workspaceId: 'ws-1',
  };

  it('should release full amount when stage=closed_won and escrow is FUNDED', async () => {
    escrowService.getEscrowByDealId.mockResolvedValue({
      id: 'esc-1',
      state: 'FUNDED',
      totalAmount: 1000 as any,
      releasedAmount: 0 as any,
    } as any);

    await listener.handleStageChange(basePayload);

    expect(escrowService.release).toHaveBeenCalledWith('esc-1', 1000);
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        type: 'escrow_auto_released',
      }),
    );
  });

  it('should not release when no escrow exists', async () => {
    escrowService.getEscrowByDealId.mockResolvedValue(null);

    await listener.handleStageChange(basePayload);

    expect(escrowService.release).not.toHaveBeenCalled();
  });

  it('should not release when escrow is in CREATED state', async () => {
    escrowService.getEscrowByDealId.mockResolvedValue({
      id: 'esc-2',
      state: 'CREATED',
      totalAmount: 500 as any,
      releasedAmount: 0 as any,
    } as any);

    await listener.handleStageChange(basePayload);

    expect(escrowService.release).not.toHaveBeenCalled();
  });

  it('should not release when stage is not closed_won', async () => {
    await listener.handleStageChange({
      ...basePayload,
      stage: 'negotiation',
    });

    expect(escrowService.getEscrowByDealId).not.toHaveBeenCalled();
    expect(escrowService.release).not.toHaveBeenCalled();
  });

  it('should log error but not throw when release fails', async () => {
    escrowService.getEscrowByDealId.mockResolvedValue({
      id: 'esc-3',
      state: 'FUNDED',
      totalAmount: 2000 as any,
      releasedAmount: 0 as any,
    } as any);
    escrowService.release.mockRejectedValue(new Error('chain error'));

    await expect(
      listener.handleStageChange(basePayload),
    ).resolves.not.toThrow();
  });
});
