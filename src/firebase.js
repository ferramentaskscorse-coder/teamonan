import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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
// e-mail, então construímos um e-mail sintético a partir do CPF
// (ex: 12345678900@teamonan.app). Isso nunca é exibido — é só a chave
// interna de login.
// ---------------------------------------------------------------------------
export function cpfToEmail(cpf) {
  const digits = (cpf || "").replace(/\D/g, "");
  return `${digits}@teamonan.app`;
}

export function signUpAluno(cpf, senha) {
  return createUserWithEmailAndPassword(auth, cpfToEmail(cpf), senha);
}

export function loginAluno(cpf, senha) {
  return signInWithEmailAndPassword(auth, cpfToEmail(cpf), senha);
}

export function logoutAny() {
  return signOut(auth);
}
