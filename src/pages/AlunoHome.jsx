import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Camera, Check, LogOut, Pencil, AlertTriangle, Loader2, Users, Clock, X } from "lucide-react";
import { db, auth, logoutAny, setCpfIndex } from "../firebase";
import { C, PERIODS, GRAUS, tipoFromGrau, fmtDate, todayISO, grauEdicaoLiberada, calcularIdade, ehMenorDeIdade, compressPhoto } from "../theme";
import { Select, FieldLabel, Modal, TermoAceite } from "../ui";
import logo from "../assets/logo.jpg";

export default function AlunoHome({ onBack }) {
  const uid = auth.currentUser?.uid;
  const [units, setUnits] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "units"), (s) => setUnits(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "students"), (s) => {
        setStudents(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        setStudentsLoaded(true);
      }),
      onSnapshot(collection(db, "classes"), (s) => setClasses(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
      onSnapshot(collection(db, "attendance"), (s) => setAttendance(s.docs.map((d) => ({ id: d.id, ...d.data() })))),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const me = students.find((s) => s.uid === uid);
  const professores = students.filter((s) => s.tipo === "professor");

  async function handleLogout() {
    await logoutAny();
    onBack();
  }

  // Ainda carregando os dados pela primeira vez — normal, deve ser rápido.
  if (!studentsLoaded) {
    return (
      <div style={{ background: C.bg, color: C.textDim }} className="w-full min-h-screen flex items-center justify-center gap-2 text-sm">
        <Loader2 className="animate-spin" size={18} />
        Carregando...
      </div>
    );
  }

  // Já carregou tudo e não achou um cadastro vinculado a esse login — em vez
  // de ficar girando sem explicação, pede os dados que faltam direto aqui.
  if (!me) {
    return <CompleteCadastro units={units} onLogout={handleLogout} />;
  }

  return (
    <div style={{ background: C.bg }} className="w-full min-h-screen flex flex-col">
      <div style={{ background: C.bgPanel, borderColor: C.line }} className="border-b flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Team Onan" className="w-9 h-9 rounded-full object-cover shrink-0" style={{ border: `1.5px solid ${C.red}` }} />
          <div style={{ color: C.text }} className="font-bold tracking-tight text-sm sm:text-base">
            Team Onan
          </div>
        </div>
        <button onClick={handleLogout} style={{ color: C.textDim }} className="flex items-center gap-1.5 text-xs hover:opacity-80">
          <LogOut size={14} />
          Sair
        </button>
      </div>

      <div className="flex-1 p-4 sm:p-6 flex flex-col gap-6 max-w-xl mx-auto w-full">
        <ProfileCard me={me} units={units} />

        {me.status === "pendente" ? (
          <div style={{ background: C.bgPanel, borderColor: C.brass, color: C.brass }} className="border rounded-md p-4 text-sm flex items-center gap-2">
            <Clock size={16} className="shrink-0" />
            Seu cadastro está aguardando aprovação de um professor ou da equipe. Assim que for aprovado, você já pode
            marcar presença.
          </div>
        ) : (
          <>
            {me.tipo === "professor" && (
              <>
                <AprovacoesCard students={students} units={units} />
                <CadastrarAlunoCard units={units} />
                <TurmaCard me={me} units={units} students={students} classes={classes} attendance={attendance} />
              </>
            )}
            <CheckInCard me={me} units={units} professores={professores} classes={classes} attendance={attendance} />
          </>
        )}
      </div>
    </div>
  );
}

function CompleteCadastro({ units, onLogout }) {
  const [name, setName] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [unitId, setUnitId] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [grau, setGrau] = useState("");
  const [aceite, setAceite] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isProfessor = tipoFromGrau(grau) === "professor";
  const menorDeIdade = ehMenorDeIdade(dataNascimento);

  // se o login foi feito por CPF, o e-mail interno da conta já traz o CPF —
  // aproveita pra não pedir de novo.
  const email = auth.currentUser?.email || "";
  const cpf = email.endsWith("@teamonan.app") ? email.replace("@teamonan.app", "") : "";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Preencha seu nome.");
      return;
    }
    if (!dataNascimento) {
      setError("Preencha sua data de nascimento.");
      return;
    }
    if (menorDeIdade) return;
    if (!isProfessor && (!unitId || !periodo)) {
      setError("Para aluno, unidade e período são obrigatórios.");
      return;
    }
    if (!aceite) {
      setError("Você precisa aceitar o termo para continuar.");
      return;
    }
    setBusy(true);
    try {
      if (cpf) {
        // sem isso, o próximo login não acha o cadastro (era exatamente o
        // bug que fazia essa conta ficar presa em "não encontrado" depois).
        await setCpfIndex(cpf, auth.currentUser.email, auth.currentUser.uid);
      }
      await addDoc(collection(db, "students"), {
        uid: auth.currentUser.uid,
        name: name.trim(),
        cpf,
        dataNascimento,
        tipo: tipoFromGrau(grau),
        unitId: unitId || "",
        periodo: periodo || "",
        grau: grau || "",
        status: "pendente",
        termosAceitos: true,
        termosAceitosEm: serverTimestamp(),
      });
      // a tela sai sozinha assim que o onSnapshot de students encontrar
      // esse novo registro — não precisa fazer nada aqui.
    } catch (err) {
      setError("Não consegui salvar. Tente de novo.");
      setBusy(false);
    }
  }

  return (
    <div style={{ background: C.bg }} className="w-full min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={handleSubmit}
        style={{ background: C.bgPanel, borderColor: C.line }}
        className="w-full max-w-sm border rounded-md p-8 flex flex-col gap-4"
      >
        <div className="flex flex-col items-center gap-3 mb-1">
          <img src={logo} alt="Team Onan" className="w-14 h-14 rounded-full object-cover" style={{ border: `2px solid ${C.red}` }} />
          <div style={{ color: C.text }} className="font-bold text-lg tracking-tight text-center">
            Falta completar seu cadastro
          </div>
          <div style={{ color: C.textFaint }} className="text-xs text-center">
            Seu login já existe, só falta preencher seus dados.
          </div>
        </div>

        <div>
          <FieldLabel>Nome</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            style={{ background: C.bgRaised, borderColor: C.line, color: C.text, height: "42px", boxSizing: "border-box" }}
            className="border rounded-md px-3 py-2 text-sm outline-none w-full"
          />
        </div>
        <div>
          <FieldLabel>Data de nascimento</FieldLabel>
          <input
            type="date"
            value={dataNascimento}
            onChange={(e) => setDataNascimento(e.target.value)}
            style={{ background: C.bgRaised, borderColor: C.line, color: C.text, height: "42px", boxSizing: "border-box", width: "100%", maxWidth: "100%", minWidth: 0 }}
            className="border rounded-md px-3 py-2 text-sm outline-none"
          />
        </div>

        {menorDeIdade ? (
          <div style={{ background: C.redDim, color: C.text }} className="rounded-md p-3 text-sm leading-relaxed">
            Como você é menor de 18 anos, seu cadastro precisa ser feito por um professor ou pela equipe, com a
            autorização assinada do seu responsável. Fale com eles pessoalmente — eles fazem seu cadastro completo.
          </div>
        ) : (
          <>
        <div>
          <FieldLabel>Grau</FieldLabel>
          <Select value={grau} onChange={setGrau} placeholder="Grau (ainda não definido)" options={GRAUS.map((g) => ({ value: g, label: g }))} />
          <div style={{ color: C.textFaint }} className="text-xs mt-1">
            {grau ? `→ cadastro como ${isProfessor ? "Professor" : "Aluno"}.` : "Sem grau → cadastro como Aluno."}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={unitId}
            onChange={setUnitId}
            placeholder={isProfessor ? "Unidade (opcional)" : "Unidade"}
            options={units.map((u) => ({ value: u.id, label: u.name }))}
          />
          <Select
            value={periodo}
            onChange={setPeriodo}
            placeholder={isProfessor ? "Período (opcional)" : "Período"}
            options={PERIODS.map((p) => ({ value: p, label: p }))}
          />
        </div>

        <TermoAceite checked={aceite} onChange={setAceite} />

        {error && (
          <div style={{ color: C.red }} className="text-xs">
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} style={{ background: C.red, color: C.text }} className="rounded-md py-2 text-sm font-semibold disabled:opacity-60">
          {busy ? "Salvando..." : "Salvar cadastro"}
        </button>
          </>
        )}
        <button type="button" onClick={onLogout} style={{ color: C.textFaint }} className="text-xs text-center underline underline-offset-2">
          Sair
        </button>
      </form>
    </div>
  );
}

function ProfileCard({ me, units }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(me.name || "");
  const [unitId, setUnitId] = useState(me.unitId || "");
  const [periodo, setPeriodo] = useState(me.periodo || "");
  const [grau, setGrau] = useState(me.grau || "");
  const [busy, setBusy] = useState(false);
  const isProfessor = tipoFromGrau(grau) === "professor";

  // Grau só é editável pelo próprio aluno dentro da janela de 7 dias que a
  // equipe libera por unidade (avisando "a graduação foi hoje"). Professor
  // já tem confiança suficiente pra editar o próprio grau livremente.
  const minhaUnidade = units.find((u) => u.id === me.unitId);
  const grauBloqueado = me.tipo !== "professor" && !grauEdicaoLiberada(minhaUnidade);

  async function handleSave() {
    if (!name.trim()) return;
    if (!isProfessor && (!unitId || !periodo)) return;
    if (grauBloqueado && grau !== (me.grau || "")) return;
    setBusy(true);
    await updateDoc(doc(db, "students", me.id), {
      name: name.trim(),
      unitId: unitId || "",
      periodo: periodo || "",
      grau: grau || "",
      tipo: tipoFromGrau(grau),
    });
    setBusy(false);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md p-4 flex items-start justify-between gap-3">
        <div>
          <div style={{ color: C.text }} className="font-semibold">
            {me.name}
          </div>
          <div style={{ color: C.textFaint }} className="text-xs mt-0.5">
            {units.find((u) => u.id === me.unitId)?.name || "sem unidade"} · {me.periodo || "sem período"}
            {me.grau ? ` · ${me.grau}` : " · grau ainda não definido"}
          </div>
        </div>
        <button onClick={() => setEditing(true)} style={{ color: C.textFaint }} className="shrink-0">
          <Pencil size={16} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md p-4 flex flex-col gap-2">
      <FieldLabel>Nome</FieldLabel>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
        className="border rounded-md px-3 py-2 text-sm outline-none"
      />
      <Select value={grau} onChange={setGrau} placeholder="Grau (ainda não definido)" options={GRAUS.map((g) => ({ value: g, label: g }))} disabled={grauBloqueado} />
      <div style={{ color: grauBloqueado ? C.textFaint : C.textFaint }} className="text-xs -mt-1 flex items-center gap-1">
        {grauBloqueado ? (
          <>
            <Clock size={11} />
            Só muda com autorização da equipe após uma graduação. Fale com seu professor.
          </>
        ) : grau ? (
          `→ ${isProfessor ? "Professor" : "Aluno"}.`
        ) : (
          "Sem grau → Aluno."
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={unitId} onChange={setUnitId} placeholder={isProfessor ? "Unidade (opcional)" : "Unidade"} options={units.map((u) => ({ value: u.id, label: u.name }))} />
        <Select value={periodo} onChange={setPeriodo} placeholder={isProfessor ? "Período (opcional)" : "Período"} options={PERIODS.map((p) => ({ value: p, label: p }))} />
      </div>
      <div className="flex gap-2 mt-1">
        <button onClick={handleSave} disabled={busy} style={{ background: C.red, color: C.text }} className="rounded-md px-3 py-2 text-sm font-semibold flex-1 disabled:opacity-60">
          Salvar
        </button>
        <button onClick={() => setEditing(false)} style={{ color: C.textFaint }} className="text-sm px-3">
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AprovacoesCard — só para professores já aprovados: aprovar novos
// autocadastros (aluno ou professor). Quem aprovar primeiro resolve — some
// da tela de todo mundo assim que aprovado.
// ---------------------------------------------------------------------------
function AprovacoesCard({ students, units }) {
  const pendentes = students.filter((s) => s.status === "pendente");
  const [confirmandoRecusa, setConfirmandoRecusa] = useState(null);
  if (pendentes.length === 0) return null;

  async function aprovar(id) {
    await updateDoc(doc(db, "students", id), { status: "aprovado", approvedAt: serverTimestamp() });
  }

  async function recusar(id) {
    await deleteDoc(doc(db, "students", id));
    setConfirmandoRecusa(null);
  }

  return (
    <div style={{ background: C.bgPanel, borderColor: C.brass }} className="border rounded-md p-4 flex flex-col gap-3">
      <div style={{ color: C.brass }} className="font-semibold text-sm flex items-center gap-2">
        <Clock size={16} />
        Aprovações pendentes
      </div>
      {pendentes.map((s) => (
        <div key={s.id} style={{ borderColor: C.lineSoft }} className="border-b last:border-0 pb-3 last:pb-0 flex items-center justify-between gap-3">
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
          <div className="flex items-center gap-1.5 shrink-0">
            {confirmandoRecusa === s.id ? (
              <>
                <span style={{ color: C.textFaint }} className="text-xs">
                  Confirma?
                </span>
                <button onClick={() => recusar(s.id)} style={{ background: C.red, color: C.text }} className="rounded-md px-2 py-1.5 text-xs font-medium">
                  Sim
                </button>
                <button onClick={() => setConfirmandoRecusa(null)} style={{ color: C.textFaint }} className="text-xs">
                  Não
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setConfirmandoRecusa(s.id)}
                  style={{ background: C.bgRaised, borderColor: C.line, color: C.textDim }}
                  className="border rounded-md px-2.5 py-1.5 text-xs font-medium flex items-center gap-1"
                >
                  <X size={13} />
                  Recusar
                </button>
                <button onClick={() => aprovar(s.id)} style={{ background: C.red, color: C.text }} className="rounded-md px-3 py-1.5 text-xs font-medium flex items-center gap-1">
                  <Check size={13} />
                  Aprovar
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CadastrarAlunoCard — só para professores: cadastrar alguém presencialmente.
// É o único jeito de cadastrar um menor de 18 anos, porque ele não pode se
// autocadastrar — precisa da autorização assinada do responsável, com foto.
// ---------------------------------------------------------------------------
const EMPTY_CADASTRO_FORM = { name: "", cpf: "", dataNascimento: "", unitId: "", periodo: "", grau: "", responsavelNome: "" };

function CadastrarAlunoCard({ units }) {
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(EMPTY_CADASTRO_FORM);
  const [autorizacaoFoto, setAutorizacaoFoto] = useState(null);
  const [comprimindo, setComprimindo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sucesso, setSucesso] = useState("");

  const isProfessor = tipoFromGrau(form.grau) === "professor";
  const menorDeIdade = ehMenorDeIdade(form.dataNascimento);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  function resetForm() {
    setForm(EMPTY_CADASTRO_FORM);
    setAutorizacaoFoto(null);
    setError("");
  }

  async function handleFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setComprimindo(true);
    try {
      const dataUrl = await compressPhoto(file, 900, 0.7); // documento precisa ficar legível
      setAutorizacaoFoto(dataUrl);
    } catch (err) {
      setError("Não consegui processar a foto. Tente de novo.");
    }
    setComprimindo(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSucesso("");
    if (!form.name.trim()) {
      setError("Preencha o nome.");
      return;
    }
    if (!form.dataNascimento) {
      setError("Preencha a data de nascimento.");
      return;
    }
    if (!isProfessor && (!form.unitId || !form.periodo)) {
      setError("Para aluno, unidade e período são obrigatórios.");
      return;
    }
    if (menorDeIdade && (!form.responsavelNome.trim() || !autorizacaoFoto)) {
      setError("Para menor de idade, preencha o nome do responsável e a foto da autorização assinada.");
      return;
    }

    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        cpf: form.cpf.trim(),
        dataNascimento: form.dataNascimento,
        tipo: tipoFromGrau(form.grau),
        unitId: form.unitId || "",
        periodo: form.periodo || "",
        grau: form.grau || "",
        status: "aprovado", // professor cadastrando pessoalmente já é confiável
      };
      if (menorDeIdade) {
        payload.responsavelNome = form.responsavelNome.trim();
        payload.autorizacaoResponsavelFoto = autorizacaoFoto;
      }
      const ref = await addDoc(collection(db, "students"), payload);
      const cpfKey = payload.cpf.replace(/\D/g, "");
      if (cpfKey) {
        // mesmo padrão do cadastro pelo admin: sem login ainda, então
        // authEmail fica nulo e o que aponta pro cadastro é o studentId.
        await setDoc(doc(db, "cpfIndex", cpfKey), { studentId: ref.id, authEmail: null }).catch(() => {});
      }
      setSucesso(`${payload.name} cadastrado(a) com sucesso.`);
      resetForm();
    } catch (err) {
      setError("Não consegui salvar o cadastro. Tente de novo.");
    }
    setBusy(false);
  }

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        style={{ background: C.bgPanel, borderColor: C.line, color: C.textDim }}
        className="border rounded-md p-4 text-sm font-medium text-left flex items-center gap-2"
      >
        <Users size={16} />
        Cadastrar aluno presencialmente
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md p-4 flex flex-col gap-2">
      <div style={{ color: C.text }} className="font-semibold text-sm flex items-center justify-between">
        Cadastrar aluno presencialmente
        <button type="button" onClick={() => setAberto(false)} style={{ color: C.textFaint }}>
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="Nome"
          style={{ background: C.bgRaised, borderColor: C.line, color: C.text, height: "42px", boxSizing: "border-box" }}
          className="border rounded-md px-3 py-2 text-sm outline-none"
        />
        <input
          value={form.cpf}
          onChange={(e) => setField("cpf", e.target.value.replace(/\D/g, ""))}
          placeholder="CPF (opcional)"
          inputMode="numeric"
          maxLength={11}
          style={{ background: C.bgRaised, borderColor: C.line, color: C.text, height: "42px", boxSizing: "border-box" }}
          className="border rounded-md px-3 py-2 text-sm outline-none"
        />
      </div>

      <div>
        <FieldLabel>Data de nascimento</FieldLabel>
        <input
          type="date"
          value={form.dataNascimento}
          onChange={(e) => setField("dataNascimento", e.target.value)}
          style={{ background: C.bgRaised, borderColor: C.line, color: C.text, height: "42px", boxSizing: "border-box", width: "100%", maxWidth: "100%", minWidth: 0 }}
          className="border rounded-md px-3 py-2 text-sm outline-none"
        />
      </div>

      <Select value={form.grau} onChange={(v) => setField("grau", v)} placeholder="Grau (ainda não definido)" options={GRAUS.map((g) => ({ value: g, label: g }))} />

      <div className="grid grid-cols-2 gap-2">
        <Select value={form.unitId} onChange={(v) => setField("unitId", v)} placeholder={isProfessor ? "Unidade (opcional)" : "Unidade"} options={units.map((u) => ({ value: u.id, label: u.name }))} />
        <Select value={form.periodo} onChange={(v) => setField("periodo", v)} placeholder={isProfessor ? "Período (opcional)" : "Período"} options={PERIODS.map((p) => ({ value: p, label: p }))} />
      </div>

      {menorDeIdade && (
        <div style={{ background: C.bgRaised, borderColor: C.brass }} className="border rounded-md p-3 flex flex-col gap-2">
          <div style={{ color: C.brass }} className="text-xs font-semibold">
            Menor de 18 anos — precisa da autorização do responsável
          </div>
          <input
            value={form.responsavelNome}
            onChange={(e) => setField("responsavelNome", e.target.value)}
            placeholder="Nome do responsável"
            style={{ background: C.bgPanel, borderColor: C.line, color: C.text }}
            className="border rounded-md px-3 py-2 text-sm outline-none"
          />
          <label
            style={{ background: C.bgPanel, borderColor: C.line, color: C.textDim }}
            className="border rounded-md px-3 py-3 text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {comprimindo ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            {comprimindo ? "Processando..." : autorizacaoFoto ? "Trocar foto do documento" : "Foto da autorização assinada"}
            <input type="file" accept="image/*" onChange={handleFoto} className="hidden" disabled={comprimindo} />
          </label>
          {autorizacaoFoto && <img src={autorizacaoFoto} alt="Autorização do responsável" className="rounded-md w-full max-h-48 object-cover" />}
        </div>
      )}

      {error && (
        <div style={{ color: C.red }} className="text-xs">
          {error}
        </div>
      )}
      {sucesso && (
        <div style={{ color: C.oliveBright }} className="text-xs">
          {sucesso}
        </div>
      )}

      <button type="submit" disabled={busy} style={{ background: C.red, color: C.text }} className="rounded-md py-2 text-sm font-semibold disabled:opacity-60">
        {busy ? "Salvando..." : "Cadastrar"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// TurmaCard — só para professores: marcar presença de vários alunos de uma
// vez (o professor é ele mesmo, fixo). Igual ao fluxo do admin, sem foto.
// ---------------------------------------------------------------------------
function TurmaCard({ me, units, students, classes, attendance }) {
  const [unitId, setUnitId] = useState(me.unitId || "");
  const [date, setDate] = useState(todayISO());
  const [periodo, setPeriodo] = useState("");
  const [popup, setPopup] = useState(null);
  const [busy, setBusy] = useState(false);

  const ready = unitId && date && periodo;
  const currentClass = classes.find((c) => c.unitId === unitId && c.period === periodo && c.teacherId === me.id && c.date === date);
  const roster = students.filter((s) => s.unitId === unitId).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  function isChecked(personId) {
    if (!currentClass) return false;
    return attendance.some((a) => a.classId === currentClass.id && a.studentId === personId);
  }

  async function toggleAttendance(personId, personName) {
    if (!ready || busy) return;

    const conflict = attendance.find((a) => {
      if (a.studentId !== personId) return false;
      const cls = classes.find((c) => c.id === a.classId);
      if (!cls) return false;
      if (cls.date !== date || cls.period !== periodo) return false;
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
        const ref1 = await addDoc(collection(db, "classes"), { unitId, period: periodo, teacherId: me.id, date });
        classId = ref1.id;
      }
      await addDoc(collection(db, "attendance"), { classId, studentId: personId, confirmedAt: serverTimestamp() });
    } finally {
      setBusy(false);
    }
  }

  const checkedCount = currentClass ? attendance.filter((a) => a.classId === currentClass.id).length : 0;

  return (
    <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md p-4 flex flex-col gap-3">
      <div style={{ color: C.text }} className="font-semibold text-sm flex items-center gap-2">
        <Users size={16} />
        Marcar presença da turma
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Select value={unitId} onChange={setUnitId} placeholder="Unidade" options={units.map((u) => ({ value: u.id, label: u.name }))} />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            background: C.bgRaised,
            borderColor: C.line,
            color: C.text,
            height: "42px",
            boxSizing: "border-box",
            width: "100%",
            maxWidth: "100%",
            minWidth: 0,
          }}
          className="border rounded-md px-3 py-2 text-sm outline-none"
        />
        <Select value={periodo} onChange={setPeriodo} placeholder="Período" options={PERIODS.map((p) => ({ value: p, label: p }))} />
      </div>

      {!ready && (
        <div style={{ color: C.textFaint }} className="text-xs">
          Selecione unidade, data e período para ver a lista.
        </div>
      )}

      {ready && roster.length === 0 && (
        <div style={{ color: C.textFaint }} className="text-xs">
          Nenhum aluno cadastrado nessa unidade ainda.
        </div>
      )}

      {ready && roster.length > 0 && (
        <div style={{ borderColor: C.line }} className="border rounded-md overflow-hidden">
          <div style={{ borderColor: C.lineSoft, color: C.textDim }} className="border-b px-3 py-2 flex items-center justify-between text-xs">
            <span>
              {fmtDate(date)} · {periodo}
            </span>
            <span style={{ color: C.oliveBright }} className="font-semibold">
              {checkedCount}/{roster.length} presentes
            </span>
          </div>
          {roster.map((p) => {
            const checked = isChecked(p.id);
            return (
              <div key={p.id} style={{ borderColor: C.lineSoft }} className="border-b last:border-0 flex items-center justify-between px-3 py-2">
                <span style={{ color: C.text }} className="text-sm">
                  {p.name}
                  {p.tipo === "professor" && (
                    <span style={{ color: C.brass }} className="text-xs ml-2">
                      (professor)
                    </span>
                  )}
                </span>
                <button
                  onClick={() => toggleAttendance(p.id, p.name)}
                  disabled={busy}
                  style={{ background: checked ? C.olive : "transparent", borderColor: checked ? C.olive : C.line }}
                  className="w-7 h-7 rounded-md border flex items-center justify-center disabled:opacity-50"
                >
                  {checked && <Check size={14} color={C.text} />}
                </button>
              </div>
            );
          })}
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
              {popup.personName} já foi marcado(a) presente hoje no período da {periodo.toLowerCase()}, com o professor{" "}
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

function CheckInCard({ me, units, professores, classes, attendance }) {
  const [unitId, setUnitId] = useState(me.unitId || "");
  const [teacherId, setTeacherId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [periodo, setPeriodo] = useState(me.periodo || "");
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState(null);
  const [done, setDone] = useState(false);

  const ready = unitId && teacherId && date && periodo && photoDataUrl;

  const currentClass = classes.find((c) => c.unitId === unitId && c.period === periodo && c.teacherId === teacherId && c.date === date);
  const alreadyMarked = currentClass ? attendance.some((a) => a.classId === currentClass.id && a.studentId === me.id) : false;

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(false);
    setCompressing(true);
    try {
      const dataUrl = await compressPhoto(file);
      setPhotoDataUrl(dataUrl);
    } catch (err) {
      setPopup({ genericError: true });
    }
    setCompressing(false);
  }

  async function handleConfirm() {
    if (!ready || busy || alreadyMarked) return;

    const conflict = attendance.find((a) => {
      if (a.studentId !== me.id) return false;
      const cls = classes.find((c) => c.id === a.classId);
      if (!cls) return false;
      if (cls.date !== date || cls.period !== periodo) return false;
      if (currentClass && cls.id === currentClass.id) return false;
      return true;
    });
    if (conflict) {
      const cls = classes.find((c) => c.id === conflict.classId);
      const teacherName = professores.find((p) => p.id === cls.teacherId)?.name || "—";
      const unitName = units.find((u) => u.id === cls.unitId)?.name || "—";
      setPopup({ teacherName, unitName });
      return;
    }

    setBusy(true);
    try {
      let classId = currentClass?.id;
      if (!classId) {
        const ref1 = await addDoc(collection(db, "classes"), { unitId, period: periodo, teacherId, date });
        classId = ref1.id;
      }
      await addDoc(collection(db, "attendance"), {
        classId,
        studentId: me.id,
        photoUrl: photoDataUrl,
        selfCheckIn: true,
        confirmedAt: serverTimestamp(),
      });
      setDone(true);
      setPhotoDataUrl(null);
    } catch (err) {
      setPopup({ genericError: true });
    }
    setBusy(false);
  }

  return (
    <div style={{ background: C.bgPanel, borderColor: C.line }} className="border rounded-md p-4 flex flex-col gap-3">
      <div style={{ color: C.text }} className="font-semibold text-sm">
        Marcar minha presença
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <FieldLabel>Unidade</FieldLabel>
          <Select value={unitId} onChange={setUnitId} placeholder="Unidade" options={units.map((u) => ({ value: u.id, label: u.name }))} />
        </div>
        <div>
          <FieldLabel>Professor</FieldLabel>
          <Select value={teacherId} onChange={setTeacherId} placeholder="Professor" options={professores.map((p) => ({ value: p.id, label: p.name }))} />
        </div>
        <div style={{ minWidth: 0 }}>
          <FieldLabel>Data</FieldLabel>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              background: C.bgRaised,
              borderColor: C.line,
              color: C.text,
              height: "42px",
              boxSizing: "border-box",
              width: "100%",
              maxWidth: "100%",
              minWidth: 0,
            }}
            className="border rounded-md px-3 py-2 text-sm outline-none"
          />
        </div>
        <div>
          <FieldLabel>Período</FieldLabel>
          <Select value={periodo} onChange={setPeriodo} placeholder="Período" options={PERIODS.map((p) => ({ value: p, label: p }))} />
        </div>
      </div>

      {alreadyMarked ? (
        <div style={{ background: C.bgRaised, color: C.oliveBright }} className="rounded-md p-3 text-sm flex items-center gap-2">
          <Check size={16} />
          Presença já confirmada para {fmtDate(date)} · {periodo}.
        </div>
      ) : (
        <>
          <label
            style={{ background: C.bgRaised, borderColor: C.line, color: C.textDim }}
            className="border rounded-md px-3 py-3 text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {compressing ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            {compressing ? "Preparando foto..." : photoDataUrl ? "Trocar foto" : "Tirar ou escolher uma foto"}
            <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" disabled={compressing} />
          </label>

          {photoDataUrl && (
            <img src={photoDataUrl} alt="Prévia da foto" className="rounded-md w-full max-h-48 object-cover" />
          )}

          {done && (
            <div style={{ color: C.oliveBright }} className="text-sm flex items-center gap-2">
              <Check size={16} />
              Presença confirmada!
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!ready || busy}
            style={{ background: C.red, color: C.text }}
            className="rounded-md py-2.5 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            Confirmar presença
          </button>
        </>
      )}

      {popup && (
        <Modal onClose={() => setPopup(null)}>
          <div className="flex flex-col items-center text-center gap-3 p-2">
            <div style={{ background: C.redDim }} className="w-11 h-11 rounded-full flex items-center justify-center">
              <AlertTriangle size={20} color={C.text} />
            </div>
            {popup.genericError ? (
              <div style={{ color: C.textDim }} className="text-sm">
                Não consegui enviar sua presença agora. Tente de novo.
              </div>
            ) : (
              <>
                <div style={{ color: C.text }} className="font-semibold">
                  Presença já confirmada
                </div>
                <div style={{ color: C.textDim }} className="text-sm leading-relaxed">
                  Você já marcou presença hoje nesse período, com o professor {popup.teacherName} ({popup.unitName}).
                </div>
              </>
            )}
            <button onClick={() => setPopup(null)} style={{ background: C.red, color: C.text }} className="mt-1 rounded-md px-4 py-2 text-sm font-semibold w-full">
              Entendi
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
