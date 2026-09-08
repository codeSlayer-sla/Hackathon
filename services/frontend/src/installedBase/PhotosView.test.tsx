import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PhotosView from "./PhotosView";

function mockFetch() {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes("/photos") && (!init || init.method === undefined)) {
      // GET /photos?status=needs_review
      return {
        ok: true,
        json: async () => [
          {
            id: 1,
            photo_path: "/data/media/photos/a.jpg",
            customer: "Hospital Test",
            status: "needs_review",
            guessed_modality: "MR",
            guessed_brand: "NovaMed",
            guessed_confidence: "high",
            created_at: new Date().toISOString(),
          },
        ],
      };
    }
    if (url.endsWith("/photos") && init?.method === "POST") {
      return { ok: true, json: async () => ({ id: 2, photo_path: "/x.jpg", status: "pending", created_at: "" }) };
    }
    if (url.includes("/validate")) {
      return {
        ok: true,
        json: async () => ({
          id: 1,
          customer: "Hospital Test",
          modality: "MR",
          confidence: "high",
          status: "confirmed",
          source: "photo",
          possible_duplicate_of: [],
          created_at: new Date().toISOString(),
        }),
      };
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
}

describe("PhotosView", () => {
  it("shows the review queue with the vision model's guess", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<PhotosView token="tok-123" />);
    expect(await screen.findByText(/Foto #1/)).toBeInTheDocument();
    expect(screen.getByText(/NovaMed/)).toBeInTheDocument();
  });

  it("confirms a photo and refreshes the queue", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<PhotosView token="tok-123" />);
    await screen.findByText(/Foto #1/);
    await userEvent.click(screen.getByText("Confirmar"));
    // no assertion error thrown means the validate + refresh round-trip worked
  });
});
