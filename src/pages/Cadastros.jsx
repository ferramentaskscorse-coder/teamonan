import { useState, useRef } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, getDocs, serverTimestamp } from "firebase/firestore";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Plus, Trash2, Pencil, X, Mic, Upload, Loader2, AlertTriangle, Check, Clock } from "lucide-react";
import { db } from "../firebase";
import { C, PERIODS, GRAUS, tipoFromGrau, fmtDate, grauEdicaoLiberada, seteDiasAPartirDeHoje } from "../theme";
import { Select, Modal } from "../ui";

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
  const pendentesCount = students.filter((s) => s.status === "pendente").length;

  return (
    <div className="max-w-2xl">
      <div style={{ borderColor: C.line }} className="border-b flex gap-1 mb-4 flex-wrap">
        {[
          ["unidades", "Unidades"],
          ["pessoas", "Alunos e Professores"],
          ["aprovacoes", `Aprovações${pendentesCount ? ` (${pendentesCount})` : ""}`],
          ["manutencao", "Manutenção"],
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{ color: tab === key ? C.text : key === "aprovacoes" && pendentesCount ? C.brass : C.textFaint, borderColor: tab === key ? C.red : "transparent" }}
            className="text-sm px-3 py-2 border-b-2 -mb-px font-medium"
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "unidades" && <UnitList units={units} />}
      {tab === "pessoas" && <PeopleList units={units} students={students} />}
      {tab === "aprovacoes" && <Aprovacoes students={students} units={units} />}
      {tab === "manutencao" && <Manutencao students={students} />}
    </div>
  );
}

function Aprovacoes({ students, units }) {
  const pendentes = students.filter((s) => s.status === "pendente");

  async function aprovar(id) {
    await updateDoc(doc(db, "students", id), { status: "aprovado", approvedAt: serverTimestamp() });
  }

  return (
    <div className="flex flex-col gap-3">
      <div style={{ color: C.textDim }} className="text-xs leading-relaxed">
        Novos cadastros feitos pela própria pessoa (aluno ou professor) ficam aqui até alguém da equipe ou um professor já
        aprovado confirmar. Quem aprovar primeiro resolve — some da lista dos dois.
      </div>
      {pendentes.length === 0 && (
        <div style={{ background: C.bgPanel, borderColor: C.line, color: C.textFaint }} className="border rounded-md p-6 text-sm text-center">
          Nenhum cadastro esperando aprovação.
        </div>
      )}
      {pendentes.map((s) => (
        <div key={s.id} style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div style={{ color: C.text }} className="text-sm truncate">
              {s.name || "(sem nome)"}
              <span style={{ color: s.tipo === "professor" ? C.brass : C.textFaint }} className="text-xs ml-2">
                {s.tipo === "professor" ? "Professor" : "Aluno"}
              </span>
            </div>
            <div style={{ color: C.textFaint }} className="text-xs truncate">
              {units.find((u) => u.id === s.unitId)?.name || "sem unidade"}
              {s.periodo ? ` · ${s.periodo}` : ""}
              {s.grau ? ` · ${s.grau}` : ""}
            </div>
          </div>
          <button
            onClick={() => aprovar(s.id)}
            style={{ background: C.red, color: C.text }}
            className="rounded-md px-3 py-2 text-sm font-medium flex items-center gap-1.5 shrink-0"
          >
            <Check size={14} />
            Aprovar
          </button>
        </div>
      ))}
    </div>
  );
}

function UnitList({ units }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    await addDoc(collection(db, "units"), { name: name.trim() });
    setName("");
    setBusy(false);
  }

  async function handleRemove(id) {
    await deleteDoc(doc(db, "units", id));
  }

  function startEdit(u) {
    setEditingId(u.id);
    setEditValue(u.name);
  }

  async function saveEdit(id) {
    if (!editValue.trim()) return;
    await updateDoc(doc(db, "units", id), { name: editValue.trim() });
    setEditingId(null);
  }

  async function liberarGrau(id) {
    await updateDoc(doc(db, "units", id), { grauLiberadoAte: seteDiasAPartirDeHoje() });
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome da unidade"
          style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
          className="border rounded-md px-3 py-2 text-sm outline-none flex-1"
        />
        <button type="submit" disabled={busy} style={{ background: C.red, color: C.text }} className="rounded-md px-3 flex items-center justify-center disabled:opacity-60">
          <Plus size={16} />
        </button>
      </form>
      <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md overflow-hidden">
        {units.length === 0 && (
          <div style={{ color: C.textFaint }} className="text-sm px-4 py-6 text-center">
            Nada cadastrado ainda.
          </div>
        )}
        {[...units].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((u) => {
          const liberado = grauEdicaoLiberada(u);
          return (
            <div key={u.id} style={{ borderColor: C.lineSoft }} className="border-b last:border-0 flex items-center justify-between px-4 py-2.5 gap-2">
              {editingId === u.id ? (
                <>
                  <input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    autoFocus
                    style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
                    className="border rounded-md px-2 py-1 text-sm outline-none flex-1"
                  />
                  <button onClick={() => saveEdit(u.id)} style={{ color: C.oliveBright }} className="text-xs font-semibold shrink-0">
                    Salvar
                  </button>
                  <button onClick={() => setEditingId(null)} style={{ color: C.textFaint }} className="shrink-0">
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <div className="min-w-0">
                    <div style={{ color: C.text }} className="text-sm">
                      {u.name}
                    </div>
                    <div style={{ color: liberado ? C.oliveBright : C.textFaint }} className="text-xs flex items-center gap-1">
                      <Clock size={11} />
                      {liberado ? `Troca de grau liberada até ${fmtDate(u.grauLiberadoAte)}` : "Troca de grau bloqueada"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => liberarGrau(u.id)} style={{ background: C.bgRaised, borderColor: C.line, color: C.textDim }} className="border rounded-md px-2 py-1 text-xs">
                      Liberar 7 dias
                    </button>
                    <button onClick={() => startEdit(u)} style={{ color: C.textFaint }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleRemove(u.id)} style={{ color: C.textFaint }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Manutencao({ students }) {
  const [migrando, setMigrando] = useState(false);
  const [migracaoResultado, setMigracaoResultado] = useState("");
  const [confirmZerar, setConfirmZerar] = useState(false);
  const [zerando, setZerando] = useState(false);
  const [zeradoResultado, setZeradoResultado] = useState("");

  async function migrarCadastrosAntigos() {
    setMigrando(true);
    setMigracaoResultado("");
    let count = 0;
    for (const s of students) {
      // cadastros feitos antes de existir a aprovação contam como já aprovados
      if (!s.status) {
        await updateDoc(doc(db, "students", s.id), { status: "aprovado" });
      }
      if (s.uid) continue;
      const cpfKey = (s.cpf || "").replace(/\D/g, "");
      if (!cpfKey) continue;
      const ref = doc(db, "cpfIndex", cpfKey);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, { studentId: s.id, authEmail: null });
        count++;
      }
    }
    setMigrando(false);
    setMigracaoResultado(count > 0 ? `${count} cadastro(s) preparado(s) para login.` : "Todos os cadastros já estavam prontos.");
  }

  async function zerarPresencas() {
    setZerando(true);
    setConfirmZerar(false);
    const [classesSnap, attendanceSnap] = await Promise.all([getDocs(collection(db, "classes")), getDocs(collection(db, "attendance"))]);
    for (const d of attendanceSnap.docs) await deleteDoc(d.ref);
    for (const d of classesSnap.docs) await deleteDoc(d.ref);
    setZerando(false);
    setZeradoResultado(`Apagadas ${attendanceSnap.docs.length} presença(s) e ${classesSnap.docs.length} aula(s). Os cadastros não foram afetados.`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md p-4 flex flex-col gap-3">
        <div style={{ color: C.text }} className="font-semibold text-sm">
          Preparar cadastros antigos para login
        </div>
        <div style={{ color: C.textDim }} className="text-xs leading-relaxed">
          Cadastros feitos manualmente pela equipe antes de existir o login por CPF não têm essa ligação ainda. Rode isso uma vez pra
          habilitar o botão "Concluir cadastro" na tela de login pra essas pessoas. Não afeta quem já tem login.
        </div>
        <button
          onClick={migrarCadastrosAntigos}
          disabled={migrando}
          style={{ background: C.bgRaised, borderColor: C.line, color: C.textDim }}
          className="border rounded-md py-2 text-sm font-medium disabled:opacity-60"
        >
          {migrando ? "Preparando..." : "Preparar cadastros antigos"}
        </button>
        {migracaoResultado && (
          <div style={{ color: C.oliveBright }} className="text-xs">
            {migracaoResultado}
          </div>
        )}
      </div>

      <div style={{ background: C.bgPanel, borderColor: C.red }} className="border rounded-md p-4 flex flex-col gap-3">
        <div style={{ color: C.red }} className="font-semibold text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          Zona de risco
        </div>
        <div style={{ color: C.textDim }} className="text-xs leading-relaxed">
          Apaga TODAS as aulas e presenças já registradas (de todas as unidades). Os cadastros de alunos e professores não são
          afetados. Use antes de começar o uso real, para zerar dados de teste.
        </div>
        <button
          onClick={() => setConfirmZerar(true)}
          disabled={zerando}
          style={{ background: C.red, color: C.text }}
          className="rounded-md py-2 text-sm font-semibold disabled:opacity-60"
        >
          {zerando ? "Apagando..." : "Apagar todas as aulas e presenças"}
        </button>
        {zeradoResultado && (
          <div style={{ color: C.oliveBright }} className="text-xs">
            {zeradoResultado}
          </div>
        )}
      </div>

      {confirmZerar && (
        <Modal onClose={() => setConfirmZerar(false)}>
          <div className="flex flex-col items-center text-center gap-3 p-2">
            <div style={{ background: C.redDim }} className="w-11 h-11 rounded-full flex items-center justify-center">
              <AlertTriangle size={20} color={C.text} />
            </div>
            <div style={{ color: C.text }} className="font-semibold">
              Tem certeza?
            </div>
            <div style={{ color: C.textDim }} className="text-sm leading-relaxed">
              Isso vai apagar permanentemente todas as aulas e presenças registradas. Não tem como desfazer.
            </div>
            <button onClick={zerarPresencas} style={{ background: C.red, color: C.text }} className="rounded-md px-4 py-2 text-sm font-semibold w-full">
              Sim, apagar tudo
            </button>
            <button onClick={() => setConfirmZerar(false)} style={{ color: C.textFaint }} className="text-xs underline underline-offset-2">
              Cancelar
            </button>
          </div>
        </Modal>
      )}
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

const EMPTY_FORM = { name: "", cpf: "", unitId: "", periodo: "", grau: "" };

function PeopleList({ units, students }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [formError, setFormError] = useState("");

  const isProfessor = tipoFromGrau(form.grau) === "professor";

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
    if (!form.name.trim()) {
      setFormError("Preencha o nome.");
      return;
    }
    if (!isProfessor && (!form.unitId || !form.periodo)) {
      const faltando = [];
      if (!form.unitId) faltando.push("unidade");
      if (!form.periodo) faltando.push("período");
      setFormError(`Para aluno, falta preencher: ${faltando.join(", ")}.`);
      return;
    }

    setFormError("");
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      cpf: form.cpf.trim(),
      tipo: tipoFromGrau(form.grau),
      unitId: form.unitId || "",
      periodo: form.periodo || "",
      grau: form.grau || "",
    };
    if (editingId) {
      await updateDoc(doc(db, "students", editingId), payload);
    } else {
      // cadastro feito pela própria equipe já entra aprovado — a aprovação
      // é pra filtrar quem se autocadastra, não quem a equipe já digitou.
      const ref = await addDoc(collection(db, "students"), { ...payload, status: "aprovado" });
      const cpfKey = payload.cpf.replace(/\D/g, "");
      if (cpfKey) {
        // marca esse CPF como "tem cadastro, mas ainda sem login" — é isso
        // que permite a tela de login mostrar "Concluir cadastro" depois.
        await setDoc(doc(db, "cpfIndex", cpfKey), { studentId: ref.id, authEmail: null });
      }
    }
    resetForm();
    setBusy(false);
  }

  function startEdit(s) {
    setForm({
      name: s.name || "",
      cpf: s.cpf || "",
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
            onChange={(e) => setField("cpf", e.target.value.replace(/\D/g, ""))}
            placeholder="CPF (só números)"
            inputMode="numeric"
            maxLength={11}
            style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
            className="border rounded-md px-3 py-2 text-sm outline-none"
          />
          <Select
            value={form.grau}
            onChange={(v) => setField("grau", v)}
            placeholder="Grau (ainda não definido)"
            options={GRAUS.map((g) => ({ value: g, label: g }))}
          />
          <Select
            value={form.unitId}
            onChange={(v) => setField("unitId", v)}
            placeholder={isProfessor ? "Unidade (opcional)" : "Unidade"}
            options={units.map((u) => ({ value: u.id, label: u.name }))}
          />
        </div>
        <Select
          value={form.periodo}
          onChange={(v) => setField("periodo", v)}
          placeholder={isProfessor ? "Período (opcional)" : "Período"}
          options={PERIODS.map((p) => ({ value: p, label: p }))}
        />
        <div style={{ color: C.textFaint }} className="text-xs -mt-1">
          {form.grau
            ? `Grau "${form.grau}" → cadastro como ${isProfessor ? "Professor" : "Aluno"}.`
            : "Sem grau selecionado → cadastro como Aluno. Grau azul claro pra cima vira Professor automaticamente."}
        </div>
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
// Importação em lote — CSV ou XLSX com colunas: Nome, CPF, Unidade, Periodo, Grau
// (Tipo não é mais uma coluna — é derivado do Grau via tipoFromGrau)
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
  async function processRows(rows) {
    let added = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const name = (row.Nome || row.nome || "").toString().trim();
      const cpf = (row.CPF || row.cpf || "").toString().trim();
      const unidadeNome = (row.Unidade || row.unidade || "").toString().trim();
      const periodoRaw = (row["Período"] || row.Periodo || row.periodo || "").toString().trim();
      const grauRaw = (row.Grau || row.grau || "").toString().trim();
      const grau = matchGrau(grauRaw);
      const tipo = tipoFromGrau(grau);

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

      const ref = await addDoc(collection(db, "students"), { name, cpf, tipo, unitId, periodo, grau, status: "aprovado" });
      const cpfKey = cpf.replace(/\D/g, "");
      if (cpfKey) {
        await setDoc(doc(db, "cpfIndex", cpfKey), { studentId: ref.id, authEmail: null });
      }
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
      "Nome,CPF,Unidade,Periodo,Grau\n" +
      "Maria Silva,000.000.000-00,Unidade Centro,Manhã,Branco\n" +
      "Denis Onan Perez de Souza,111.111.111-11,,,Preto\n";
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
          Envie um arquivo .csv ou .xlsx com as colunas <strong>Nome, CPF, Unidade, Periodo, Grau</strong>.
          O grau define automaticamente se a pessoa é Aluno ou Professor: azul claro pra cima vira Professor
          (e nesse caso Unidade/Periodo podem ficar em branco); abaixo disso, ou sem grau, é Aluno.
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
