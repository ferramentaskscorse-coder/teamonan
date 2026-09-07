import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Swords, LogOut, CalendarCheck, BarChart3, ClipboardList, Loader2 } from "lucide-react";
import { db, ensureAnonymousAuth } from "./firebase";
import { C } from "./theme";
import { NavTab } from "./ui";
import Login from "./pages/Login";
import Presenca from "./pages/Presenca";
import Dashboard from "./pages/Dashboard";
import Cadastros from "./pages/Cadastros";

function watch(name, setter) {
  return onSnapshot(
    collection(db, name),
    (snap) => setter(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error(`Falha ao sincronizar ${name}`, err)
  );
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [connError, setConnError] = useState("");
  const [authed, setAuthed] = useState(false);
  const [page, setPage] = useState("presenca");

  const [units, setUnits] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [attendance, setAttendance] = useState([]);

  useEffect(() => {
    let unsubs = [];
    ensureAnonymousAuth()
      .then(() => {
        unsubs = [
          watch("units", setUnits),
          watch("teachers", setTeachers),
          watch("students", setStudents),
          watch("classes", setClasses),
          watch("attendance", setAttendance),
        ];
        setBooted(true);
      })
      .catch((e) => {
        console.error("Falha na autenticação do Firebase", e);
        setConnError(
          "Não consegui conectar ao Firebase. Confira as chaves em .env e se a autenticação anônima está ativada no console."
        );
        setBooted(true);
      });
    return () => unsubs.forEach((u) => u());
  }, []);

  if (!booted) {
    return (
      <div style={{ background: C.bg, color: C.textDim }} className="w-full min-h-screen flex items-center justify-center gap-2 text-sm">
        <Loader2 className="animate-spin" size={18} />
        Carregando...
      </div>
    );
  }

  if (connError) {
    return (
      <div style={{ background: C.bg }} className="w-full min-h-screen flex items-center justify-center p-6">
        <div style={{ background: C.bgPanel, borderColor: C.red, color: C.text }} className="border rounded-md p-6 max-w-sm text-sm">
          {connError}
        </div>
      </div>
    );
  }

  if (!authed) {
    return <Login onSuccess={() => setAuthed(true)} />;
  }

  return (
    <div style={{ background: C.bg }} className="w-full min-h-screen flex flex-col">
      <div style={{ background: C.bgPanel, borderColor: C.line }} className="border-b flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div style={{ background: C.red }} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
            <Swords size={16} color={C.text} />
          </div>
          <div style={{ color: C.text }} className="font-bold tracking-tight text-sm sm:text-base">
            Team Onan
          </div>
        </div>
        <button onClick={() => setAuthed(false)} style={{ color: C.textDim }} className="flex items-center gap-1.5 text-xs hover:opacity-80">
          <LogOut size={14} />
          Sair
        </button>
      </div>

      <div style={{ borderColor: C.line }} className="border-b flex px-2 sm:px-6">
        <NavTab active={page === "presenca"} onClick={() => setPage("presenca")} icon={CalendarCheck}>
          Presença
        </NavTab>
        <NavTab active={page === "dashboard"} onClick={() => setPage("dashboard")} icon={BarChart3}>
          Dashboard
        </NavTab>
        <NavTab active={page === "cadastros"} onClick={() => setPage("cadastros")} icon={ClipboardList}>
          Cadastros
        </NavTab>
      </div>

      <div className="flex-1 p-4 sm:p-6">
        {page === "presenca" && <Presenca units={units} teachers={teachers} students={students} classes={classes} attendance={attendance} />}
        {page === "dashboard" && <Dashboard units={units} teachers={teachers} students={students} classes={classes} attendance={attendance} />}
        {page === "cadastros" && <Cadastros units={units} teachers={teachers} students={students} />}
      </div>
    </div>
  );
}
