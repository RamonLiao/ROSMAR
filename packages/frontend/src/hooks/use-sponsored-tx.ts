import { useSignTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import { useSuiClient } from "@mysten/dapp-kit";
import { apiClient } from "@/lib/api/client";
import { useCallback, useState } from "react";

interface UseSponsoredTxOptions {
  allowedMoveCallTargets?: string[];
  allowedAddresses?: string[];
}

interface SponsorResponse {
  success: boolean;
  data: { bytes: string; digest: string };
}

export function useSponsoredTx() {
  const client = useSuiClient();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const [isPending, setIsPending] = useState(false);

  const executeSponsoredTx = useCallback(
    async (tx: Transaction, opts?: UseSponsoredTxOptions) => {
      setIsPending(true);
      try {
        // Build TX kind bytes client-side
        const kindBytes = await tx.build({
          client,
          onlyTransactionKind: true,
        });

        // Request sponsorship from BFF (sender derived from session server-side)
        const res = await apiClient.post<SponsorResponse>(
          "/sponsor/create",
          {
            transactionKindBytes: toBase64(kindBytes),
            allowedMoveCallTargets: opts?.allowedMoveCallTargets,
            allowedAddresses: opts?.allowedAddresses,
          },
        );

        // Sign the sponsored TX bytes
        const { signature } = await signTransaction({
          transaction: Transaction.from(res.data.bytes),
        });

        // Execute via BFF
        await apiClient.post("/sponsor/execute", {
          digest: res.data.digest,
          signature,
        });

        return { digest: res.data.digest };
      } finally {
        setIsPending(false);
      }
    },
    [client, signTransaction],
  );

  return { executeSponsoredTx, isPending };
}
