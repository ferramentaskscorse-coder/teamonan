# Team Onan — Presença

Sistema de registro de presença e dashboard de frequência para a equipe de
Muay Thai. React + Vite no front-end, Firebase (Firestore + Auth anônima)
como banco de dados.

## O que tem aqui

- **Presença** — unidade → período → professor → data → lista de alunos com
  check de presença. Bloqueia com um aviso se o mesmo aluno já tiver sido
  marcado no mesmo dia/período com outro professor.
- **Dashboard** — total de aulas, total de presenças, média por aula, e
  quebra por unidade e por aluno (taxa de frequência).
- **Cadastros** — unidades, professores e alunos (aluno vinculado a uma
  unidade).
- Login por senha única compartilhada (não é autenticação individual).

## 1. Criar o projeto no Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
   e crie um projeto (ex: `team-onan`).
2. No menu lateral, vá em **Build → Firestore Database** e clique em
   "Criar banco de dados". Escolha uma região próxima (ex: `southamerica-east1`)
   e comece em modo produção.
3. Vá em **Build → Authentication → Sign-in method** e ative o provedor
   **Anônimo**. É assim que o app se autentica com o Firestore por baixo dos
   panos (a senha do app fica separada disso, veja abaixo).
4. Ainda nas configurações do projeto (ícone de engrenagem → **Configurações
   do projeto**), na aba **Geral**, role até "Seus apps" e clique no ícone
   `</>` para registrar um app Web. Copie o objeto `firebaseConfig` que
   aparece — você vai usar no próximo passo.

## 2. Configurar o projeto localmente

```bash
npm install
cp .env.example .env
```

Abra o `.env` e cole os valores do `firebaseConfig` nas variáveis
correspondentes (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN` etc).
Aproveite e troque `VITE_APP_PASSWORD` pela senha que a equipe vai usar para
entrar no app.

```bash
npm run dev
```

Abre em `http://localhost:5173`.

## 3. Publicar no GitHub

```bash
git init
git add .
git commit -m "Primeira versão do sistema de presença"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/teamonan.git
git push -u origin main
```

O `.env` não é enviado (está no `.gitignore`) — cada pessoa que clonar o
projeto precisa criar o próprio `.env` a partir do `.env.example`.

## 4. Publicar o site — GitHub Pages (deploy automático)

O repositório já vem com um workflow (`.github/workflows/deploy.yml`) que
builda e publica o site sozinho a cada `git push` na branch `main`. Passos
únicos de configuração:

1. **Conferir o nome do repositório no `vite.config.js`.** A linha `base:
   "/teamonan/"` precisa bater exatamente com o nome do repositório no
   GitHub (é o que aparece na URL depois de `github.io/`). Se o repositório
   se chamar diferente de `teamonan`, ajuste essa linha antes de commitar.
2. **Cadastrar os secrets.** No GitHub, vá em **Settings → Secrets and
   variables → Actions → New repository secret** e crie um secret para
   cada uma destas chaves (os mesmos valores do seu `.env`):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_APP_PASSWORD`

   Isso é necessário porque o `.env` não vai pro GitHub — o workflow
   precisa desses valores para gerar o build.
3. **Ativar o GitHub Pages.** Em **Settings → Pages**, no campo "Source",
   escolha **GitHub Actions** (não "Deploy from a branch").
4. Dê `git push`. Acompanhe em **Actions**, na aba do repositório — quando
   o workflow terminar (ícone verde), o site estará em
   `https://SEU_USUARIO.github.io/teamonan/`.

Se a página aparecer em branco depois do deploy, quase sempre é porque o
passo 1 ou 2 ficou pendente — confira o console do navegador (F12): um erro
404 pedindo `/src/main.jsx` indica que o `base` do Vite está errado ou que
o build não rodou.

### Alternativa: Firebase Hosting

Se preferir hospedar no Firebase em vez do GitHub Pages:

```bash
npm install -g firebase-tools
firebase login
firebase init
```

No `firebase init`, marque **Hosting** e **Firestore**, selecione "Use an
existing project" e escolha o projeto criado no passo 1. Quando perguntar a
pasta pública, use `dist`; quando perguntar se é single-page app, responda
"Sim".

```bash
npm run build
firebase deploy
```

O terminal mostra a URL pública ao final (algo como
`https://team-onan.web.app`).

## Sobre segurança

O login por senha única é só uma trava na interface — qualquer pessoa que
souber a senha entra com o mesmo acesso. As regras do Firestore
(`firestore.rules`) liberam leitura/escrita para qualquer usuário
autenticado (mesmo anônimo), o que é suficiente para um app interno de
equipe, mas não é um controle de acesso por pessoa. Se no futuro quiser
saber *quem* marcou cada presença ou ter permissões diferentes por
professor, o próximo passo natural é trocar a autenticação anônima por
login individual (Firebase Auth com e-mail/senha) — me chama quando quiser
migrar.
