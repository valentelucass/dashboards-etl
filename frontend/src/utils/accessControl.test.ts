import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_NAV_ITEMS,
  canAccess,
  canManageCommunications,
  createEmptyPermissionMap,
  firstAccessibleRoute,
  isAdministrativeDashboardNavItem,
} from './accessControl';

describe('accessControl', () => {
  it('exibe Manifestos no link da rota de manifestos', () => {
    expect(DASHBOARD_NAV_ITEMS.find(item => item.path === '/manifestos')).toMatchObject({
      label: 'Manifestos',
      permission: 'manifestos',
    });
  });

  it('inclui a permissão indicadoresGestaoAVista no mapa vazio', () => {
    expect(createEmptyPermissionMap()).toMatchObject({
      indicadoresGestaoAVista: false,
      homeComunicados: false,
      can_manage_kpi_goals: false,
      can_manage_communications: false,
    });
  });

  it('redireciona usuários autenticados para a Home', () => {
    expect(firstAccessibleRoute({
      papel: 'usuario_comum',
      exigeTrocaSenha: false,
      permissoesEfetivas: {
        ...createEmptyPermissionMap(),
        indicadoresGestaoAVista: true,
      },
    })).toBe('/');
  });

  it('mantém troca obrigatória de senha antes da Home', () => {
    expect(firstAccessibleRoute({
      papel: 'usuario_comum',
      exigeTrocaSenha: true,
      permissoesEfetivas: createEmptyPermissionMap(),
    })).toBe('/alterar-senha');
  });

  it('redireciona sessão ausente para login', () => {
    expect(firstAccessibleRoute(null)).toBe('/login');
  });

  it('trata desenvolvedor@rodogarcia.com.br como acesso total', () => {
    expect(canAccess({
      id: 'dev',
      nome: 'Desenvolvedor',
      email: 'desenvolvedor@rodogarcia.com.br',
      papel: 'usuario_comum',
      setor: { id: '1', nome: 'TI' },
      permissoesEfetivas: createEmptyPermissionMap(),
      filiaisPermitidasEfetivas: [],
      exigeTrocaSenha: false,
      sessaoExpiraEm: new Date(Date.now() + 60_000).toISOString(),
    }, 'homeComunicados')).toBe(true);
  });

  it('trata can_manage_communications como alias de homeComunicados', () => {
    const usuario = {
      id: 'user',
      nome: 'Usuário',
      email: 'user@example.com',
      papel: 'usuario_comum',
      setor: { id: '1', nome: 'TI' },
      permissoesEfetivas: {
        ...createEmptyPermissionMap(),
        can_manage_communications: true,
      },
      filiaisPermitidasEfetivas: [],
      exigeTrocaSenha: false,
      sessaoExpiraEm: new Date(Date.now() + 60_000).toISOString(),
    };

    expect(canManageCommunications(usuario)).toBe(true);
  });

  it('classifica Executivo e ETL Saúde no agrupamento administrativo da navegação', () => {
    const labelsAdministrativos = DASHBOARD_NAV_ITEMS
      .filter(isAdministrativeDashboardNavItem)
      .map((item) => item.label);

    expect(labelsAdministrativos).toEqual(['Executivo', 'ETL Saúde']);
  });
});
