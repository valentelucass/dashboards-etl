import type { CSSProperties } from 'react';

function fundos(fechado: string, aberto: string, campo: string, faixa: string) {
  return {
    '--tracking-fechado': fechado,
    '--tracking-aberto': aberto,
    '--tracking-campo': campo,
    '--tracking-faixa': faixa,
  } as CSSProperties;
}

const paleta = [
  fundos('light-dark(#d1e2f3, #314860)', 'light-dark(#c5daf0, #344d67)', 'light-dark(#e0e9f2, #222d3a)', 'light-dark(#abcde9, #304c66)'),
  fundos('light-dark(#c2e2db, #2c504b)', 'light-dark(#b5dbd3, #2c524c)', 'light-dark(#ddebe9, #1f3030)', 'light-dark(#a8d2c7, #294e48)'),
  fundos('light-dark(#ede3f3, #4a4055)', 'light-dark(#e8dbef, #53465f)', 'light-dark(#ece7f0, #302b39)', 'light-dark(#d4c2e3, #51405f)'),
  fundos('light-dark(#f0e1cf, #564837)', 'light-dark(#eddbc5, #554837)', 'light-dark(#efeae3, #342e28)', 'light-dark(#dec7a6, #56452f)'),
  fundos('light-dark(#f1dfe4, #544048)', 'light-dark(#eed6dd, #5b444d)', 'light-dark(#efe6ea, #342a31)', 'light-dark(#e3bdc9, #5a404a)'),
];
const siglasDaPaleta = new Map([['AGU', 0], ['SPO', 1], ['CPQ', 2], ['REC', 3], ['TUP', 4]]);

export function fundosTracking(sigla: string) {
  const nome = sigla.trim().toUpperCase().normalize('NFC');
  const indice = siglasDaPaleta.get(nome);
  if (indice !== undefined) return paleta[indice];

  let hash = 2166136261;
  for (const letra of nome) hash = Math.imul(hash ^ letra.charCodeAt(0), 16777619);
  return paleta[(hash >>> 0) % paleta.length];
}
