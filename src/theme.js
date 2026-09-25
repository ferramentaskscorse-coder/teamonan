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

export const TERMO_TEXTO = `TERMO DE RESPONSABILIDADE E AUTORIZAÇÃO DE USO DE IMAGEM

Eu declaro, para os devidos fins, que:

1. TERMO DE RESPONSABILIDADE:
1. Estou ciente de que a prática de atividades físicas envolve riscos inerentes, podendo ocasionar lesões leves, moderadas ou graves.
2. Declaro que me encontro em condições físicas e de saúde adequadas para a prática das atividades propostas, estando apto(a) a realizar treinos físicos, isentando o(a) profissional, academia ou instituição de qualquer responsabilidade por problemas de saúde decorrentes de omissões de informações médicas relevantes.
3. Comprometo-me a respeitar as orientações técnicas, normas de segurança e recomendações fornecidas pelo profissional responsável durante os treinos.
4. Assumo total responsabilidade por quaisquer danos físicos, emocionais ou materiais que possam ocorrer em decorrência da minha participação nas atividades.

2. AUTORIZAÇÃO DE USO DE IMAGEM:
5. Autorizo, de forma gratuita, definitiva e irrevogável, o uso da minha imagem, voz e nome, captados durante treinos, aulas, eventos ou atividades relacionadas, para fins institucionais, promocionais e publicitários.
6. A autorização abrange a veiculação do material em mídias impressas, digitais, redes sociais, sites, vídeos e demais meios de comunicação no Brasil e no exterior.
7. Declaro estar ciente de que não haverá qualquer compensação financeira pelo uso da imagem.

3. DISPOSIÇÕES GERAIS:
8. Este termo tem validade por prazo indeterminado, a partir da data de sua assinatura (o aceite eletrônico abaixo, com CPF e data/hora registrados pelo sistema).

Declaro que li e compreendi todas as cláusulas deste termo, estando de pleno acordo com seu conteúdo.`;

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

export function calcularIdade(dataNascimento) {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nasc = new Date(dataNascimento + "T00:00:00");
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

export function ehMenorDeIdade(dataNascimento) {
  const idade = calcularIdade(dataNascimento);
  return idade !== null && idade < 18;
}

// Reduz uma foto para uma miniatura leve (JPEG, lado máximo 480px) e devolve
// como data URL (texto), pra guardar direto no Firestore sem precisar de
// Storage. Usada tanto pra foto de presença quanto pra foto da autorização
// assinada do responsável de um menor de idade.
export function compressPhoto(file, maxDim = 480, quality = 0.6) {
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

export function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
