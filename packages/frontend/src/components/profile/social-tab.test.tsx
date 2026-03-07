import { render, screen, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { SocialTab } from "./social-tab";

const mockUnlink = vi.fn();

vi.mock("@/lib/hooks/use-social-links", () => ({
  useSocialLinks: (profileId: string) => ({
    data: [
      {
        id: "1",
        platform: "discord",
        platformUserId: "disc-123",
        platformUsername: "testuser#1234",
        verified: true,
        linkedAt: "2026-03-07T00:00:00Z",
      },
    ],
    isLoading: false,
  }),
  useLinkSocial: () => ({ mutate: vi.fn(), isPending: false }),
  useUnlinkSocial: () => ({
    mutate: mockUnlink,
    isPending: false,
  }),
}));

describe("SocialTab", () => {
  beforeEach(() => {
    mockUnlink.mockReset();
  });

  it("renders all 4 platform cards", () => {
    render(<SocialTab profileId="p1" />);
    expect(screen.getByTestId("social-card-discord")).toBeInTheDocument();
    expect(screen.getByTestId("social-card-telegram")).toBeInTheDocument();
    expect(screen.getByTestId("social-card-x")).toBeInTheDocument();
    expect(screen.getByTestId("social-card-apple")).toBeInTheDocument();
  });

  it("shows linked status for Discord", () => {
    render(<SocialTab profileId="p1" />);
    expect(screen.getByText("testuser#1234")).toBeInTheDocument();
    expect(screen.getByText("Verified")).toBeInTheDocument();
  });

  it("shows 'Not linked' for unlinked platforms", () => {
    render(<SocialTab profileId="p1" />);
    const notLinked = screen.getAllByText("Not linked");
    // telegram, x, apple are not linked
    expect(notLinked).toHaveLength(3);
  });

  it("calls unlink mutation when unlink button is clicked", () => {
    render(<SocialTab profileId="p1" />);
    const unlinkBtn = screen.getByRole("button", { name: /unlink/i });
    fireEvent.click(unlinkBtn);
    expect(mockUnlink).toHaveBeenCalledWith({
      profileId: "p1",
      platform: "discord",
    });
  });

  it("shows link buttons for Discord and X", () => {
    render(<SocialTab profileId="p1" />);
    // Discord is linked so it shows Unlink, but X should show Link
    expect(
      screen.getByRole("button", { name: /link x/i }),
    ).toBeInTheDocument();
  });
});
