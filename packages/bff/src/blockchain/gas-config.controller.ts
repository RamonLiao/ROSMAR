import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { GasConfigService, GasConfigDto } from './gas-config.service';
import { SessionGuard } from '../auth/guards/session.guard';
import { IsBoolean, IsOptional, IsString, IsInt, Min } from 'class-validator';

export class UpdateGasConfigDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  thresholdMist?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  dailyLimit?: number;
}

@Controller('workspaces/:workspaceId/gas-config')
@UseGuards(SessionGuard)
export class GasConfigController {
  constructor(private readonly gasConfigService: GasConfigService) {}

  @Get()
  async getConfig(
    @Param('workspaceId') workspaceId: string,
  ): Promise<GasConfigDto> {
    return this.gasConfigService.getConfig(workspaceId);
  }

  @Put()
  async updateConfig(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: UpdateGasConfigDto,
  ): Promise<GasConfigDto> {
    return this.gasConfigService.upsertConfig(workspaceId, dto);
  }
}
