import { useState } from "react";
import { Swords } from "lucide-react";
import { C } from "../theme";

const SHARED_PASSWORD = import.meta.env.VITE_APP_PASSWORD || "teamonan2026";

export default function Login({ onSuccess }) {
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");

  function handleLogin(e) {
    e.preventDefault();
    if (pwInput === SHARED_PASSWORD) {
      setPwError("");
      onSuccess();
    } else {
      setPwError("Senha incorreta.");
    }
  }

  return (
    <div style={{ background: C.bg }} className="w-full min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={handleLogin}
        style={{ background: C.bgPanel, borderColor: C.line }}
        className="w-full max-w-sm border rounded-md p-8 flex flex-col gap-5"
      >
        <div className="flex flex-col items-center gap-3 mb-2">
          <div style={{ background: C.red }} className="w-12 h-12 rounded-full flex items-center justify-center">
            <Swords size={22} color={C.text} />
          </div>
          <div className="text-center">
            <div style={{ color: C.text }} className="font-bold text-lg tracking-tight">
              Team Onan
            </div>
            <div style={{ color: C.textFaint }} className="text-xs">
              Registro de presença
            </div>
          </div>
        </div>
        <label className="flex flex-col gap-1.5">
          <span style={{ color: C.textDim }} className="text-xs">
            Senha de acesso
          </span>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => setPwInput(e.target.value)}
            style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
            className="border rounded-md px-3 py-2 text-sm outline-none"
            autoFocus
          />
        </label>
        {pwError && (
          <div style={{ color: C.red }} className="text-xs -mt-2">
            {pwError}
          </div>
        )}
        <button type="submit" style={{ background: C.red, color: C.text }} className="rounded-md py-2 text-sm font-semibold">
          Entrar
        </button>
      </form>
    </div>
  );
}
