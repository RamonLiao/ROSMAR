import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SolanaResolverService } from './solana-resolver.service';

// Mock @solana/web3.js
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({})),
  PublicKey: jest.fn().mockImplementation((key: string) => ({
    toBase58: () => key,
    toBuffer: () => Buffer.from(key),
    toString: () => key,
  })),
}));

// Mock @bonfida/spl-name-service — use factory that returns fresh jest.fn()
jest.mock('@bonfida/spl-name-service', () => ({
  resolve: jest.fn(),
  performReverseLookup: jest.fn(),
}));

// Import after mock registration
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bonfida = require('@bonfida/spl-name-service');

describe('SolanaResolverService', () => {
  let service: SolanaResolverService;

  beforeEach(async () => {
    (bonfida.resolve as jest.Mock).mockReset();
    (bonfida.performReverseLookup as jest.Mock).mockReset();

    const module = await Test.createTestingModule({
      providers: [
        SolanaResolverService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, defaultVal?: string) => {
              const map: Record<string, string> = {
                SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
              };
              return map[key] ?? defaultVal ?? '';
            },
          },
        },
      ],
    }).compile();

    service = module.get(SolanaResolverService);
  });

  describe('resolveSns', () => {
    it('should resolve .sol name to address', async () => {
      const mockPubkey = {
        toBase58: () => 'SoLANAaDdReSS111111111111111111111111111111',
      };
      (bonfida.resolve as jest.Mock).mockResolvedValue(mockPubkey);
      const result = await service.resolveSns('bonfida.sol');
      expect(result).toBe('SoLANAaDdReSS111111111111111111111111111111');
    });

    it('should strip .sol suffix before resolving', async () => {
      const mockPubkey = { toBase58: () => 'addr123' };
      (bonfida.resolve as jest.Mock).mockResolvedValue(mockPubkey);
      await service.resolveSns('bonfida.sol');
      expect(bonfida.resolve).toHaveBeenCalledWith(
        expect.anything(),
        'bonfida',
      );
    });

    it('should return null for unregistered SNS name', async () => {
      (bonfida.resolve as jest.Mock).mockRejectedValue(
        new Error('Name not found'),
      );
      const result = await service.resolveSns('nonexistent12345.sol');
      expect(result).toBeNull();
    });

    it('should return null on connection error', async () => {
      (bonfida.resolve as jest.Mock).mockRejectedValue(
        new Error('connection timeout'),
      );
      const result = await service.resolveSns('broken.sol');
      expect(result).toBeNull();
    });
  });

  describe('lookupAddress', () => {
    it('should reverse-lookup address to .sol name', async () => {
      (bonfida.performReverseLookup as jest.Mock).mockResolvedValue('bonfida');
      const result = await service.lookupAddress(
        'SoLANAaDdReSS111111111111111111111111111111',
      );
      expect(result).toBe('bonfida.sol');
    });

    it('should return null for address without reverse record', async () => {
      (bonfida.performReverseLookup as jest.Mock).mockRejectedValue(
        new Error('not found'),
      );
      const result = await service.lookupAddress(
        'NoReverseSolAddr1111111111111111111111111111',
      );
      expect(result).toBeNull();
    });
  });
});
