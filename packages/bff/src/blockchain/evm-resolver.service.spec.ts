import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EvmResolverService } from './evm-resolver.service';

// Mock ethers to avoid ESM/network issues in tests
jest.mock('ethers', () => {
  const mockResolveName = jest.fn();
  const mockLookupAddress = jest.fn();
  return {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      resolveName: mockResolveName,
      lookupAddress: mockLookupAddress,
    })),
    __mockResolveName: mockResolveName,
    __mockLookupAddress: mockLookupAddress,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ethers = require('ethers');

describe('EvmResolverService', () => {
  let service: EvmResolverService;
  let mockResolveName: jest.Mock;
  let mockLookupAddress: jest.Mock;

  beforeEach(async () => {
    mockResolveName = ethers.__mockResolveName;
    mockLookupAddress = ethers.__mockLookupAddress;
    mockResolveName.mockReset();
    mockLookupAddress.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        EvmResolverService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultVal?: string) => {
              const map: Record<string, string> = {
                EVM_RPC_URL: 'https://eth.llamarpc.com',
              };
              return map[key] ?? defaultVal ?? '';
            },
          },
        },
      ],
    }).compile();

    service = module.get(EvmResolverService);
  });

  describe('resolveEns', () => {
    it('should resolve ENS name to address', async () => {
      mockResolveName.mockResolvedValue(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      const result = await service.resolveEns('vitalik.eth');
      expect(result).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(mockResolveName).toHaveBeenCalledWith('vitalik.eth');
    });

    it('should return null for unregistered ENS name', async () => {
      mockResolveName.mockResolvedValue(null);
      const result = await service.resolveEns('nonexistent12345.eth');
      expect(result).toBeNull();
    });

    it('should return null on provider error', async () => {
      mockResolveName.mockRejectedValue(new Error('network error'));
      const result = await service.resolveEns('broken.eth');
      expect(result).toBeNull();
    });
  });

  describe('lookupAddress', () => {
    it('should reverse-resolve address to ENS name', async () => {
      mockLookupAddress.mockResolvedValue('vitalik.eth');
      const result = await service.lookupAddress(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
      expect(result).toBe('vitalik.eth');
      expect(mockLookupAddress).toHaveBeenCalledWith(
        '0x1234567890abcdef1234567890abcdef12345678',
      );
    });

    it('should return null for address without reverse record', async () => {
      mockLookupAddress.mockResolvedValue(null);
      const result = await service.lookupAddress(
        '0xdeadbeef00000000000000000000000000000000',
      );
      expect(result).toBeNull();
    });

    it('should return null on provider error', async () => {
      mockLookupAddress.mockRejectedValue(new Error('network error'));
      const result = await service.lookupAddress(
        '0xdeadbeef00000000000000000000000000000000',
      );
      expect(result).toBeNull();
    });
  });
});
