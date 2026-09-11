import { C } from "../theme";
import logo from "../assets/logo.jpg";

export default function ModeSelect({ onSelect }) {
  return (
    <div style={{ background: C.bg }} className="w-full min-h-screen flex items-center justify-center p-6">
      <div style={{ background: C.bgPanel, borderColor: C.line }} className="w-full max-w-sm border rounded-md p-8 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-3">
          <img src={logo} alt="Team Onan" className="w-16 h-16 rounded-full object-cover" style={{ border: `2px solid ${C.red}` }} />
          <div style={{ color: C.text }} className="font-bold text-lg tracking-tight">
            Team Onan
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => onSelect("aluno")}
            style={{ background: C.red, color: C.text }}
            className="rounded-md py-3 text-sm font-semibold"
          >
            Sou aluno ou professor
          </button>
          <button
            onClick={() => onSelect("admin")}
            style={{ background: C.bgRaised, borderColor: C.line, color: C.textDim }}
            className="border rounded-md py-3 text-sm font-semibold"
          >
            Sou da equipe (admin)
          </button>
        </div>
      </div>
    </div>
  );
}
