import { formatarDataHoraMinuto } from '../../utils/formatadores';

interface LastUpdatedProps {
  dataExtracao: string | null;
}

export default function LastUpdated({ dataExtracao }: LastUpdatedProps) {
  if (!dataExtracao) return null;

  return (
    <time dateTime={dataExtracao}>
      Atualizado em {formatarDataHoraMinuto(dataExtracao)}
    </time>
  );
}
