import { useState } from "react";
import { collection, addDoc, deleteDoc, doc } from "firebase/firestore";
import { Plus, Trash2 } from "lucide-react";
import { db } from "../firebase";
import { C } from "../theme";
import { Select } from "../ui";

export default function Cadastros({ units, teachers, students }) {
  const [tab, setTab] = useState("unidades");

  return (
    <div className="max-w-2xl">
      <div style={{ borderColor: C.line }} className="border-b flex gap-1 mb-4">
        {[
          ["unidades", "Unidades"],
          ["professores", "Professores"],
          ["alunos", "Alunos"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ color: tab === key ? C.text : C.textFaint, borderColor: tab === key ? C.red : "transparent" }}
            className="text-sm px-3 py-2 border-b-2 -mb-px font-medium"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "unidades" && (
        <SimpleList
          items={units}
          collectionName="units"
          placeholder="Nome da unidade"
          onAdd={(name) => addDoc(collection(db, "units"), { name })}
        />
      )}

      {tab === "professores" && (
        <SimpleList
          items={teachers}
          collectionName="teachers"
          placeholder="Nome do professor"
          onAdd={(name) => addDoc(collection(db, "teachers"), { name })}
        />
      )}

      {tab === "alunos" && <StudentList units={units} students={students} />}
    </div>
  );
}

function SimpleList({ items, collectionName, onAdd, placeholder }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    await onAdd(name.trim());
    setName("");
    setBusy(false);
  }

  async function handleRemove(id) {
    await deleteDoc(doc(db, collectionName, id));
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={placeholder}
          style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
          className="border rounded-md px-3 py-2 text-sm outline-none flex-1"
        />
        <button type="submit" disabled={busy} style={{ background: C.red, color: C.text }} className="rounded-md px-3 flex items-center justify-center disabled:opacity-60">
          <Plus size={16} />
        </button>
      </form>
      <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md overflow-hidden">
        {items.length === 0 && (
          <div style={{ color: C.textFaint }} className="text-sm px-4 py-6 text-center">
            Nada cadastrado ainda.
          </div>
        )}
        {items.map((it) => (
          <div key={it.id} style={{ borderColor: C.lineSoft }} className="border-b last:border-0 flex items-center justify-between px-4 py-2.5">
            <span style={{ color: C.text }} className="text-sm">
              {it.name}
            </span>
            <button onClick={() => handleRemove(it.id)} style={{ color: C.textFaint }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentList({ units, students }) {
  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim() || !unitId || busy) return;
    setBusy(true);
    await addDoc(collection(db, "students"), { name: name.trim(), unitId });
    setName("");
    setBusy(false);
  }

  async function handleRemove(id) {
    await deleteDoc(doc(db, "students", id));
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleAdd} className="grid grid-cols-3 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do aluno"
          style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
          className="border rounded-md px-3 py-2 text-sm outline-none col-span-2"
        />
        <div className="col-span-1">
          <Select value={unitId} onChange={setUnitId} placeholder="Unidade" options={units.map((u) => ({ value: u.id, label: u.name }))} />
        </div>
        <button
          type="submit"
          disabled={busy}
          style={{ background: C.red, color: C.text }}
          className="rounded-md px-3 py-2 flex items-center justify-center gap-1.5 text-sm font-medium col-span-3 sm:col-span-1 disabled:opacity-60"
        >
          <Plus size={16} />
          Adicionar aluno
        </button>
      </form>
      {units.length === 0 && (
        <div style={{ color: C.textFaint }} className="text-xs">
          Cadastre uma unidade antes de adicionar alunos.
        </div>
      )}
      <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md overflow-hidden">
        {students.length === 0 && (
          <div style={{ color: C.textFaint }} className="text-sm px-4 py-6 text-center">
            Nenhum aluno cadastrado ainda.
          </div>
        )}
        {students.map((s) => (
          <div key={s.id} style={{ borderColor: C.lineSoft }} className="border-b last:border-0 flex items-center justify-between px-4 py-2.5">
            <div>
              <div style={{ color: C.text }} className="text-sm">
                {s.name}
              </div>
              <div style={{ color: C.textFaint }} className="text-xs">
                {units.find((u) => u.id === s.unitId)?.name || "sem unidade"}
              </div>
            </div>
            <button onClick={() => handleRemove(s.id)} style={{ color: C.textFaint }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
