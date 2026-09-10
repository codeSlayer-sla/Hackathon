import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TechniciansView from "./TechniciansView";

describe("TechniciansView", () => {
  it("lists existing technicians and their last-seen status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [
          { technician_id: "tech-01", name: "Field User 01", created_at: new Date().toISOString(), last_seen_at: null },
        ],
      })
    );

    render(<TechniciansView />);

    expect(await screen.findByText("Field User 01")).toBeInTheDocument();
    expect(screen.getByText("Nunca conectado")).toBeInTheDocument();
  });

  it("registers a new technician and refreshes the list", async () => {
    const fetchMock = vi.fn(async (url: string, opts?: RequestInit) => {
      if (opts?.method === "POST") {
        return { ok: true, json: async () => ({ technician_id: "tech-99", name: "New Tech" }) };
      }
      return { ok: true, json: async () => [{ technician_id: "tech-99", name: "New Tech", created_at: new Date().toISOString(), last_seen_at: null }] };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TechniciansView />);
    await userEvent.type(screen.getByPlaceholderText("Nombre"), "New Tech");
    await userEvent.type(screen.getByPlaceholderText(/PIN/), "9876");
    await userEvent.click(screen.getByText("Registrar"));

    expect(await screen.findByText("New Tech")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/technicians"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("rejects a PIN that isn't 4-8 digits without calling the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    render(<TechniciansView />);
    await userEvent.type(screen.getByPlaceholderText("Nombre"), "Bad Pin");
    await userEvent.type(screen.getByPlaceholderText(/PIN/), "12");
    await userEvent.click(screen.getByText("Registrar"));

    expect(await screen.findByText(/entre 4 y 8 dígitos/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("/technicians"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
