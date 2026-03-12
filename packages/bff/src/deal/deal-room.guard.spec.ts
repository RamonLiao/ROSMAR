// Mock Prisma to avoid needing generated client
jest.mock('@prisma/client', () => ({ PrismaClient: jest.fn() }));
jest.mock('@prisma/adapter-pg', () => ({ PrismaPg: jest.fn() }));

import { Test } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { DealRoomGuard } from './deal-room.guard';
import { PrismaService } from '../prisma/prisma.service';

function mockContext(params: Record<string, string>, user: any): ExecutionContext {
  const request = { params, user };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('DealRoomGuard', () => {
  let guard: DealRoomGuard;
  let prisma: any;

  const DEAL_ID = 'deal-1';
  const WORKSPACE_ID = 'ws-1';

  const baseDeal = {
    id: DEAL_ID,
    workspaceId: WORKSPACE_ID,
    profile: { wallets: [] as { address: string }[] },
    escrows: [] as any[],
  };

  beforeEach(async () => {
    prisma = {
      deal: { findFirst: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [
        DealRoomGuard,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get(DealRoomGuard);
  });

  // 1. allow deal profile owner (buyer wallet)
  it('should allow deal profile owner by wallet address', async () => {
    prisma.deal.findFirst.mockResolvedValue({
      ...baseDeal,
      profile: { wallets: [{ address: '0xbuyer' }] },
    });

    const ctx = mockContext(
      { id: DEAL_ID },
      { address: '0xbuyer', workspaceId: WORKSPACE_ID, role: 1, permissions: 1 },
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // 2. allow escrow payee (seller)
  it('should allow escrow payee', async () => {
    prisma.deal.findFirst.mockResolvedValue({
      ...baseDeal,
      escrows: [{ payer: '0xpayer', payee: '0xseller', arbitrators: [] }],
    });

    const ctx = mockContext(
      { id: DEAL_ID },
      { address: '0xseller', workspaceId: WORKSPACE_ID, role: 1, permissions: 1 },
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // 3. allow escrow payer
  it('should allow escrow payer', async () => {
    prisma.deal.findFirst.mockResolvedValue({
      ...baseDeal,
      escrows: [{ payer: '0xpayer', payee: '0xpayee', arbitrators: [] }],
    });

    const ctx = mockContext(
      { id: DEAL_ID },
      { address: '0xpayer', workspaceId: WORKSPACE_ID, role: 1, permissions: 1 },
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // 4. allow escrow arbitrator
  it('should allow escrow arbitrator', async () => {
    prisma.deal.findFirst.mockResolvedValue({
      ...baseDeal,
      escrows: [
        {
          payer: '0xpayer',
          payee: '0xpayee',
          arbitrators: [{ address: '0xarb1' }],
        },
      ],
    });

    const ctx = mockContext(
      { id: DEAL_ID },
      { address: '0xarb1', workspaceId: WORKSPACE_ID, role: 1, permissions: 1 },
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  // 5. allow workspace admin (roleLevel >= 3)
  it('should allow workspace admin regardless of participation', async () => {
    // No need for prisma call — admin short-circuits
    const ctx = mockContext(
      { id: DEAL_ID },
      { address: '0xadmin', workspaceId: WORKSPACE_ID, role: 3, permissions: 31 },
    );

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(prisma.deal.findFirst).not.toHaveBeenCalled();
  });

  // 6. deny non-participant
  it('should deny non-participant', async () => {
    prisma.deal.findFirst.mockResolvedValue({
      ...baseDeal,
      profile: { wallets: [{ address: '0xbuyer' }] },
      escrows: [{ payer: '0xpayer', payee: '0xpayee', arbitrators: [] }],
    });

    const ctx = mockContext(
      { id: DEAL_ID },
      { address: '0xrandom', workspaceId: WORKSPACE_ID, role: 1, permissions: 1 },
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  // 7. deny if no escrow and not profile owner
  it('should deny when no escrow exists and user is not profile owner', async () => {
    prisma.deal.findFirst.mockResolvedValue({
      ...baseDeal,
      profile: { wallets: [{ address: '0xbuyer' }] },
      escrows: [],
    });

    const ctx = mockContext(
      { id: DEAL_ID },
      { address: '0xnotbuyer', workspaceId: WORKSPACE_ID, role: 1, permissions: 1 },
    );

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
