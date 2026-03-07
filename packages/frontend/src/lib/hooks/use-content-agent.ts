import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface GenerateContentParams {
  segmentDescription: string;
  channel: 'telegram' | 'discord' | 'email' | 'x';
  tone: string;
}

export interface GenerateContentResult {
  content: string;
  subject?: string;
}

export function useGenerateContent() {
  return useMutation({
    mutationFn: (data: GenerateContentParams) =>
      apiClient.post<GenerateContentResult>('/agents/content/generate', data),
  });
}
