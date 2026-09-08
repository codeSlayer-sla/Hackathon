import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CaptureView from "./CaptureView";

describe("CaptureView", () => {
  it("sends a turn and shows the saved observation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
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
      })
    );

    render(<CaptureView />);
    await userEvent.type(
      screen.getByPlaceholderText(/Estoy en Hospital DemoCare Pacific/),
      "dos MR en Hospital Test"
    );
    await userEvent.click(screen.getByText("Enviar"));

    expect(await screen.findByText(/Guardado para Hospital Test/)).toBeInTheDocument();
  });
});
