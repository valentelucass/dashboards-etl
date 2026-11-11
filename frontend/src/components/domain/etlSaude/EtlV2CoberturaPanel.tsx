import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clienteAxios from '../../../api/clienteAxios';
import DataTable, { type ColunaTabela } from '../../shared/DataTable';
import MensagemErro from '../../ui/MensagemErro';
import { formatarData, formatarNumero } from '../../../utils/formatadores';

interface Cobertura {
  entidade: string;
  template: number;
  campos: number;
  diasRecebidos: number | null;
  linhasAtuais: number | null;
  primeiraData: string | null;
  ultimaData: string | null;
  ultimaCaptura: string | null;
  situacao: 'AVAILABLE' | 'NOT_LOADED' | 'MULTIPLE_SOURCES' | 'INVALID_COVERAGE';
}

const entidades: Record<string, string> = {
  COLETAS: 'Coletas',
  CONSOLIDACAO_DETALHADA: 'Consolidação Detalhada',
  CONTAS_A_PAGAR: 'Contas a Pagar',
  COTACOES: 'Cotações',
  FATURAS_POR_CLIENTE: 'Faturas por Cliente',
  FRETES: 'Fretes',
  INVENTARIO: 'Inventário',
  LOCALIZACAO_CARGAS: 'Localização de Cargas',
  MANIFESTOS: 'Manifestos',
  OCORRENCIAS: 'Ocorrências',
  SINISTROS: 'Sinistros',
};

const situacoes: Record<Cobertura['situacao'], string> = {
  AVAILABLE: 'Recebido',
  NOT_LOADED: 'Sem dias recebidos',
  MULTIPLE_SOURCES: 'Origens a conferir',
  INVALID_COVERAGE: 'Cobertura a conferir',
};

const capturaBrasilia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short',
});

const numero = (valor: Cobertura[keyof Cobertura]) =>
  typeof valor === 'number' ? formatarNumero(valor) : '—';

const colunas: ColunaTabela<Cobertura>[] = [
  { chave: 'entidade', label: 'Relatório', formato: (_, r) => entidades[r.entidade] ?? r.entidade },
  { chave: 'campos', label: 'Campos', formato: numero, alinhamento: 'right' },
  { chave: 'diasRecebidos', label: 'Dias confirmados', formato: numero, alinhamento: 'right' },
  { chave: 'linhasAtuais', label: 'Linhas recebidas', formato: numero, alinhamento: 'right' },
  { chave: 'primeiraData', label: 'Datas cobertas', formato: (_, r) => r.primeiraData && r.ultimaData
    ? `${formatarData(r.primeiraData)} a ${formatarData(r.ultimaData)}` : '—' },
  { chave: 'ultimaCaptura', label: 'Último recebimento (Brasília)', formato: (_, r) => r.ultimaCaptura
    ? capturaBrasilia.format(new Date(r.ultimaCaptura)) : '—' },
  { chave: 'situacao', label: 'Situação', formato: (_, r) => situacoes[r.situacao] ?? 'A conferir' },
];

export default function EtlV2CoberturaPanel() {
  const [aberto, setAberto] = useState(false);
  const id = useId();
  const cobertura = useQuery({
    queryKey: ['etl-saude', 'cobertura-v2'],
    enabled: aberto,
    queryFn: async ({ signal }) => {
      const { data } = await clienteAxios.get<Cobertura[]>('/api/painel/etl-saude/cobertura-v2', { signal });
      return data;
    },
    staleTime: 60_000,
    retry: false,
  });

  return (
    <section className="mb-4" aria-label="Recebimento no ETL V2">
      <button
        type="button"
        className="rounded-lg border px-3 py-2 text-sm font-semibold"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto(valor => !valor)}
      >
        Dados recebidos no ETL V2
      </button>
      <div id={id} hidden={!aberto}>
        {aberto && (
          <>
            <p className="my-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Mostra o último recebimento de cada dia, sem somar reextrações.
              As datas indicam o primeiro e o último dia recebido; pode haver dias sem carga no meio.
              Esta tabela tem um período próprio e os indicadores atuais continuam no V1.
            </p>
            {cobertura.isError ? (
              <MensagemErro tipo="indisponivel" mensagem="Não foi possível consultar os dados recebidos no ETL V2." />
            ) : (
              <DataTable
                titulo="Cobertura de recebimento"
                dados={cobertura.data ?? []}
                colunas={colunas}
                chaveLinha="entidade"
                isLoading={cobertura.isPending}
                semPaginacao
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
