export interface IndexerEventDto {
  event_id: string;
  event_type: string;
  profile_id?: string;
  address: string;
  data: Record<string, unknown>;
  tx_digest: string;
  timestamp: number;
}
