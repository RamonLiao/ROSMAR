import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { EnokiSponsorService } from './enoki-sponsor.service';
import { SuiClientService } from './sui.client';
import { SessionGuard } from '../auth/guards/session.guard';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';

export class SponsorTxDto {
  @IsString()
  @IsNotEmpty()
  transactionKindBytes: string; // base64-encoded TX kind bytes from client

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedMoveCallTargets?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowedAddresses?: string[];
}

export class ExecuteSponsoredTxDto {
  @IsString()
  @IsNotEmpty()
  digest: string;

  @IsString()
  @IsNotEmpty()
  signature: string;
}

@Controller('sponsor')
export class SponsorController {
  constructor(
    private readonly sponsorService: EnokiSponsorService,
    private readonly suiClient: SuiClientService,
  ) {}

  @Post('create')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async sponsorTransaction(@Body() dto: SponsorTxDto, @Req() req: any) {
    // Use sender from authenticated session, not from request body
    const sender: string = req.user.address;

    const kindBytes = fromBase64(dto.transactionKindBytes);
    const tx = Transaction.fromKind(kindBytes);

    const result = await this.sponsorService.sponsorTransaction(
      tx,
      sender,
      this.suiClient.getClient(),
      {
        allowedMoveCallTargets: dto.allowedMoveCallTargets,
        allowedAddresses: dto.allowedAddresses,
      },
    );

    return { success: true, data: result };
  }

  @Post('execute')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async executeSponsoredTransaction(@Body() dto: ExecuteSponsoredTxDto) {
    await this.sponsorService.executeSponsoredTransaction(
      dto.digest,
      dto.signature,
    );

    return { success: true };
  }
}
