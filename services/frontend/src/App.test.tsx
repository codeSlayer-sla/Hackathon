import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
  );
});

describe("App", () => {
  it("renders the title and defaults to the capture tab's PIN login gate", () => {
    render(<App />);
    expect(screen.getByText("Customer Installed Base Intelligence")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("PIN")).toBeInTheDocument();
  });

  it("switches to the Mesh Demo tab and shows the empty peers state", async () => {
    render(<App />);
    await userEvent.click(screen.getByText("Mesh Demo"));
    expect(await screen.findByText(/Sin peers registrados todavia/)).toBeInTheDocument();
  });

  it("shares one login across every tab that needs auth", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/auth/technician")) {
          return {
            ok: true,
            json: async () => ({ token: "tok-1", technician_id: "tech-01", name: "Field User 01" }),
          };
        }
        return { ok: true, json: async () => [] };
      })
    );

    render(<App />);
    await userEvent.type(screen.getByPlaceholderText("PIN"), "1234");
    await userEvent.click(screen.getByText("Entrar"));
    expect(await screen.findByText(/Conectado como/)).toBeInTheDocument();

    await userEvent.click(screen.getByText("Fotos"));
    expect(screen.queryByPlaceholderText("PIN")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("Analytics"));
    await userEvent.click(screen.getByText("Capturar visita"));
    expect(screen.queryByPlaceholderText("PIN")).not.toBeInTheDocument();
  });
});
