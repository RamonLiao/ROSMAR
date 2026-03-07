import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AssetGallery } from "../asset-gallery";

vi.mock("@/lib/hooks/use-profile-assets", () => ({
  useProfileAssets: () => ({
    data: {
      nfts: [
        { collection: "SuiFrens", count: 3, eventType: "MintNFTEvent" },
      ],
      defi: [
        { type: "SwapEvent", count: 5, totalAmount: 10000 },
      ],
      governance: [
        { type: "VoteEvent", count: 2 },
      ],
    },
    isLoading: false,
  }),
  useProfileTimeline: () => ({
    data: { events: [], total: 0 },
    isLoading: false,
  }),
}));

describe("AssetGallery", () => {
  it("renders NFT collections", () => {
    render(<AssetGallery profileId="p1" />);
    expect(screen.getByText("SuiFrens")).toBeInTheDocument();
    expect(screen.getByText("3 items")).toBeInTheDocument();
  });

  it("renders DeFi activity", () => {
    render(<AssetGallery profileId="p1" />);
    expect(screen.getByText("SwapEvent")).toBeInTheDocument();
  });

  it("renders governance", () => {
    render(<AssetGallery profileId="p1" />);
    expect(screen.getByText("VoteEvent: 2")).toBeInTheDocument();
  });
});
