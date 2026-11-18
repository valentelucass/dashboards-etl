import { beforeEach, describe, expect, it, vi } from 'vitest';

type QueryOptions = Record<string, unknown>;

const { useQueryMock } = vi.hoisted(() => ({
  useQueryMock: vi.fn((options: QueryOptions) => options),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}));

import { useColetasOverview } from './useColetas';
import {
  useClientes,
  useCotacoesUsuarios,
  useFaturamentoResponsaveis,
  useFaturamentoStatus,
  useFaturasPorClienteClientesCnpj,
  useFaturasPorClientePagadores,
  useFiliais,
  useFretesStatus,
  useMotoristas,
  usePagadores,
  usePerformanceCidadesDestino,
  usePerformanceRegioesDestino,
  usePerformanceResponsaveis,
  usePlanoContas,
  useUsuarios,
  useVeiculos,
} from './useDimensoes';

describe('escopo do polling', () => {
  beforeEach(() => {
    useQueryMock.mockClear();
  });

  it('habilita polling com jitter em fatos operacionais', () => {
    useColetasOverview({} as never);

    const options = useQueryMock.mock.calls[0]?.[0];
    expect(options).toMatchObject({
      refetchIntervalInBackground: true,
    });
    expect(options?.refetchInterval).toBeTypeOf('function');
  });

  it('nao aplica polling nas rotas dimensionais', () => {
    useFiliais();
    useClientes();
    usePagadores('');
    useFaturasPorClienteClientesCnpj();
    useFaturasPorClientePagadores();
    useMotoristas();
    useVeiculos();
    usePlanoContas();
    useUsuarios();
    useFretesStatus({} as never);
    useFaturamentoStatus({} as never);
    usePerformanceResponsaveis({} as never);
    usePerformanceRegioesDestino({} as never);
    usePerformanceCidadesDestino({} as never);
    useFaturamentoResponsaveis({} as never);
    useCotacoesUsuarios({} as never);

    for (const [options] of useQueryMock.mock.calls) {
      expect(options).not.toHaveProperty('refetchInterval');
      expect(options).not.toHaveProperty('refetchIntervalInBackground');
    }
  });
});
