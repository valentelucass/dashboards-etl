import type { CSSProperties } from 'react';

type Rgb = readonly [number, number, number];
type Nivel = 0 | 1 | 2;
type Fundos = CSSProperties & {
  '--tracking-fechado': string;
  '--tracking-aberto': string;
  '--tracking-campo': string;
};

const familias: readonly Rgb[] = [
  [89, 150, 213], [70, 166, 146], [180, 138, 203], [206, 158, 99], [202, 132, 151],
];
const siglasDaPaleta = new Map([['AGU', 0], ['SPO', 1], ['CPQ', 2], ['REC', 3], ['TUP', 4]]);
const variacoes = [0, .05, -.04, .025, -.02];
const cartaoClaro: Rgb = [255, 255, 255];
const cartaoEscuro: Rgb = [29, 32, 35];
const campoClaro: Rgb = [244, 245, 246];
const campoEscuro: Rgb = [23, 25, 29];

function chaveEstavel(texto: string) {
  // FNV-1a sobre a identidade da linha, independente da posição da página.
  let hash = 2166136261;
  for (const letra of texto.normalize('NFC')) {
    hash = Math.imul(hash ^ letra.charCodeAt(0), 16777619);
  }
  return hash >>> 0;
}

function misturar(base: Rgb, cor: Rgb, peso: number): Rgb {
  const canal = (i: number) => Math.round(base[i] * (1 - peso) + cor[i] * peso);
  return [canal(0), canal(1), canal(2)];
}

function luminancia(rgb: Rgb) {
  const linear = (byte: number) => {
    const canal = byte / 255;
    return canal <= .04045 ? canal / 12.92 : ((canal + .055) / 1.055) ** 2.4;
  };
  return .2126 * linear(rgb[0]) + .7152 * linear(rgb[1]) + .0722 * linear(rgb[2]);
}

function corDeFundo(base: Rgb, cor: Rgb, peso: number, escuro: boolean) {
  let resultado = misturar(base, cor, peso);
  // Limite da prévia aprovada para manter os rótulos e o alerta legíveis no tema escuro.
  while (escuro && luminancia(resultado) > .071 && peso > 0) {
    peso = Math.max(0, peso - .015);
    resultado = misturar(base, cor, peso);
  }
  return '#' + resultado.map(canal => canal.toString(16).padStart(2, '0')).join('');
}

function nosTemas(clara: string, escura: string) {
  return `light-dark(${clara}, ${escura})`;
}

export function fundosTracking(sigla: string, regiao?: string, minuta?: number): Fundos {
  const nome = sigla.trim().toUpperCase();
  const oficial = siglasDaPaleta.get(nome);
  const chaveGrupo = chaveEstavel(nome);
  const grupo = oficial ?? chaveGrupo % familias.length;
  const familia = oficial !== undefined ? familias[grupo] : misturar(
    familias[grupo], familias[(grupo + 1) % familias.length], .2 + ((chaveGrupo >>> 8) % 50) / 100,
  );
  let nivel: Nivel = 0;
  let tom = grupo;
  let ancora = familia;
  let ajuste = 0;
  if (regiao !== undefined) {
    const chaveRegiao = chaveEstavel(nome + '|' + regiao.trim().toUpperCase());
    const variante = chaveRegiao % familias.length;
    const chave = minuta === undefined ? chaveRegiao : chaveEstavel('frete|' + minuta);
    nivel = minuta === undefined ? 1 : 2;
    tom = minuta === undefined ? variante : (chave + 1) % familias.length;
    // Na região, os bits altos escolhem uma nuance independente da intensidade.
    const secundaria = nivel === 1 ? grupo + variante + 2 + (chaveRegiao >>> 18) : grupo + variante + tom + 3;
    ancora = misturar(familia, familias[secundaria % familias.length], nivel === 1 ? .46 : .60);
    if (minuta !== undefined) {
      // Uma nuance de até 10% distingue fretes que compartilham o mesmo tom.
      const nuance = Math.imul(chave ^ (chave >>> 16), 0x85ebca6b) >>> 0;
      const terceira = familias[(secundaria + 1 + (nuance >>> 16) % 4) % familias.length];
      ancora = misturar(ancora, terceira, (nuance & 255) / 255 * .1);
    }
    // Tons próximos ainda variam quando duas chaves caem na mesma família.
    ajuste = (((chave >>> 8) % 17) - 8) / 320;
  }
  const deslocamento = variacoes[tom] + ajuste;
  return {
    '--tracking-fechado': nosTemas(
      corDeFundo(cartaoClaro, ancora, [.28, .23, .18][nivel] + deslocamento, false),
      corDeFundo(cartaoEscuro, ancora, [.34, .24, .19][nivel] + deslocamento, true),
    ),
    '--tracking-aberto': nosTemas(
      corDeFundo(cartaoClaro, ancora, [.35, .28, .20][nivel] + deslocamento, false),
      corDeFundo(cartaoEscuro, ancora, [.44, .34, .21][nivel] + deslocamento, true),
    ),
    '--tracking-campo': nosTemas(
      corDeFundo(campoClaro, ancora, [.13, .08, .045][nivel], false),
      corDeFundo(campoEscuro, ancora, [.16, .09, .04][nivel], true),
    ),
  };
}
