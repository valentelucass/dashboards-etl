import ChartLoading from '../../shared/ChartLoading';
import { Chart, ChartAxis, ChartGrid, bar } from '@astryxdesign/charts';
import ChartCard from '../../shared/ChartCard';
import type { ChartDictionaryKey } from '../../../constants/chartDictionary';
import { formatarNumero } from '../../../utils/formatadores';

interface ColetasBarsProps {
  titulo: string;
  chartKey: ChartDictionaryKey;
  data: { nome: string; total: number }[];
  isLoading?: boolean;
  isEmpty?: boolean;
  erro?: string | null;
  className?: string;
}

export default function ColetasBars({ data, ...props }: ColetasBarsProps) {
  const highest = data.reduce((max, row) => Math.max(max, row.total), 0);
  const step = 10 ** Math.floor(Math.log10(Math.max(1, highest)));
  const max = Math.max(1, Math.ceil(highest / (step / 2)) * (step / 2));

  return (
    <ChartCard {...props} loadingContent={<div className="h-[350px]"><ChartLoading bars legend={false} /></div>}>
      <Chart
        aria-label={props.titulo}
        data={data}
        xKey="nome"
        series={[bar('total', { color: 'var(--coletas-chart-volume)', label: props.titulo, radius: 5 })]}
        height={350}
        yDomain={[0, max]}
        margin={{ left: 58, right: 14, top: 20, bottom: 40 }}
        grid={<ChartGrid horizontal tickCount={5} />}
        axes={<>
          <ChartAxis position="left" tickFormat={(value) => formatarNumero(Number(value))} />
          <ChartAxis position="bottom" truncate={15} />
        </>}
        tooltip
      />
    </ChartCard>
  );
}
