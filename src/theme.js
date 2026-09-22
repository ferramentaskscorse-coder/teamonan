// Paleta — canto de academia: fundo carvão, vermelho de faixa/luva,
// pergaminho pra texto, verde-oliva pra "presente", latão pra destaques.
export const C = {
  bg: "#141310",
  bgPanel: "#1C1A16",
  bgRaised: "#242119",
  line: "#39352C",
  lineSoft: "#2A271F",
  text: "#EDE6D6",
  textDim: "#A79E8C",
  textFaint: "#6E6858",
  red: "#B8272B",
  redDim: "#7A2224",
  olive: "#5C6B45",
  oliveBright: "#7C8F58",
  brass: "#BB8C43",
};

export const PERIODS = ["Manhã", "Tarde", "Noite"];

export const GRAUS = [
  "Branco",
  "Branco ponta vermelho",
  "Vermelho",
  "Vermelho ponta azul claro",
  "Azul claro",
  "Azul claro ponta azul escuro",
  "Azul escuro",
  "Azul escuro ponta preto",
  "Preto",
];

// Grau azul claro pra cima conta como professor — quem ainda não tem grau
// ou está abaixo disso é aluno. Uma única fonte de verdade usada em todo
// formulário de cadastro, pra Tipo nunca precisar ser escolhido à mão.
const GRAUS_PROFESSOR = new Set(["Azul escuro", "Azul escuro ponta preto", "Preto"]);

export function tipoFromGrau(grau) {
  return GRAUS_PROFESSOR.has(grau) ? "professor" : "aluno";
}

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// Janela de 7 dias em que o próprio aluno pode alterar o grau, liberada
// pela equipe quando avisa "a graduação foi hoje" numa unidade.
export function grauEdicaoLiberada(unit) {
  return !!unit?.grauLiberadoAte && unit.grauLiberadoAte >= todayISO();
}

export function seteDiasAPartirDeHoje() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
