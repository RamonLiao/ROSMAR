import {
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  IsUUID,
} from 'class-validator';

export class IndexerEventDto {
  @IsString()
  event_id: string;

  @IsString()
  event_type: string;

  @IsOptional()
  @IsUUID()
  profile_id?: string;

  @IsString()
  address: string;

  @IsObject()
  data: Record<string, unknown>;

  @IsString()
  tx_digest: string;

  @IsNumber()
  timestamp: number;
}
