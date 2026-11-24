import type { PermissionKey } from '../types/access';

export interface PresentationPage {
  id: string;
  label: string;
  path: string;
  permission: PermissionKey;
}

export const DEFAULT_PRESENTATION_SEQUENCE: PresentationPage[] = [
  { id: 'faturamento', label: 'Faturamento', path: '/faturamento', permission: 'fretes' },
  { id: 'cotacoes', label: 'Cotações', path: '/cotacoes', permission: 'cotacoes' },
  { id: 'coletas', label: 'Coletas', path: '/coletas', permission: 'coletas' },
  { id: 'performance', label: 'Performance', path: '/performance', permission: 'performance' },
  { id: 'manifestos', label: 'Manifestos', path: '/manifestos', permission: 'manifestos' },
  { id: 'indicadores-gestao-a-vista', label: 'Indicadores de Gestão à Vista', path: '/indicadores-gestao-a-vista', permission: 'indicadoresGestaoAVista' },
];

export function filterPresentationPages(canAccess: (permission: PermissionKey) => boolean): PresentationPage[] {
  return DEFAULT_PRESENTATION_SEQUENCE.filter((page) => canAccess(page.permission));
}

export function destinoApresentacao(destino: string, dataInicio: string, dataFim: string): string {
  const [path, busca] = destino.split('?');
  const params = new URLSearchParams(busca);
  params.set('dataInicio', dataInicio);
  params.set('dataFim', dataFim);
  return path + '?' + params.toString();
}
