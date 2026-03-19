/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";
import { PlaybookPicker, PlaybookTemplate } from "../playbook-picker";

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

const MOCK_TEMPLATES: PlaybookTemplate[] = [
  {
    id: "nft-welcome",
    name: "NFT Welcome Flow",
    description: "Onboard new NFT holders",
    triggerType: "nft_minted",
    steps: [
      {
        type: "send_telegram",
        config: { content: "Welcome!" },
        delay: 3600000,
      },
      { type: "grant_discord_role", config: { guildId: "g1", roleId: "r1" } },
    ],
  },
  {
    id: "defi-activation",
    name: "DeFi Activation",
    description: "Reward DeFi users",
    triggerType: "defi_action",
    steps: [
      {
        type: "airdrop_token",
        config: { coinType: "0x2::sui::SUI", amount: "1000000000" },
      },
    ],
  },
];

describe("PlaybookPicker", () => {
  it("renders all template cards", () => {
    const onSelect = vi.fn();
    render(<PlaybookPicker templates={MOCK_TEMPLATES} onSelect={onSelect} />);

    expect(screen.getByText("NFT Welcome Flow")).toBeInTheDocument();
    expect(screen.getByText("DeFi Activation")).toBeInTheDocument();
  });

  it("shows step count on cards", () => {
    const onSelect = vi.fn();
    render(<PlaybookPicker templates={MOCK_TEMPLATES} onSelect={onSelect} />);

    expect(screen.getByText("2 steps")).toBeInTheDocument();
    expect(screen.getByText("1 step")).toBeInTheDocument();
  });

  it("shows trigger type badge", () => {
    const onSelect = vi.fn();
    render(<PlaybookPicker templates={MOCK_TEMPLATES} onSelect={onSelect} />);

    expect(screen.getByText("nft minted")).toBeInTheDocument();
    expect(screen.getByText("defi action")).toBeInTheDocument();
  });

  it("opens preview dialog on card click", () => {
    const onSelect = vi.fn();
    render(<PlaybookPicker templates={MOCK_TEMPLATES} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId("playbook-card-nft-welcome"));

    expect(screen.getByText("Workflow Steps")).toBeInTheDocument();
    expect(screen.getByText("Send Telegram")).toBeInTheDocument();
    expect(screen.getByText("Grant Discord Role")).toBeInTheDocument();
  });

  it("calls onSelect when Use This Playbook clicked", () => {
    const onSelect = vi.fn();
    render(<PlaybookPicker templates={MOCK_TEMPLATES} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId("playbook-card-nft-welcome"));
    fireEvent.click(screen.getByTestId("use-playbook-btn"));

    expect(onSelect).toHaveBeenCalledWith(MOCK_TEMPLATES[0]);
  });

  it("shows delay info in preview", () => {
    const onSelect = vi.fn();
    render(<PlaybookPicker templates={MOCK_TEMPLATES} onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId("playbook-card-nft-welcome"));

    expect(screen.getByText("delay: 60m")).toBeInTheDocument();
  });
});
