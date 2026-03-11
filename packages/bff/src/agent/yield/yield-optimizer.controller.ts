import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IsNumber, IsIn, IsNotEmpty } from 'class-validator';
import { SessionGuard } from '../../auth/guards/session.guard';
import { RbacGuard } from '../../auth/guards/rbac.guard';
import {
  YieldOptimizerService,
  type RiskLevel,
} from './yield-optimizer.service';

export class SuggestStrategyDto {
  @IsNumber()
  @IsNotEmpty()
  balanceSui: number;

  @IsIn(['low', 'medium', 'high'])
  @IsNotEmpty()
  riskTolerance: RiskLevel;
}

@Controller('agent/yield')
@UseGuards(SessionGuard, RbacGuard)
export class YieldOptimizerController {
  constructor(private readonly yieldOptimizer: YieldOptimizerService) {}

  @Get('pools')
  async getPools() {
    return this.yieldOptimizer.getPoolApys();
  }

  @Post('suggest')
  async suggest(@Body() dto: SuggestStrategyDto) {
    return this.yieldOptimizer.suggestStrategy(
      dto.balanceSui,
      dto.riskTolerance,
    );
  }

  @Get('tools')
  getToolDefinitions() {
    return this.yieldOptimizer.getToolDefinitions();
  }
}
