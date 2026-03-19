import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebAuthnOptions = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebAuthnResponse = any;

export function usePasskeyRegisterOptions() {
  return useMutation({
    mutationFn: () =>
      apiClient.post<WebAuthnOptions>('/auth/passkey/register/options', {}),
  });
}

export function usePasskeyRegisterVerify() {
  return useMutation({
    mutationFn: (data: WebAuthnResponse) =>
      apiClient.post<{ verified: boolean }>('/auth/passkey/register/verify', data),
  });
}

export function usePasskeyLoginOptions() {
  return useMutation({
    mutationFn: () =>
      apiClient.post<WebAuthnOptions>('/auth/passkey/login/options', {}),
  });
}

export function usePasskeyLoginVerify() {
  return useMutation({
    mutationFn: (data: WebAuthnResponse) =>
      apiClient.post<{ success: boolean; user: { address: string } }>('/auth/passkey/login/verify', data),
  });
}
