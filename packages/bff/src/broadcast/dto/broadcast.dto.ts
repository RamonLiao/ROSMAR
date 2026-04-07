import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';

export class CreateBroadcastDto {
  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsArray()
  channels: string[];

  @IsOptional()
  @IsString()
  segmentId?: string;
}

export class UpdateBroadcastDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsArray()
  channels?: string[];

  @IsOptional()
  @IsString()
  segmentId?: string;
}

export class ScheduleBroadcastDto {
  @IsDateString()
  scheduledAt: string;
}
