import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CaptureView from "./CaptureView";

function mockFetchSequence() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/auth/technician")) {
      return {
        ok: true,
        json: async () => ({ token: "tok-123", technician_id: "tech-01", name: "Field User 01" }),
      };
    }
    if (url.endsWith("/capture/turn")) {
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
      return {
        ok: true,
        json: async () => ({
          session_id: "s1",
          agent_message: "Guardado para Hospital Test: 2x MR (NovaMed).",
          saved_observations: [
            {
              id: 1,
              customer: "Hospital Test",
              modality: "MR",
              quantity: 2,
              brand: "NovaMed",
              confidence: "high",
              status: "reported",
              possible_duplicate_of: [],
              source: "text",
              created_at: new Date().toISOString(),
            },
          ],
          done: true,
        }),
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe("CaptureView", () => {
  it("logs in with a PIN, then sends a turn and shows the saved observation", async () => {
    vi.stubGlobal("fetch", mockFetchSequence());

    render(<CaptureView />);

    await userEvent.type(screen.getByPlaceholderText("PIN"), "1234");
    await userEvent.click(screen.getByText("Entrar"));

    const input = await screen.findByPlaceholderText(/Estoy en Hospital DemoCare Pacific/);
    await userEvent.type(input, "dos MR en Hospital Test");
    await userEvent.click(screen.getByText("Enviar"));

    expect(await screen.findByText(/Guardado para Hospital Test/)).toBeInTheDocument();
  });
});
