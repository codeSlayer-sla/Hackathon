import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CustomersView from "./CustomersView";

describe("CustomersView", () => {
  it("renders the customer summary returned by the API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          {
            customer: "Hospital Alpha",
            country: "Panama",
            city: "Panama City",
            equipment_count: 3,
            modalities: { MR: 2, CT: 1 },
            has_incomplete_info: false,
          },
        ],
      })
    );
    render(<CustomersView />);
    expect(await screen.findByText("Hospital Alpha")).toBeInTheDocument();
    expect(screen.getByText("MR=2, CT=1")).toBeInTheDocument();
  });

  it("shows the empty state when there are no customers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<CustomersView />);
    expect(await screen.findByText(/Sin clientes todavia/)).toBeInTheDocument();
  });
});
