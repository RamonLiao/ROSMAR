import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { NotificationCenter } from "../notification-center";

const mockMarkRead = { mutate: vi.fn() };
const mockMarkAllRead = { mutate: vi.fn() };

vi.mock("@/lib/hooks/use-notifications", () => ({
  useNotifications: () => ({
    data: [
      {
        id: "1",
        type: "whale_alert",
        title: "Whale Alert: 500,000 SUI",
        body: "Address 0xwhal...e001 executed a swap",
        isRead: false,
        createdAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
  }),
  useUnreadCount: () => ({
    data: { count: 1 },
  }),
  useMarkRead: () => mockMarkRead,
  useMarkAllRead: () => mockMarkAllRead,
}));

describe("NotificationCenter", () => {
  it("shows unread count badge", () => {
    render(<NotificationCenter />);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows notifications on click", async () => {
    render(<NotificationCenter />);
    await userEvent.click(screen.getByRole("button", { name: "1" }));
    expect(screen.getByText("Whale Alert: 500,000 SUI")).toBeInTheDocument();
  });
});
