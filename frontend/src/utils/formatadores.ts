export function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });
}

export function formatarNumero(valor: number, decimais = 0): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

export function formatarPorcentagem(valor: number, decimais = 1): string {
  return `${valor.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  })}%`;
}

export function formatarPeso(valorKg: number): string {
  if (valorKg >= 1000) {
    return `${(valorKg / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} t`;
  }
  return `${valorKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg`;
}

const FUSO_HORARIO_APLICACAO = 'America/Sao_Paulo';

const DATA_HORA_MINUTO_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: FUSO_HORARIO_APLICACAO,
});

const DATA_HORA_FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
  timeZone: FUSO_HORARIO_APLICACAO,
});

function parseDataHoraApi(valor: string): Date | null {
  const data = new Date(valor.trim().replace(/^(\d{4}-\d{2}-\d{2})\s+/, '$1T'));
  return Number.isNaN(data.getTime()) ? null : data;
}

export function formatarDataHoraMinuto(dataISO: string): string {
  const data = parseDataHoraApi(dataISO);
  if (!data) {
    return dataISO;
  }

  return DATA_HORA_MINUTO_FORMATTER.format(data).replace(',', '').replace(/\s+/g, ' ').trim();
}

function dataParaExibicao(dataISO: string): Date {
  // Uma data de calendário já vem no dia correto, sem fuso horário a converter.
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(dataISO) ? dataISO + 'T12:00:00' : dataISO);
}

export function formatarData(dataISO: string): string {
  return dataParaExibicao(dataISO).toLocaleDateString('pt-BR');
}

export function formatarDataHora(dataISO: string): string {
  const data = parseDataHoraApi(dataISO);
  if (!data) {
    return dataISO;
  }

  return DATA_HORA_FORMATTER.format(data);
}

export function formatarDataCurta(dataISO: string): string {
  return dataParaExibicao(dataISO).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
