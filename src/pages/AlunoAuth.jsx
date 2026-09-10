import { useState, useEffect } from "react";
import { collection, onSnapshot, getDocs, addDoc, updateDoc, doc } from "firebase/firestore";
import { updateEmail } from "firebase/auth";
import { signUpAluno, loginAluno, setCpfIndex, requestPasswordReset, cpfToEmail, db } from "../firebase";
import { C, PERIODS } from "../theme";
import { Select, FieldLabel } from "../ui";
import logo from "../assets/logo.jpg";

function normalizeCpf(cpf) {
  return (cpf || "").replace(/\D/g, "");
}

export default function AlunoAuth({ onBack }) {
  const [mode, setMode] = useState("login"); // "login" | "signup" | "forgot"
  const [units, setUnits] = useState([]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  // unidades são públicas para leitura, então já carregam mesmo sem login
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "units"), (snap) => setUnits(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  function switchMode(m) {
    setMode(m);
    setError("");
    setInfo("");
  }

  // -------- login --------
  const [loginCpf, setLoginCpf] = useState("");
  const [loginSenha, setLoginSenha] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    if (!loginCpf.trim() || !loginSenha) return;
    setBusy(true);
    setError("");
    try {
      await loginAluno(loginCpf, loginSenha);
    } catch (err) {
      setError("CPF ou senha incorretos.");
    }
    setBusy(false);
  }

  // -------- esqueci minha senha --------
  const [forgotCpf, setForgotCpf] = useState("");

  async function handleForgot(e) {
    e.preventDefault();
    if (!forgotCpf.trim()) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const result = await requestPasswordReset(forgotCpf);
      if (!result.hasRealEmail) {
        setError("Esse cadastro não tem e-mail de recuperação salvo. Peça para a equipe te ajudar a trocar a senha.");
      } else {
        setInfo("Enviamos um link de recuperação para o e-mail cadastrado.");
      }
    } catch (err) {
      setError("Não consegui processar agora. Tente de novo.");
    }
    setBusy(false);
  }

  // -------- cadastro --------
  const [name, setName] = useState("");
  const [signupCpf, setSignupCpf] = useState("");
  const [tipo, setTipo] = useState("aluno");
  const [senha, setSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [unitId, setUnitId] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const isProfessor = tipo === "professor";

  async function handleSignup(e) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !signupCpf.trim()) {
      setError("Preencha nome e CPF.");
      return;
    }
    if (!isProfessor && (!unitId || !periodo)) {
      setError("Para aluno, unidade e período são obrigatórios.");
      return;
    }
    if (senha.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmSenha) {
      setError("As senhas não conferem.");
      return;
    }

    setBusy(true);
    try {
      const cred = await signUpAluno(signupCpf, senha);
      const uid = cred.user.uid;

      // se a pessoa informou um e-mail de verdade, ele vira o e-mail da conta
      // (necessário para "esqueci minha senha" funcionar de verdade)
      let authEmail = cpfToEmail(signupCpf);
      if (recoveryEmail.trim()) {
        try {
          await updateEmail(cred.user, recoveryEmail.trim());
          authEmail = recoveryEmail.trim();
        } catch (e) {
          // se não conseguir (ex: e-mail já usado em outra conta), segue com o sintético
        }
      }
      await setCpfIndex(signupCpf, authEmail, uid);

      // tenta encontrar um cadastro já existente (feito pela equipe) com o mesmo CPF
      const cpfDigits = normalizeCpf(signupCpf);
      const snap = await getDocs(collection(db, "students"));
      const existing = snap.docs.find((d) => cpfDigits !== "" && normalizeCpf(d.data().cpf) === cpfDigits);

      const payload = {
        name: name.trim(),
        cpf: signupCpf.trim(),
        tipo,
        unitId: unitId || "",
        periodo: periodo || "",
        uid,
      };

      if (existing) {
        await updateDoc(doc(db, "students", existing.id), payload);
      } else {
        await addDoc(collection(db, "students"), { ...payload, grau: "" });
      }
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError('Esse CPF já tem cadastro. Use a opção "Entrar".');
      } else if (err.code === "auth/invalid-email") {
        setError("CPF inválido.");
      } else {
        setError("Não consegui criar o cadastro. Tente de novo.");
      }
    }
    setBusy(false);
  }

  return (
    <div style={{ background: C.bg }} className="w-full min-h-screen flex items-center justify-center p-6">
      <div style={{ background: C.bgPanel, borderColor: C.line }} className="w-full max-w-sm border rounded-md p-8 flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 mb-1">
          <img src={logo} alt="Team Onan" className="w-14 h-14 rounded-full object-cover" style={{ border: `2px solid ${C.red}` }} />
          <div style={{ color: C.text }} className="font-bold text-lg tracking-tight">
            Team Onan
          </div>
        </div>

        {mode !== "forgot" && (
          <div style={{ borderColor: C.line }} className="border-b flex gap-1">
            {[
              ["login", "Entrar"],
              ["signup", "Criar cadastro"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => switchMode(key)}
                style={{ color: mode === key ? C.text : C.textFaint, borderColor: mode === key ? C.red : "transparent" }}
                className="text-sm px-3 py-2 border-b-2 -mb-px font-medium"
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "login" && (
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <div>
              <FieldLabel>CPF</FieldLabel>
              <input
                value={loginCpf}
                onChange={(e) => setLoginCpf(e.target.value)}
                style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
                className="border rounded-md px-3 py-2 text-sm outline-none w-full"
              />
            </div>
            <div>
              <FieldLabel>Senha</FieldLabel>
              <input
                type="password"
                value={loginSenha}
                onChange={(e) => setLoginSenha(e.target.value)}
                style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
                className="border rounded-md px-3 py-2 text-sm outline-none w-full"
              />
            </div>
            {error && (
              <div style={{ color: C.red }} className="text-xs">
                {error}
              </div>
            )}
            <button type="submit" disabled={busy} style={{ background: C.red, color: C.text }} className="rounded-md py-2 text-sm font-semibold disabled:opacity-60">
              Entrar
            </button>
            <button type="button" onClick={() => switchMode("forgot")} style={{ color: C.textFaint }} className="text-xs text-center underline underline-offset-2">
              Esqueci minha senha
            </button>
          </form>
        )}

        {mode === "forgot" && (
          <form onSubmit={handleForgot} className="flex flex-col gap-3">
            <div style={{ color: C.textDim }} className="text-xs leading-relaxed">
              Informe o CPF do seu cadastro. Se você salvou um e-mail de recuperação, enviamos um link para trocar a senha.
            </div>
            <div>
              <FieldLabel>CPF</FieldLabel>
              <input
                value={forgotCpf}
                onChange={(e) => setForgotCpf(e.target.value)}
                style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
                className="border rounded-md px-3 py-2 text-sm outline-none w-full"
              />
            </div>
            {error && (
              <div style={{ color: C.red }} className="text-xs">
                {error}
              </div>
            )}
            {info && (
              <div style={{ color: C.oliveBright }} className="text-xs">
                {info}
              </div>
            )}
            <button type="submit" disabled={busy} style={{ background: C.red, color: C.text }} className="rounded-md py-2 text-sm font-semibold disabled:opacity-60">
              Enviar link de recuperação
            </button>
            <button type="button" onClick={() => switchMode("login")} style={{ color: C.textFaint }} className="text-xs text-center underline underline-offset-2">
              Voltar para o login
            </button>
          </form>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignup} className="flex flex-col gap-3">
            <div>
              <FieldLabel>Nome</FieldLabel>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
                className="border rounded-md px-3 py-2 text-sm outline-none w-full"
              />
            </div>
            <div>
              <FieldLabel>CPF</FieldLabel>
              <input
                value={signupCpf}
                onChange={(e) => setSignupCpf(e.target.value)}
                style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
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
            <div>
              <FieldLabel>Senha (mínimo 6 caracteres)</FieldLabel>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
                className="border rounded-md px-3 py-2 text-sm outline-none w-full"
              />
            </div>
            <div>
              <FieldLabel>Confirmar senha</FieldLabel>
              <input
                type="password"
                value={confirmSenha}
                onChange={(e) => setConfirmSenha(e.target.value)}
                style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
                className="border rounded-md px-3 py-2 text-sm outline-none w-full"
              />
            </div>
            <div>
              <FieldLabel>E-mail de recuperação (opcional)</FieldLabel>
              <input
                type="email"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                placeholder="Só é usado se você esquecer a senha"
                style={{ background: C.bgRaised, borderColor: C.line, color: C.text }}
                className="border rounded-md px-3 py-2 text-sm outline-none w-full"
              />
            </div>
            {error && (
              <div style={{ color: C.red }} className="text-xs">
                {error}
              </div>
            )}
            <button type="submit" disabled={busy} style={{ background: C.red, color: C.text }} className="rounded-md py-2 text-sm font-semibold disabled:opacity-60">
              Criar cadastro
            </button>
          </form>
        )}

        <button onClick={onBack} style={{ color: C.textFaint }} className="text-xs text-center underline underline-offset-2">
          Voltar
        </button>
      </div>
    </div>
  );
}
