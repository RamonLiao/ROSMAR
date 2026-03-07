import { IsString, IsOptional, IsObject, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { QuestStepDto } from './quest-step.dto';

export class CreateQuestDto {
  @IsString()
  workspaceId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  rewardType?: string;

  @IsOptional()
  @IsObject()
  rewardConfig?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestStepDto)
  steps: QuestStepDto[];
}
