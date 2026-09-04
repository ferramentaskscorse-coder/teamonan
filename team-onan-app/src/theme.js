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

export const PERIODS = ["Manhã", "Noite"];

export function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
