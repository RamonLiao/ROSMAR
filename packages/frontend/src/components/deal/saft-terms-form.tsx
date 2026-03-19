"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const saftTermsSchema = z.object({
  tokenSymbol: z.string().min(1, "Token symbol is required"),
  totalTokens: z.coerce.number().positive("Must be positive"),
  pricePerToken: z.coerce.number().positive("Must be positive"),
  cliffMonths: z.coerce.number().int().min(0, "Must be >= 0"),
  vestingMonths: z.coerce.number().int().positive("Must be positive"),
  jurisdiction: z.string().min(1, "Jurisdiction is required"),
});

export type SaftTerms = z.infer<typeof saftTermsSchema>;

interface SaftTermsFormProps {
  initialValues?: Partial<SaftTerms>;
  onSubmit: (terms: SaftTerms) => void;
}

export function SaftTermsForm({ initialValues, onSubmit }: SaftTermsFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(saftTermsSchema),
    defaultValues: {
      tokenSymbol: "",
      totalTokens: undefined,
      pricePerToken: undefined,
      cliffMonths: 0,
      vestingMonths: undefined,
      jurisdiction: "",
      ...initialValues,
    },
  });

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data as SaftTerms))} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="tokenSymbol">Token Symbol</Label>
          <Input id="tokenSymbol" {...register("tokenSymbol")} />
          {errors.tokenSymbol && (
            <p className="text-xs text-destructive">{errors.tokenSymbol.message}</p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="totalTokens">Total Tokens</Label>
          <Input id="totalTokens" type="number" {...register("totalTokens")} />
          {errors.totalTokens && (
            <p className="text-xs text-destructive">{errors.totalTokens.message}</p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="pricePerToken">Price per Token</Label>
          <Input id="pricePerToken" type="number" step="0.0001" {...register("pricePerToken")} />
          {errors.pricePerToken && (
            <p className="text-xs text-destructive">{errors.pricePerToken.message}</p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="cliffMonths">Cliff (months)</Label>
          <Input id="cliffMonths" type="number" {...register("cliffMonths")} />
          {errors.cliffMonths && (
            <p className="text-xs text-destructive">{errors.cliffMonths.message}</p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="vestingMonths">Vesting (months)</Label>
          <Input id="vestingMonths" type="number" {...register("vestingMonths")} />
          {errors.vestingMonths && (
            <p className="text-xs text-destructive">{errors.vestingMonths.message}</p>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="jurisdiction">Jurisdiction</Label>
          <Input id="jurisdiction" {...register("jurisdiction")} />
          {errors.jurisdiction && (
            <p className="text-xs text-destructive">{errors.jurisdiction.message}</p>
          )}
        </div>
      </div>

      <div>
        <Button type="button" variant="outline" size="sm" disabled>
          Upload Signed PDF (Walrus)
        </Button>
      </div>

      <Button type="submit">Save SAFT Terms</Button>
    </form>
  );
}
