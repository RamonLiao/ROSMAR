import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { SessionGuard } from '../auth/guards/session.guard';
import {
  RbacGuard,
  RequirePermissions,
  WRITE,
} from '../auth/guards/rbac.guard';
import { DealRoomGuard } from './deal-room.guard';
import { User } from '../auth/decorators/user.decorator';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { ReleaseDto, VoteDto, AddVestingDto } from './dto/escrow-action.dto';

@Controller('deals/:dealId/escrow')
@UseGuards(SessionGuard, RbacGuard, DealRoomGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  @RequirePermissions(WRITE)
  async create(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('dealId') dealId: string,
    @Body() dto: CreateEscrowDto,
  ) {
    return this.escrowService.createEscrow(user.workspaceId, dealId, dto);
  }

  @Post('fund')
  @RequirePermissions(WRITE)
  async fund(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('dealId') dealId: string,
  ) {
    const escrow = await this.escrowService.getEscrowByDealId(dealId);
    return this.escrowService.fundEscrow(escrow!.id, user.address);
  }

  @Post('release')
  @RequirePermissions(WRITE)
  async release(@Param('dealId') dealId: string, @Body() dto: ReleaseDto) {
    const escrow = await this.escrowService.getEscrowByDealId(dealId);
    return this.escrowService.release(escrow!.id, dto.amount);
  }

  @Post('refund')
  @RequirePermissions(WRITE)
  async refund(@Param('dealId') dealId: string) {
    const escrow = await this.escrowService.getEscrowByDealId(dealId);
    return this.escrowService.refund(escrow!.id);
  }

  @Post('dispute')
  @RequirePermissions(WRITE)
  async dispute(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('dealId') dealId: string,
  ) {
    const escrow = await this.escrowService.getEscrowByDealId(dealId);
    return this.escrowService.raiseDispute(escrow!.id, user.address);
  }

  @Post('dispute/vote')
  @RequirePermissions(WRITE)
  async vote(
    @User() user: import('../auth/auth.service').UserPayload,
    @Param('dealId') dealId: string,
    @Body() dto: VoteDto,
  ) {
    const escrow = await this.escrowService.getEscrowByDealId(dealId);
    return this.escrowService.voteOnDispute(
      escrow!.id,
      user.address,
      dto.decision,
    );
  }

  @Get()
  async get(@Param('dealId') dealId: string) {
    return this.escrowService.getEscrowByDealId(dealId);
  }

  @Post('vesting')
  @RequirePermissions(WRITE)
  async addVesting(
    @Param('dealId') dealId: string,
    @Body() dto: AddVestingDto,
  ) {
    const escrow = await this.escrowService.getEscrowByDealId(dealId);
    return this.escrowService.addVesting(escrow!.id, dto);
  }

  @Post('milestone/:idx/complete')
  @RequirePermissions(WRITE)
  async completeMilestone(
    @Param('dealId') dealId: string,
    @Param('idx', ParseIntPipe) idx: number,
  ) {
    const escrow = await this.escrowService.getEscrowByDealId(dealId);
    return this.escrowService.completeMilestone(escrow!.id, idx);
  }
}
