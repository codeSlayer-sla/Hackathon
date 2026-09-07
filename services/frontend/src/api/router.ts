import type { AskRequest, AskResponse, PeerCapability } from "@shared/types";

// No hardcoded IP: same rule as the backend services. In dev, Vite's env
// var; in the Docker image, baked in at build time or overridden at runtime
// via window.__ROUTER_URL__ (see Dockerfile/entry notes in README).
const ROUTER_URL = (import.meta.env.VITE_ROUTER_URL as string | undefined) ?? "http://localhost:8001";

export async function ask(request: AskRequest): Promise<AskResponse> {
  const res = await fetch(`${ROUTER_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`Router /ask failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function listPeers(): Promise<PeerCapability[]> {
  const res = await fetch(`${ROUTER_URL}/peers`);
  if (!res.ok) {
    throw new Error(`Router /peers failed: ${res.status}`);
  }
  return res.json();
}
