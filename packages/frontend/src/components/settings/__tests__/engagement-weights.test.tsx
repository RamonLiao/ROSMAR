import { render, screen } from "@testing-library/react";
import { EngagementWeights } from "../engagement-weights";

describe("EngagementWeights", () => {
  it("renders 5 weight sliders", () => {
    render(<EngagementWeights />);
    expect(screen.getByText("Hold Time")).toBeInTheDocument();
    expect(screen.getByText("TX Count")).toBeInTheDocument();
    expect(screen.getByText("TX Value")).toBeInTheDocument();
    expect(screen.getByText("Vote Count")).toBeInTheDocument();
    expect(screen.getByText("NFT Count")).toBeInTheDocument();
  });

  it("shows weights summing to 1.0", () => {
    render(<EngagementWeights />);
    expect(screen.getByText("Total: 1.0")).toBeInTheDocument();
  });
});
