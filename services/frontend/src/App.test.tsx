import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
  it("renders the title and an empty peers message when no peers are registered", async () => {
    render(<App />);
    expect(screen.getByText("Enterprise AI Mesh")).toBeInTheDocument();
    expect(await screen.findByText(/Sin peers registrados todavia/)).toBeInTheDocument();
  });

  it("renders the chat input and button", async () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/Pregunta algo/)).toBeInTheDocument();
    expect(screen.getByText("Preguntar")).toBeInTheDocument();
    // Let the peers-fetch effect settle so it doesn't warn after the test ends.
    await screen.findByText(/Sin peers registrados todavia/);
  });
});
