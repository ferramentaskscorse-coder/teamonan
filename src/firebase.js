import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

// Todas essas chaves vêm do arquivo .env (veja .env.example).
// São "públicas" no sentido de que não são secretas — quem protege os
// dados são as Firestore/Storage Security Rules, não essas chaves.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// ---------------------------------------------------------------------------
// Modo ADMIN (equipe/mestre) — continua usando autenticação anônima do
// Firebase por baixo dos panos, protegida na interface pela senha única
// (ver pages/Login.jsx). Sem identidade própria: é só um "passe" para o
// Firestore aceitar leitura/escrita.
// ---------------------------------------------------------------------------
export function ensureAnonymousAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        if (user) resolve(user);
        else signInAnonymously(auth).then(resolve).catch(reject);
      },
      reject
    );
  });
}

// ---------------------------------------------------------------------------
// Modo ALUNO — login individual por CPF + senha. O Firebase Auth exige um
// e-mail, então cada conta nasce com um e-mail sintético a partir do CPF
// (ex: 12345678900@teamonan.app) — nunca exibido, é só a chave interna de
// login. Se a pessoa informar um e-mail de verdade no cadastro, esse e-mail
// passa a ser o de fato usado na conta (para poder receber recuperação de
// senha) e o vínculo "CPF -> e-mail atual" fica guardado na coleção pública
// cpfIndex, para o login continuar funcionando por CPF de qualquer forma.
// ---------------------------------------------------------------------------
export function cpfDigits(cpf) {
  return (cpf || "").replace(/\D/g, "");
}

export function cpfToEmail(cpf) {
  return `${cpfDigits(cpf)}@teamonan.app`;
}

export function signUpAluno(cpf, senha) {
  return createUserWithEmailAndPassword(auth, cpfToEmail(cpf), senha);
}

export async function setCpfIndex(cpf, authEmail, uid) {
  await setDoc(doc(db, "cpfIndex", cpfDigits(cpf)), { authEmail, uid });
}

async function resolveAuthEmail(cpf) {
  const snap = await getDoc(doc(db, "cpfIndex", cpfDigits(cpf)));
  return snap.exists() ? snap.data().authEmail : null;
}

export async function loginAluno(cpf, senha) {
  // contas criadas antes de existir o índice caem no e-mail sintético direto
  const authEmail = (await resolveAuthEmail(cpf)) || cpfToEmail(cpf);
  return signInWithEmailAndPassword(auth, authEmail, senha);
}

// Nunca lança erro — a tela sempre mostra uma mensagem amigável.
// hasRealEmail=false cobre tanto "CPF não encontrado" quanto "encontrado,
// mas sem e-mail de recuperação salvo" — nos dois casos a orientação para
// quem esqueceu a senha é a mesma: falar com a equipe.
export async function requestPasswordReset(cpf) {
  const authEmail = await resolveAuthEmail(cpf);
  if (!authEmail || authEmail.endsWith("@teamonan.app")) {
    return { hasRealEmail: false };
  }
  await sendPasswordResetEmail(auth, authEmail);
  return { hasRealEmail: true };
}

export function logoutAny() {
  return signOut(auth);
}
