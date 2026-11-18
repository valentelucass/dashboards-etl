import { Banner, type BannerStatus } from '@astryxdesign/core/Banner';
import { AlertCircle, CalendarX, Clock, WifiOff } from 'lucide-react';
import type { TipoErro } from '../../utils/apiError';

const STATUS = {
  periodo: { status: 'warning', Icon: CalendarX },
  timeout: { status: 'warning', Icon: Clock },
  indisponivel: { status: 'info', Icon: WifiOff },
  erro: { status: 'error', Icon: AlertCircle },
} satisfies Record<TipoErro, { status: BannerStatus; Icon: typeof AlertCircle }>;

export default function MensagemErro({ mensagem, tipo = 'erro' }: { mensagem: string; tipo?: TipoErro }) {
  const { status, Icon } = STATUS[tipo];
  return <Banner status={status} title={mensagem} icon={<Icon size={16} aria-hidden="true" />} />;
}
