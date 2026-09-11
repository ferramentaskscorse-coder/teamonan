import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, logoutAny } from "./firebase";
import { C } from "./theme";
import ModeSelect from "./pages/ModeSelect";
import AlunoAuth from "./pages/AlunoAuth";
import AlunoHome from "./pages/AlunoHome";
import AdminApp from "./AdminApp";

export default function App() {
  // "mode" decide qual fluxo mostrar: null (escolha inicial), "admin" ou "aluno".
  // Persistido na aba (sessionStorage) — F5 mantém o modo escolhido.
  const [mode, setMode] = useState(() => sessionStorage.getItem("onan-mode") || null);
  const [alunoUser, setAlunoUser] = useState(undefined); // undefined = ainda não sabemos

  useEffect(() => {
    if (mode !== "aluno") return;
    const unsub = onAuthStateChanged(auth, (user) => {
      // usuário anônimo (resquício do modo admin) não conta como aluno logado
      setAlunoUser(user && !user.isAnonymous ? user : null);
    });
    return unsub;
  }, [mode]);

  async function selectMode(m) {
    await logoutAny().catch(() => {});
    sessionStorage.setItem("onan-mode", m);
    setMode(m);
    setAlunoUser(undefined);
  }

  async function backToStart() {
    await logoutAny().catch(() => {});
    sessionStorage.removeItem("onan-mode");
    sessionStorage.removeItem("onan-authed");
    setMode(null);
    setAlunoUser(undefined);
  }

  if (mode === "admin") {
    return <AdminApp onBack={backToStart} />;
  }

  if (mode === "aluno") {
    if (alunoUser === undefined) {
      return (
        <div style={{ background: C.bg, color: C.textDim }} className="w-full min-h-screen flex items-center justify-center text-sm">
          Carregando...
        </div>
      );
    }
    if (!alunoUser) {
      return <AlunoAuth onBack={backToStart} />;
    }
    return <AlunoHome onBack={backToStart} />;
  }

  return <ModeSelect onSelect={selectMode} />;
}
