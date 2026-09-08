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
});
