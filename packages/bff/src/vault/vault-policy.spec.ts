import { Test } from '@nestjs/testing';
import { VaultService } from './vault.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalrusClient } from './walrus.client';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

// Mock SuiClientService module to avoid ESM import issues
jest.mock('../blockchain/sui.client', () => ({
  SuiClientService: jest.fn().mockImplementation(() => ({
    getObject: jest.fn(),
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SuiClientService } = require('../blockchain/sui.client');

describe('VaultService — Policy Enforcement', () => {
  let service: VaultService;
  let prisma: any;
  let suiClient: any;

  beforeEach(async () => {
    prisma = {
      workspaceMember: {
        findUnique: jest.fn().mockResolvedValue({
          workspaceId: 'ws1',
          address: '0xcaller',
          roleLevel: 1,
          permissions: 31,
        }),
      },
      vaultSecret: { findUnique: jest.fn() },
      vaultAccessLog: { create: jest.fn() },
    };

    suiClient = {
      getObject: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        VaultService,
        { provide: PrismaService, useValue: prisma },
        { provide: SuiClientService, useValue: suiClient },
        { provide: WalrusClient, useValue: {} },
        { provide: ConfigService, useValue: { get: () => '' } },
      ],
    }).compile();

    service = module.get(VaultService);
  });

  it('should allow access for RULE_WORKSPACE_MEMBER if caller is member', async () => {
    await expect(
      service.verifyPolicyAccess('ws1', '0xcaller', null),
    ).resolves.not.toThrow();
  });

  it('should allow access for RULE_SPECIFIC_ADDRESS if caller in list', async () => {
    suiClient.getObject.mockResolvedValue({
      data: {
        content: {
          fields: {
            rule_type: 1,
            allowed_addresses: ['0xcaller', '0xother'],
            min_role_level: 0,
          },
        },
      },
    });

    await expect(
      service.verifyPolicyAccess('ws1', '0xcaller', '0xpolicy123'),
    ).resolves.not.toThrow();
  });

  it('should reject for RULE_SPECIFIC_ADDRESS if caller not in list', async () => {
    suiClient.getObject.mockResolvedValue({
      data: {
        content: {
          fields: {
            rule_type: 1,
            allowed_addresses: ['0xother'],
            min_role_level: 0,
          },
        },
      },
    });

    await expect(
      service.verifyPolicyAccess('ws1', '0xcaller', '0xpolicy123'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject for RULE_ROLE_BASED if role too low', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      roleLevel: 0,
      permissions: 31,
    });

    suiClient.getObject.mockResolvedValue({
      data: {
        content: {
          fields: {
            rule_type: 2,
            allowed_addresses: [],
            min_role_level: 2,
          },
        },
      },
    });

    await expect(
      service.verifyPolicyAccess('ws1', '0xcaller', '0xpolicy123'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should allow RULE_ROLE_BASED if role meets minimum', async () => {
    suiClient.getObject.mockResolvedValue({
      data: {
        content: {
          fields: {
            rule_type: 2,
            allowed_addresses: [],
            min_role_level: 1,
          },
        },
      },
    });

    await expect(
      service.verifyPolicyAccess('ws1', '0xcaller', '0xpolicy123'),
    ).resolves.not.toThrow();
  });

  it('should reject if not a workspace member', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue(null);

    await expect(
      service.verifyPolicyAccess('ws1', '0xstranger', null),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('should reject if member lacks MANAGE permission', async () => {
    prisma.workspaceMember.findUnique.mockResolvedValue({
      roleLevel: 1,
      permissions: 1,
    });

    await expect(
      service.verifyPolicyAccess('ws1', '0xcaller', null),
    ).rejects.toThrow(UnauthorizedException);
  });
});
