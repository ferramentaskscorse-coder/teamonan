import { useState, useEffect } from "react";
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { Camera, Check, LogOut, Pencil, AlertTriangle, Loader2, Users } from "lucide-react";
import { db, auth, logoutAny } from "../firebase";
import { C, PERIODS, GRAUS, fmtDate, todayISO } from "../theme";
import { Select, FieldLabel, Modal } from "../ui";
import logo from "../assets/logo.jpg";

// Reduz a foto para uma miniatura leve (JPEG, lado máximo 480px) e devolve
// como data URL (texto), para guardar direto no Firestore sem precisar do
// Firebase Storage (que hoje exige plano pago).
function compressPhoto(file, maxDim = 480, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

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
        {me.tipo === "professor" && (
          <TurmaCard me={me} units={units} students={students} classes={classes} attendance={attendance} />
        )}
        <CheckInCard me={me} units={units} professores={professores} classes={classes} attendance={attendance} />
      </div>
    </div>
  );
}

function CompleteCadastro({ units, onLogout }) {
  const [name, setName] = useState("");
  const [tipo, setTipo] = useState("aluno");
  const [unitId, setUnitId] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [grau, setGrau] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isProfessor = tipo === "professor";

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
    if (!isProfessor && (!unitId || !periodo)) {
      setError("Para aluno, unidade e período são obrigatórios.");
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, "students"), {
        uid: auth.currentUser.uid,
        name: name.trim(),
        cpf,
        tipo,
        unitId: unitId || "",
        periodo: periodo || "",
        grau: grau || "",
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
          <FieldLabel>Você é...</FieldLabel>
          <Select
            value={tipo}
            onChange={setTipo}
            placeholder="Tipo"
            options={[
              { value: "aluno", label: "Aluno" },
              { value: "professor", label: "Professor" },
            ]}
          />
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
        <Select value={grau} onChange={setGrau} placeholder="Grau (ainda não definido)" options={GRAUS.map((g) => ({ value: g, label: g }))} />

        {error && (
          <div style={{ color: C.red }} className="text-xs">
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} style={{ background: C.red, color: C.text }} className="rounded-md py-2 text-sm font-semibold disabled:opacity-60">
          {busy ? "Salvando..." : "Salvar cadastro"}
        </button>
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

  async function handleSave() {
    if (!name.trim() || !unitId || !periodo) return;
    setBusy(true);
    await updateDoc(doc(db, "students", me.id), { name: name.trim(), unitId, periodo, grau: grau || "" });
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
      <div className="grid grid-cols-2 gap-2">
        <Select value={unitId} onChange={setUnitId} placeholder="Unidade" options={units.map((u) => ({ value: u.id, label: u.name }))} />
        <Select value={periodo} onChange={setPeriodo} placeholder="Período" options={PERIODS.map((p) => ({ value: p, label: p }))} />
      </div>
      <Select value={grau} onChange={setGrau} placeholder="Grau (ainda não definido)" options={GRAUS.map((g) => ({ value: g, label: g }))} />
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
      await addDoc(collection(db, "attendance"), { classId, studentId: personId });
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
      await addDoc(collection(db, "attendance"), { classId, studentId: me.id, photoUrl: photoDataUrl, selfCheckIn: true });
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
