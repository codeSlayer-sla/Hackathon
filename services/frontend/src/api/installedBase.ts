import type {
  AnalyticsSummary,
  CaptureTurnRequest,
  CaptureTurnResponse,
  CustomerSummary,
  EquipmentObservation,
  NaturalLanguageQueryResponse,
  PhotoRecord,
  PhotoValidateRequest,
  TechnicianAuthResponse,
  TechnicianSummary,
} from "@shared/types";

const INSTALLED_BASE_URL =
  (import.meta.env.VITE_INSTALLED_BASE_URL as string | undefined) ?? "http://localhost:8005";

// /capture/turn, /capture/turn/voice and /photos* require a technician
// token now (see services/installed-base/app/auth.py) -- this web demo
// logs in with a PIN same as the future native app would.
export async function loginWithPin(pin: string): Promise<TechnicianAuthResponse> {
  const res = await fetch(`${INSTALLED_BASE_URL}/auth/technician`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    throw new Error(`PIN invalido (${res.status})`);
  }
  return res.json();
}

export async function captureTurn(request: CaptureTurnRequest, token: string): Promise<CaptureTurnResponse> {
  const res = await fetch(`${INSTALLED_BASE_URL}/capture/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

export async function uploadPhoto(file: File, customer: string, token: string): Promise<PhotoRecord> {
  const form = new FormData();
  form.append("photo", file);
  form.append("customer", customer);
  const res = await fetch(`${INSTALLED_BASE_URL}/photos`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`/photos failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function listPhotos(status?: string): Promise<PhotoRecord[]> {
  const url = status ? `${INSTALLED_BASE_URL}/photos?status=${status}` : `${INSTALLED_BASE_URL}/photos`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`/photos failed: ${res.status}`);
  }
  return res.json();
}

export async function validatePhoto(
  photoId: number,
  request: PhotoValidateRequest,
  token: string
): Promise<EquipmentObservation> {
  const res = await fetch(`${INSTALLED_BASE_URL}/photos/${photoId}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(request),
  });
  if (!res.ok) {
    throw new Error(`/photos/${photoId}/validate failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function listTechnicians(): Promise<TechnicianSummary[]> {
  const res = await fetch(`${INSTALLED_BASE_URL}/technicians`);
  if (!res.ok) {
    throw new Error(`/technicians failed: ${res.status}`);
  }
  return res.json();
}

export async function queryDataset(question: string): Promise<NaturalLanguageQueryResponse> {
  const res = await fetch(`${INSTALLED_BASE_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) {
    throw new Error(`/query failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}
