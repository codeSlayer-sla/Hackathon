import { useState } from "react";
import { loginWithPin } from "../api/installedBase";

interface Props {
  onLogin: (token: string, name: string) => void;
}

export default function LoginGate({ onLogin }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    try {
      const auth = await loginWithPin(pin);
      onLogin(auth.token, auth.name);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ color: "#666" }}>
        Ingresa tu PIN de tecnico para continuar (la app nativa del tecnico hara este mismo login;
        esto es solo la demo web).
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          style={{ padding: 8 }}
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          placeholder="PIN"
        />
        <button onClick={handleLogin} disabled={loading}>
          {loading ? "..." : "Entrar"}
        </button>
      </div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
