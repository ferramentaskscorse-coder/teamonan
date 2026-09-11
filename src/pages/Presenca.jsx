import { useState } from "react";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { Check, AlertTriangle } from "lucide-react";
import { db } from "../firebase";
import { C, PERIODS, fmtDate, todayISO } from "../theme";
import { Select, FieldLabel, EmptyState, Modal } from "../ui";

export default function Presenca({ units, students, classes, attendance }) {
  const [selUnit, setSelUnit] = useState("");
  const [selTeacher, setSelTeacher] = useState("");
  const [selDate, setSelDate] = useState(todayISO());
  const [selPeriod, setSelPeriod] = useState("");
  const [popup, setPopup] = useState(null);
  const [busy, setBusy] = useState(false);

  const professores = students.filter((s) => s.tipo === "professor");
  const ready = selUnit && selTeacher && selDate && selPeriod;

  const currentClass = classes.find(
    (c) => c.unitId === selUnit && c.period === selPeriod && c.teacherId === selTeacher && c.date === selDate
  );

  // lista de quem pode ser marcado presente: alunos e professores da unidade selecionada
  const roster = students
    .filter((s) => s.unitId === selUnit)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  function isChecked(personId) {
    if (!currentClass) return false;
    return attendance.some((a) => a.classId === currentClass.id && a.studentId === personId);
  }

  async function toggleAttendance(personId, personName) {
    if (!ready || busy) return;

    // conflito: mesma pessoa, mesma data + período, aula diferente já registrada
    const conflict = attendance.find((a) => {
      if (a.studentId !== personId) return false;
      const cls = classes.find((c) => c.id === a.classId);
      if (!cls) return false;
      if (cls.date !== selDate || cls.period !== selPeriod) return false;
      if (currentClass && cls.id === currentClass.id) return false;
      return true;
    });

    if (conflict) {
      const cls = classes.find((c) => c.id === conflict.classId);
      const teacherName = students.find((s) => s.id === cls.teacherId)?.name || "—";
      const unitName = units.find((u) => u.id === cls.unitId)?.name || "—";
      setPopup({ personName, teacherName, unitName });
      return;
    }

    setBusy(true);
    try {
      if (currentClass) {
        const existing = attendance.find((a) => a.classId === currentClass.id && a.studentId === personId);
        if (existing) {
          await deleteDoc(doc(db, "attendance", existing.id));
          setBusy(false);
          return;
        }
      }

      let classId = currentClass?.id;
      if (!classId) {
        const ref = await addDoc(collection(db, "classes"), {
          unitId: selUnit,
          period: selPeriod,
          teacherId: selTeacher,
          date: selDate,
        });
        classId = ref.id;
      }
      await addDoc(collection(db, "attendance"), { classId, studentId: personId });
    } finally {
      setBusy(false);
    }
  }

  const checkedCount = currentClass ? attendance.filter((a) => a.classId === currentClass.id).length : 0;

  return (
    <div className="max-w-2xl">
      <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md p-4 sm:p-5 grid grid-cols-2 gap-3 mb-5">
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel>Unidade</FieldLabel>
          <Select value={selUnit} onChange={setSelUnit} placeholder="Selecione a unidade" options={units.map((u) => ({ value: u.id, label: u.name }))} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel>Professor</FieldLabel>
          <Select value={selTeacher} onChange={setSelTeacher} placeholder="Selecione o professor" options={professores.map((t) => ({ value: t.id, label: t.name }))} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel>Data</FieldLabel>
          <input
            type="date"
            value={selDate}
            onChange={(e) => setSelDate(e.target.value)}
            style={{ background: C.bgRaised, borderColor: C.line, color: C.text, height: "42px", boxSizing: "border-box" }}
            className="border rounded-md px-3 py-2 text-sm outline-none w-full"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <FieldLabel>Período</FieldLabel>
          <Select value={selPeriod} onChange={setSelPeriod} placeholder="Manhã, tarde ou noite" options={PERIODS.map((p) => ({ value: p, label: p }))} />
        </div>
      </div>

      {professores.length === 0 && (
        <EmptyState text="Nenhum professor cadastrado ainda. Cadastre em Cadastros (Tipo: Professor)." />
      )}

      {professores.length > 0 && !ready && <EmptyState text="Selecione unidade, professor, data e período para abrir a lista." />}

      {ready && roster.length === 0 && <EmptyState text="Nenhum aluno ou professor cadastrado nessa unidade ainda." />}

      {ready && roster.length > 0 && (
        <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md overflow-hidden">
          <div style={{ borderColor: C.lineSoft, color: C.textDim }} className="border-b px-4 py-2.5 flex items-center justify-between text-xs">
            <span>
              {fmtDate(selDate)} · {selPeriod}
            </span>
            <span style={{ color: C.oliveBright }} className="font-semibold">
              {checkedCount}/{roster.length} presentes
            </span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: C.textFaint, borderColor: C.lineSoft }} className="border-b text-left text-xs">
                <th className="font-medium px-4 py-2">Nome</th>
                <th className="font-medium px-4 py-2 w-28 text-center">Presença</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((p) => {
                const checked = isChecked(p.id);
                return (
                  <tr key={p.id} style={{ borderColor: C.lineSoft }} className="border-b last:border-0">
                    <td style={{ color: C.text }} className="px-4 py-2.5">
                      {p.name}
                      {p.tipo === "professor" && (
                        <span style={{ color: C.brass }} className="text-xs ml-2">
                          (professor)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-center">
                        <button
                          onClick={() => toggleAttendance(p.id, p.name)}
                          style={{ background: checked ? C.olive : "transparent", borderColor: checked ? C.olive : C.line }}
                          className="w-8 h-8 rounded-md border flex items-center justify-center disabled:opacity-50"
                          aria-label={`Marcar presença de ${p.name}`}
                          disabled={busy}
                        >
                          {checked && <Check size={16} color={C.text} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {popup && (
        <Modal onClose={() => setPopup(null)}>
          <div className="flex flex-col items-center text-center gap-3 p-2">
            <div style={{ background: C.redDim }} className="w-11 h-11 rounded-full flex items-center justify-center">
              <AlertTriangle size={20} color={C.text} />
            </div>
            <div style={{ color: C.text }} className="font-semibold">
              Presença já confirmada
            </div>
            <div style={{ color: C.textDim }} className="text-sm leading-relaxed">
              {popup.personName} já foi marcado(a) presente hoje no período da {selPeriod.toLowerCase()}, com o professor{" "}
              {popup.teacherName} ({popup.unitName}).
            </div>
            <button onClick={() => setPopup(null)} style={{ background: C.red, color: C.text }} className="mt-1 rounded-md px-4 py-2 text-sm font-semibold w-full">
              Entendi
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
