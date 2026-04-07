import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface GasConfigDto {
  enabled: boolean;
  thresholdMist: string; // BigInt serialized as string for JSON
  dailyLimit: number;
}

const DEFAULTS: GasConfigDto = {
  enabled: false,
  thresholdMist: '100000000', // 0.1 SUI
  dailyLimit: 5,
};

@Injectable()
export class GasConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(workspaceId: string): Promise<GasConfigDto> {
    const config = await this.prisma.workspaceGasConfig.findUnique({
      where: { workspaceId },
    });

    if (!config) return { ...DEFAULTS };

    return {
      enabled: config.enabled,
      thresholdMist: config.thresholdMist.toString(),
      dailyLimit: config.dailyLimit,
    };
  }

  async upsertConfig(
    workspaceId: string,
    dto: Partial<GasConfigDto>,
  ): Promise<GasConfigDto> {
    if (dto.dailyLimit !== undefined && dto.dailyLimit < 0) {
      throw new BadRequestException('dailyLimit must be non-negative');
    }
    if (dto.thresholdMist !== undefined && BigInt(dto.thresholdMist) < 0n) {
      throw new BadRequestException('thresholdMist must be non-negative');
    }

    const data: any = {};
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.thresholdMist !== undefined)
      data.thresholdMist = BigInt(dto.thresholdMist);
    if (dto.dailyLimit !== undefined) data.dailyLimit = dto.dailyLimit;

    const result = await this.prisma.workspaceGasConfig.upsert({
      where: { workspaceId },
      create: { workspaceId, ...data },
      update: data,
    });

    return {
      enabled: result.enabled,
      thresholdMist: result.thresholdMist.toString(),
      dailyLimit: result.dailyLimit,
    };
  }
}
