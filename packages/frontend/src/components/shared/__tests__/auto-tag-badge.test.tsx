import { render, screen } from "@testing-library/react";
import { AutoTagBadge, isAutoTag, displayTagName } from "../auto-tag-badge";

describe("AutoTagBadge", () => {
  it("identifies auto tags", () => {
    expect(isAutoTag("auto:NFT_Collector")).toBe(true);
    expect(isAutoTag("vip")).toBe(false);
  });

  it("strips prefix for display", () => {
    expect(displayTagName("auto:NFT_Collector")).toBe("NFT Collector");
    expect(displayTagName("vip")).toBe("vip");
  });

  it("renders auto tag with bot icon styling", () => {
    render(<AutoTagBadge tag="auto:NFT_Collector" />);
    const badge = screen.getByText("NFT Collector");
    expect(badge).toBeInTheDocument();
  });

  it("renders manual tag without bot icon", () => {
    render(<AutoTagBadge tag="vip" />);
    const badge = screen.getByText("vip");
    expect(badge).toBeInTheDocument();
  });
});
