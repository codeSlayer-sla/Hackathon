import type {
  AnalyticsSummary,
  CaptureTurnRequest,
  CaptureTurnResponse,
  CustomerSummary,
  EquipmentObservation,
} from "@shared/types";

const INSTALLED_BASE_URL =
  (import.meta.env.VITE_INSTALLED_BASE_URL as string | undefined) ?? "http://localhost:8005";

export async function captureTurn(request: CaptureTurnRequest): Promise<CaptureTurnResponse> {
  const res = await fetch(`${INSTALLED_BASE_URL}/capture/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`/capture/turn failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function listCustomers(): Promise<CustomerSummary[]> {
  const res = await fetch(`${INSTALLED_BASE_URL}/customers`);
  if (!res.ok) {
    throw new Error(`/customers failed: ${res.status}`);
  }
  return res.json();
}

export async function getCustomer(customer: string): Promise<EquipmentObservation[]> {
  const res = await fetch(`${INSTALLED_BASE_URL}/customers/${encodeURIComponent(customer)}`);
  if (!res.ok) {
    throw new Error(`/customers/${customer} failed: ${res.status}`);
  }
  return res.json();
}

export async function getAnalytics(): Promise<AnalyticsSummary> {
  const res = await fetch(`${INSTALLED_BASE_URL}/analytics`);
  if (!res.ok) {
    throw new Error(`/analytics failed: ${res.status}`);
  }
  return res.json();
}
