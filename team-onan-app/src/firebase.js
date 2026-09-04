import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// Todas essas chaves vêm do arquivo .env (veja .env.example).
// São "públicas" no sentido de que não são secretas — quem protege os
// dados são as Firestore Security Rules (veja firestore.rules), não essas chaves.
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

// O app usa uma senha única compartilhada para a interface (ver App.jsx),
// mas o Firestore exige alguém autenticado para ler/gravar. Por isso, por
// baixo dos panos, entramos com autenticação anônima do Firebase assim que
// o app carrega — isso satisfaz as regras de segurança sem exigir um login
// de verdade por pessoa.
export function ensureAnonymousAuth() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        if (user) {
          resolve(user);
        } else {
          signInAnonymously(auth).then(resolve).catch(reject);
        }
      },
      reject
    );
  });
}
