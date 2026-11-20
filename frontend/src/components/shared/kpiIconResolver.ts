import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  BanknoteArrowDown,
  BanknoteArrowUp,
  BarChart3,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  DollarSign,
  FileCheck,
  FileText,
  Gauge,
  HandCoins,
  PackageCheck,
  Receipt,
  Scale,
  ShieldAlert,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Waypoints,
  Weight,
} from 'lucide-react';

function normalizeLabel(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const rawLabelIconMap: Record<string, LucideIcon> = {
  'Total de Cargas': Truck,
  'Em Trânsito': Waypoints,
  'Previsão Vencida': CalendarClock,
  'Val. Carteira': Wallet,
  'Peso Taxado': Weight,
  '% Finalizado': Gauge,
  'Total Manifestos': ClipboardList,
  Encerrados: FileCheck,
  'KM Total': Waypoints,
  'Custo Total': CircleDollarSign,
  'Custo/KM': DollarSign,
  'Ocup. Peso %': Scale,
  'Ocup. Cubagem %': Boxes,
  'Total Coletas': Boxes,
  Finalizadas: PackageCheck,
  'Taxa Sucesso': TrendingUp,
  'Cancelamento %': TrendingDown,
  'SLA Agendamento': CalendarClock,
  'Lead Time Médio': Clock3,
  'Tentativas Méd.': Target,
  'Valor NF': Receipt,
  Minutas: Truck,
  'Total de Fretes': Truck,
  'Receita Bruta': CircleDollarSign,
  'Valor Frete': DollarSign,
  'Meta de Faturamento': Target,
  'Faturamento Bruto': CircleDollarSign,
  'Faturamento Líquido': DollarSign,
  'Progresso da Meta': Gauge,
  'Ticket Médio': Receipt,
  Volumes: Boxes,
  'CT-e Emitido': FileText,
  'Valor a Pagar': BanknoteArrowDown,
  'Valor Pago': HandCoins,
  'Saldo Aberto': Wallet,
  'Taxa Liquidação': TrendingUp,
  'Lead Time': Clock3,
  '% Conciliado': FileCheck,
  'Valor Faturado': Receipt,
  'Reg. Faturados': FileCheck,
  'Ag. Faturamento': ClipboardList,
  'Tít. Atraso': AlertCircle,
  'Prazo Médio': CalendarClock,
  'Clientes Ativos': Users,
  'Tempo Médio (s)': Clock3,
  'Com Erro': AlertCircle,
  'Total Execuções': BarChart3,
  'Vol. Processado': Boxes,
  'Valor Recebido': BanknoteArrowUp,
  'Adimplência %': TrendingUp,
  'DSO Médio': Clock3,
  'Total Cotações': ClipboardList,
  'Potencial (R$)': Target,
  'Frete Médio': Truck,
  'Frete/KG': Scale,
  'Conv. CT-e %': FileCheck,
  'Conv. NFS-e %': FileCheck,
  'Reprovação %': TrendingDown,
  'Conv. Médio (h)': Clock3,
  'Rec. Operacional': CircleDollarSign,
  'A Receber': BanknoteArrowUp,
  'A Pagar': BanknoteArrowDown,
  'Backlog Coletas': Boxes,
  'Ocup. Manifestos': Gauge,
  'Total de Entregas': Truck,
  'Entregas no Prazo': PackageCheck,
  'No Prazo': PackageCheck,
  'Fora do Prazo': AlertCircle,
  Performance: Gauge,
  'OTIF - On-Time In-Full': Gauge,
  'Em Atraso': AlertCircle,
  'Peso Taxado (t)': Weight,
  'Comprovante Anexado': FileCheck,
  'Valor NF sem Comprovante': Receipt,
  'Sem dado suficiente': AlertCircle,
  '% no prazo': Gauge,
  'Ordens de Conferência': Boxes,
  'Manifestos Bipados': Boxes,
  'Manifestos Emitidos': BarChart3,
  Descarregamentos: Truck,
  'Conferências Incompletas': AlertCircle,
  '% Utilização': Gauge,
  'Fretes Cubados': PackageCheck,
  'Minutas Cubadas': PackageCheck,
  'Minutas Sem Cubagem': AlertCircle,
  'Minutas com Peso Real': BarChart3,
  'Peso Real Registrado': BarChart3,
  '% Cubagem': Gauge,
  'Total de Sinistros': ShieldAlert,
  'Valor Indenizado': ShieldAlert,
  'Faturamento Base': BarChart3,
  '% sobre Faturamento': Gauge,
  'Saídas no horário': Truck,
  'Total programado': BarChart3,
  '% no horário': Gauge,
  'Última importação': Clock3,
};

const iconByLabel = Object.fromEntries(
  Object.entries(rawLabelIconMap).map(([label, icon]) => [normalizeLabel(label), icon]),
) as Record<string, LucideIcon>;

export function resolveKpiIcon(label: string): LucideIcon {
  const normalizedLabel = normalizeLabel(label);
  const mappedIcon = iconByLabel[normalizedLabel];

  if (mappedIcon) {
    return mappedIcon;
  }

  if (
    normalizedLabel.includes('erro')
    || normalizedLabel.includes('sem dado')
    || normalizedLabel.includes('reprov')
    || normalizedLabel.includes('cancel')
    || normalizedLabel.includes('vencid')
    || normalizedLabel.includes('atraso')
  ) {
    return AlertCircle;
  }

  if (normalizedLabel.includes('sinistro') || normalizedLabel.includes('indeniz')) {
    return ShieldAlert;
  }

  if (normalizedLabel.includes('receber')) {
    return BanknoteArrowUp;
  }

  if (normalizedLabel.includes('pagar')) {
    return BanknoteArrowDown;
  }

  if (
    normalizedLabel.includes('%')
    || normalizedLabel.includes('taxa')
    || normalizedLabel.includes('ocup')
    || normalizedLabel.includes('sla')
    || normalizedLabel.includes('utiliz')
    || normalizedLabel.includes('concili')
    || normalizedLabel.includes('adimpl')
    || normalizedLabel.includes('convers')
    || normalizedLabel.includes('cubagem')
    || normalizedLabel.includes('finaliz')
  ) {
    return Gauge;
  }

  if (
    normalizedLabel.includes('tempo')
    || normalizedLabel.includes('prazo')
    || normalizedLabel.includes('lead time')
    || normalizedLabel.includes('dso')
    || normalizedLabel.includes('previs')
    || normalizedLabel.includes('importa')
  ) {
    return Clock3;
  }

  if (normalizedLabel.includes('cliente')) {
    return Users;
  }

  if (normalizedLabel.includes('peso') || normalizedLabel.includes('kg')) {
    return Weight;
  }

  if (
    normalizedLabel.includes('valor')
    || normalizedLabel.includes('receita')
    || normalizedLabel.includes('ticket')
    || normalizedLabel.includes('saldo')
    || normalizedLabel.includes('fatur')
    || normalizedLabel.includes('potencial')
  ) {
    return CircleDollarSign;
  }

  if (
    normalizedLabel.includes('coleta')
    || normalizedLabel.includes('ordem')
    || normalizedLabel.includes('volume')
  ) {
    return Boxes;
  }

  if (
    normalizedLabel.includes('frete')
    || normalizedLabel.includes('carga')
    || normalizedLabel.includes('entrega')
    || normalizedLabel.includes('transito')
    || normalizedLabel.includes('descarreg')
    || normalizedLabel.includes('saida')
  ) {
    return Truck;
  }

  if (normalizedLabel.includes('manifest')) {
    return ClipboardList;
  }

  if (
    normalizedLabel.includes('nf')
    || normalizedLabel.includes('ct-e')
    || normalizedLabel.includes('nfs-e')
    || normalizedLabel.includes('reg.')
    || normalizedLabel.includes('tit.')
  ) {
    return FileText;
  }

  return BarChart3;
}
