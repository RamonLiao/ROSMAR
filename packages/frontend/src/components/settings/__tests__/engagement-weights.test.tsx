import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EngagementWeights } from "../engagement-weights";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe("EngagementWeights", () => {
  it("renders 5 weight sliders", () => {
    render(<EngagementWeights />, { wrapper: Wrapper });
    expect(screen.getByText("Hold Time")).toBeInTheDocument();
    expect(screen.getByText("TX Count")).toBeInTheDocument();
    expect(screen.getByText("TX Value")).toBeInTheDocument();
    expect(screen.getByText("Vote Count")).toBeInTheDocument();
    expect(screen.getByText("NFT Count")).toBeInTheDocument();
  });

  it("shows weights summing to 1.0", () => {
    render(<EngagementWeights />, { wrapper: Wrapper });
    expect(screen.getByText("Total: 1.0")).toBeInTheDocument();
  });
});
