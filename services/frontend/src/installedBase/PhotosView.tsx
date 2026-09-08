import { useEffect, useState } from "react";
import type { PhotoRecord } from "@shared/types";
import { listPhotos, uploadPhoto, validatePhoto } from "../api/installedBase";

interface Props {
  token: string;
}

export default function PhotosView({ token }: Props) {
  const [customer, setCustomer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const [reviewQueue, setReviewQueue] = useState<PhotoRecord[]>([]);
  const [corrections, setCorrections] = useState<Record<number, string>>({});

  function refresh() {
    listPhotos("needs_review")
      .then(setReviewQueue)
      .catch(() => setReviewQueue([]));
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  async function handleUpload() {
    if (!file || !customer.trim()) return;
    setUploading(true);
    setUploadMessage(null);
    try {
      const photo = await uploadPhoto(file, customer, token);
      setUploadMessage(`Foto #${photo.id} en cola (status: ${photo.status}). Podes seguir sacando fotos.`);
      setFile(null);
    } catch (err) {
      setUploadMessage(String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm(photo: PhotoRecord) {
    await validatePhoto(photo.id, { confirmed: true }, token);
    refresh();
  }

  async function handleReject(photo: PhotoRecord) {
    const modality = corrections[photo.id];
    if (!modality?.trim()) return;
    await validatePhoto(photo.id, { confirmed: false, correction: { modality } }, token);
    refresh();
  }

  return (
    <div>
      <h3>Subir foto</h3>
      <p style={{ color: "#666" }}>
        Subi una foto de una placa/etiqueta de equipo. Queda en cola y la identifica un modelo de
        vision en segundo plano -- no esperes, segui sacando fotos.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input
          style={{ padding: 8 }}
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
          placeholder="Cliente / hospital"
        />
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button onClick={handleUpload} disabled={uploading || !file || !customer.trim()}>
          {uploading ? "..." : "Subir"}
        </button>
      </div>
      {uploadMessage && <p>{uploadMessage}</p>}

      <h3>Fotos por validar ({reviewQueue.length})</h3>
      {reviewQueue.length === 0 && <p>Nada pendiente de revisar por ahora.</p>}
      {reviewQueue.map((photo) => (
        <div
          key={photo.id}
          style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, marginBottom: 12 }}
        >
          <p>
            <strong>Foto #{photo.id}</strong> — {photo.customer}
          </p>
          <p>
            Adivinanza del modelo de vision: {photo.guessed_modality ?? "?"}{" "}
            {photo.guessed_brand ?? ""} {photo.guessed_model ?? ""} (confianza{" "}
            {photo.guessed_confidence ?? "?"})
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => handleConfirm(photo)}>Confirmar</button>
            <input
              placeholder="Si no es correcto: modalidad real"
              value={corrections[photo.id] ?? ""}
              onChange={(e) => setCorrections((c) => ({ ...c, [photo.id]: e.target.value }))}
              style={{ padding: 6 }}
            />
            <button onClick={() => handleReject(photo)} disabled={!corrections[photo.id]?.trim()}>
              Corregir y guardar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
