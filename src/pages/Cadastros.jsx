import { useState, useRef } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Plus, Trash2, Pencil, X, Mic, Upload, Loader2 } from "lucide-react";
import { db } from "../firebase";
import { C, PERIODS, GRAUS } from "../theme";
import { Select, Modal } from "../ui";

const TIPOS = [
  { value: "aluno", label: "Aluno" },
  { value: "professor", label: "Professor" },
];

function normalize(str) {
  return (str || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function Cadastros({ units, students }) {
  const [tab, setTab] = useState("unidades");

  return (
    <div className="max-w-2xl">
      <div style={{ borderColor: C.line }} className="border-b flex gap-1 mb-4">
        {[
          ["unidades", "Unidades"],
          ["pessoas", "Alunos e Professores"],
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

      {tab === "pessoas" && <PeopleList units={units} students={students} />}
    </div>
  );
}

function SimpleList({ items, collectionName, onAdd, placeholder, allowEdit }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

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

  function startEdit(it) {
    setEditingId(it.id);
    setEditValue(it.name);
  }

  async function saveEdit(id) {
    if (!editValue.trim()) return;
    await updateDoc(doc(db, collectionName, id), { name: editValue.trim() });
    setEditingId(null);
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
        {[...items].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((it) => (
          <div key={it.id} style={{ borderColor: C.lineSoft }} className="border-b last:border-0 flex items-center justify-between px-4 py-2.5 gap-2">
            {editingId === it.id ? (
              <>
                <input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
                  className="border rounded-md px-2 py-1 text-sm outline-none flex-1"
                />
                <button onClick={() => saveEdit(it.id)} style={{ color: C.oliveBright }} className="text-xs font-semibold shrink-0">
                  Salvar
                </button>
                <button onClick={() => setEditingId(null)} style={{ color: C.textFaint }} className="shrink-0">
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <span style={{ color: C.text }} className="text-sm flex-1">
                  {it.name}
                </span>
                {allowEdit && (
                  <button onClick={() => startEdit(it)} style={{ color: C.textFaint }} className="shrink-0">
                    <Pencil size={14} />
                  </button>
                )}
                <button onClick={() => handleRemove(it.id)} style={{ color: C.textFaint }} className="shrink-0">
                  <Trash2 size={15} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY_FORM = { name: "", cpf: "", tipo: "aluno", unitId: "", periodo: "", grau: "" };

function PeopleList({ units, students }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [formError, setFormError] = useState("");

  const isProfessor = form.tipo === "professor";

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFormError("");
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    if (!form.name.trim() || !form.cpf.trim()) {
      setFormError("Preencha nome e CPF.");
      return;
    }
    if (!isProfessor && (!form.unitId || !form.periodo || !form.grau)) {
      const faltando = [];
      if (!form.unitId) faltando.push("unidade");
      if (!form.periodo) faltando.push("período");
      if (!form.grau) faltando.push("grau");
      setFormError(`Para aluno, falta preencher: ${faltando.join(", ")}.`);
      return;
    }

    setFormError("");
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      cpf: form.cpf.trim(),
      tipo: form.tipo,
      unitId: form.unitId || "",
      periodo: form.periodo || "",
      grau: form.grau || "",
    };
    if (editingId) {
      await updateDoc(doc(db, "students", editingId), payload);
    } else {
      await addDoc(collection(db, "students"), payload);
    }
    resetForm();
    setBusy(false);
  }

  function startEdit(s) {
    setForm({
      name: s.name || "",
      cpf: s.cpf || "",
      tipo: s.tipo || "aluno",
      unitId: s.unitId || "",
      periodo: s.periodo || "",
      grau: s.grau || "",
    });
    setEditingId(s.id);
    setFormError("");
  }

  async function handleRemove(id) {
    await deleteDoc(doc(db, "students", id));
    if (editingId === id) resetForm();
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        {editingId && (
          <div style={{ color: C.brass }} className="text-xs font-medium">
            Editando cadastro — <button type="button" onClick={resetForm} style={{ color: C.textFaint }} className="underline underline-offset-2">cancelar</button>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="Nome"
            style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
            className="border rounded-md px-3 py-2 text-sm outline-none"
          />
          <input
            value={form.cpf}
            onChange={(e) => setField("cpf", e.target.value)}
            placeholder="CPF"
            style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
            className="border rounded-md px-3 py-2 text-sm outline-none"
          />
          <Select value={form.tipo} onChange={(v) => setField("tipo", v)} placeholder="Tipo" options={TIPOS} />
          <Select
            value={form.unitId}
            onChange={(v) => setField("unitId", v)}
            placeholder={isProfessor ? "Unidade (opcional)" : "Unidade"}
            options={units.map((u) => ({ value: u.id, label: u.name }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={form.periodo}
            onChange={(v) => setField("periodo", v)}
            placeholder={isProfessor ? "Período (opcional)" : "Período"}
            options={PERIODS.map((p) => ({ value: p, label: p }))}
          />
          <Select
            value={form.grau}
            onChange={(v) => setField("grau", v)}
            placeholder={isProfessor ? "Grau (opcional)" : "Grau"}
            options={GRAUS.map((g) => ({ value: g, label: g }))}
          />
        </div>
        {isProfessor && (
          <div style={{ color: C.textFaint }} className="text-xs -mt-1">
            Professor não precisa de unidade, período ou grau — preencha só se fizer sentido.
          </div>
        )}
        {formError && (
          <div style={{ color: C.red }} className="text-xs -mt-1">
            {formError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="submit"
            disabled={busy}
            style={{ background: C.red, color: C.text }}
            className="rounded-md px-3 py-2 flex items-center justify-center gap-1.5 text-sm font-medium disabled:opacity-60 flex-1"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {editingId ? "Salvar alteração" : "Adicionar cadastro"}
          </button>
          <VoiceFillButton units={units} setForm={setForm} />
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            style={{ background: C.bgRaised, borderColor: C.line, color: C.textDim }}
            className="border rounded-md px-3 py-2 flex items-center justify-center gap-1.5 text-sm font-medium"
          >
            <Upload size={16} />
            Importar lote
          </button>
        </div>
      </form>

      {units.length === 0 && (
        <div style={{ color: C.textFaint }} className="text-xs">
          Cadastre uma unidade antes de adicionar alunos.
        </div>
      )}

      <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md overflow-hidden">
        {students.length === 0 && (
          <div style={{ color: C.textFaint }} className="text-sm px-4 py-6 text-center">
            Nada cadastrado ainda.
          </div>
        )}
        {[...students].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((s) => (
          <div key={s.id} style={{ borderColor: C.lineSoft }} className="border-b last:border-0 flex items-center justify-between px-4 py-2.5 gap-2">
            <div className="min-w-0">
              <div style={{ color: C.text }} className="text-sm truncate">
                {s.name}
                <span style={{ color: s.tipo === "professor" ? C.brass : C.textFaint }} className="text-xs ml-2">
                  {s.tipo === "professor" ? "Professor" : "Aluno"}
                </span>
              </div>
              <div style={{ color: C.textFaint }} className="text-xs truncate">
                {units.find((u) => u.id === s.unitId)?.name || (s.tipo === "professor" ? "todas as unidades" : "sem unidade")}
                {s.periodo ? ` · ${s.periodo}` : ""}
                {s.grau ? ` · ${s.grau}` : ""}
                {s.cpf ? ` · ${s.cpf}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => startEdit(s)} style={{ color: C.textFaint }}>
                <Pencil size={14} />
              </button>
              <button onClick={() => handleRemove(s.id)} style={{ color: C.textFaint }}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {importOpen && <ImportModal units={units} onClose={() => setImportOpen(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preenchimento por voz — grava nome, CPF, unidade e período em sequência.
// Depende da Web Speech API (funciona bem no Chrome; navegadores sem suporte
// mostram um aviso e o formulário continua preenchível na mão).
// ---------------------------------------------------------------------------
const VOICE_STEPS = [
  { field: "name", label: "nome" },
  { field: "cpf", label: "CPF" },
  { field: "unitId", label: "unidade" },
  { field: "periodo", label: "período" },
];

function VoiceFillButton({ units, setForm }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef(null);

  function getRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    return rec;
  }

  function startSequence() {
    const rec = getRecognition();
    if (!rec) {
      setUnsupported(true);
      return;
    }
    setUnsupported(false);
    setActive(true);
    setStepIndex(0);
    listenStep(rec, 0);
  }

  function listenStep(rec, idx) {
    if (idx >= VOICE_STEPS.length) {
      setActive(false);
      return;
    }
    setStepIndex(idx);
    rec.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      applyTranscript(VOICE_STEPS[idx].field, transcript);
      setTimeout(() => {
        const nextRec = getRecognition();
        if (nextRec) listenStep(nextRec, idx + 1);
        else setActive(false);
      }, 400);
    };
    rec.onerror = () => setActive(false);
    recognitionRef.current = rec;
    rec.start();
  }

  function applyTranscript(field, transcript) {
    if (field === "unitId") {
      const match = units.find((u) => normalize(transcript).includes(normalize(u.name)) || normalize(u.name).includes(normalize(transcript)));
      setForm((f) => ({ ...f, unitId: match ? match.id : f.unitId }));
    } else if (field === "periodo") {
      const match = PERIODS.find((p) => normalize(transcript).includes(normalize(p)));
      setForm((f) => ({ ...f, periodo: match || f.periodo }));
    } else {
      setForm((f) => ({ ...f, [field]: transcript.trim() }));
    }
  }

  function stopSequence() {
    recognitionRef.current?.stop();
    setActive(false);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={active ? stopSequence : startSequence}
        style={{
          background: active ? C.red : C.bgRaised,
          borderColor: active ? C.red : C.line,
          color: active ? C.text : C.textDim,
        }}
        className="border rounded-md px-3 py-2 flex items-center justify-center gap-1.5 text-sm font-medium"
      >
        <Mic size={16} />
        {active ? `Ouvindo ${VOICE_STEPS[stepIndex]?.label}...` : "Preencher por voz"}
      </button>
      {unsupported && (
        <span style={{ color: C.textFaint }} className="text-xs">
          Seu navegador não suporta reconhecimento de voz.
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Importação em lote — CSV ou XLSX com colunas: Nome, CPF, Tipo, Unidade, Periodo, Grau
// ---------------------------------------------------------------------------
function ImportModal({ units, onClose }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  function findUnit(name) {
    return units.find((u) => normalize(u.name) === normalize(name));
  }
  function matchPeriodo(value) {
    return PERIODS.find((p) => normalize(p) === normalize(value)) || "";
  }
  function matchGrau(value) {
    return GRAUS.find((g) => normalize(g) === normalize(value)) || "";
  }
  function matchTipo(value) {
    return normalize(value) === "professor" ? "professor" : "aluno";
  }

  async function processRows(rows) {
    let added = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = (row.Nome || row.nome || "").toString().trim();
      const cpf = (row.CPF || row.cpf || "").toString().trim();
      const tipo = matchTipo(row.Tipo || row.tipo || "aluno");
      const unidadeNome = (row.Unidade || row.unidade || "").toString().trim();
      const periodoRaw = (row["Período"] || row.Periodo || row.periodo || "").toString().trim();
      const grauRaw = (row.Grau || row.grau || "").toString().trim();

      if (!name) {
        errors.push(`Linha ${i + 2}: sem nome, ignorada.`);
        continue;
      }

      let unitId = "";
      if (unidadeNome) {
        const unit = findUnit(unidadeNome);
        if (!unit) {
          if (tipo === "aluno") {
            errors.push(`Linha ${i + 2} (${name}): unidade "${unidadeNome}" não encontrada.`);
            continue;
          }
        } else {
          unitId = unit.id;
        }
      } else if (tipo === "aluno") {
        errors.push(`Linha ${i + 2} (${name}): unidade obrigatória para aluno.`);
        continue;
      }

      const periodo = matchPeriodo(periodoRaw);
      const grau = matchGrau(grauRaw);

      await addDoc(collection(db, "students"), { name, cpf, tipo, unitId, periodo, grau });
      added++;
    }
    setResult({ added, errors });
    setBusy(false);
  }

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);

    const isCsv = file.name.toLowerCase().endsWith(".csv");
    if (isCsv) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => processRows(res.data),
      });
    } else {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        processRows(rows);
      };
      reader.readAsArrayBuffer(file);
    }
  }

  function downloadTemplate() {
    const csv =
      "Nome,CPF,Tipo,Unidade,Periodo,Grau\n" +
      "Maria Silva,000.000.000-00,Aluno,Unidade Centro,Manhã,Branco\n" +
      "Denis Onan Perez de Souza,111.111.111-11,Professor,,,\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-cadastro.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Modal onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div style={{ color: C.text }} className="font-semibold">
          Importar em lote
        </div>
        <div style={{ color: C.textDim }} className="text-xs leading-relaxed">
          Envie um arquivo .csv ou .xlsx com as colunas <strong>Nome, CPF, Tipo, Unidade, Periodo, Grau</strong>.
          Tipo deve ser "Aluno" ou "Professor" — para Professor, Unidade/Periodo/Grau podem ficar em branco.
        </div>
        <button onClick={downloadTemplate} style={{ color: C.brass }} className="text-xs underline underline-offset-2 text-left">
          Baixar modelo .csv
        </button>
        <input type="file" accept=".csv,.xlsx" onChange={handleFile} style={{ color: C.textDim }} className="text-xs" />
        {busy && (
          <div style={{ color: C.textDim }} className="text-xs flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Importando...
          </div>
        )}
        {result && (
          <div style={{ background: C.bgRaised, borderColor: C.line }} className="border rounded-md p-3 text-xs flex flex-col gap-1">
            <div style={{ color: C.oliveBright }} className="font-semibold">
              {result.added} cadastro(s) importado(s).
            </div>
            {result.errors.length > 0 && (
              <div style={{ color: C.red }} className="flex flex-col gap-0.5">
                {result.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={onClose} style={{ background: C.red, color: C.text }} className="mt-1 rounded-md px-4 py-2 text-sm font-semibold w-full">
          Fechar
        </button>
      </div>
    </Modal>
  );
}
