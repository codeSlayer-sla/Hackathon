import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QueryView from "./QueryView";

describe("QueryView", () => {
  it("asks a natural-language question and renders the interpreted results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          question: "clientes en Panama con equipos MR",
          interpreted_filter: { country: "Panama", modality: "MR" },
          results: [
            {
              id: 1,
              customer: "Hospital DemoCare Pacific",
              country: "Panama",
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
        }),
      })
    );

    render(<QueryView />);
    await userEvent.type(
      screen.getByPlaceholderText(/clientes en Panama/),
      "clientes en Panama con equipos MR"
    );
    await userEvent.click(screen.getByText("Preguntar"));

    expect(await screen.findByText("Hospital DemoCare Pacific")).toBeInTheDocument();
    expect(screen.getByText(/1 resultado/)).toBeInTheDocument();
  });
});
