import { Badge } from '@astryxdesign/core/Badge';
import { Card } from '@astryxdesign/core/Card';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import type {
  PermissionCatalogItem,
  PermissionMap,
  PermissionOverrideMode,
  PermissionOverrideStateMap,
} from '../../types/access';
import { PAPEL_ADMIN_PLATAFORMA } from '../../utils/accessControl';

interface PermissionOverrideMatrixProps {
  catalogo: PermissionCatalogItem[];
  baseline: PermissionMap;
  papel: string;
  valor: PermissionOverrideStateMap;
  onChange: (proximo: PermissionOverrideStateMap) => void;
  disabled?: boolean;
}

const OPCOES: Array<{ valor: PermissionOverrideMode; label: string }> = [
  { valor: 'inherit', label: 'Herdar' },
  { valor: 'deny', label: 'Negar' },
  { valor: 'grant', label: 'Conceder' },
];

function getToneSurfaceStyle(color: string) {
  if (color === '#ef4444') {
    return {
      backgroundColor: 'rgba(220, 38, 38, 0.12)',
      borderColor: 'rgba(220, 38, 38, 0.45)',
    };
  }

  if (color === '#10b981') {
    return {
      backgroundColor: 'rgba(22, 163, 74, 0.12)',
      borderColor: 'rgba(22, 163, 74, 0.45)',
    };
  }

  return {
    backgroundColor: 'var(--color-bg)',
    borderColor: color,
  };
}

export default function PermissionOverrideMatrix({
  catalogo,
  baseline,
  papel,
  valor,
  onChange,
  disabled,
}: PermissionOverrideMatrixProps) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {catalogo.map((item) => {
        const herdado = Boolean(baseline[item.chave]);
        const negado = valor[item.chave] === 'deny';
        const concedido = valor[item.chave] === 'grant';
        const acessoFinal = papel === PAPEL_ADMIN_PLATAFORMA ? true : ((herdado && !negado) || concedido);
        const cardStyle = negado
          ? getToneSurfaceStyle('#ef4444')
          : acessoFinal
            ? getToneSurfaceStyle('#10b981')
            : {
                backgroundColor: 'var(--color-card)',
                borderColor: 'var(--color-border)',
              };

        return (
          <Card padding={0}
            key={item.chave}
            className={`flex min-w-0 max-sm:gap-2 sm:h-[156px] flex-[1_1_17rem] flex-col rounded-xl border p-3.5 ${disabled ? 'opacity-60' : ''}`}
            style={cardStyle}
          >
            <div className="min-w-0 sm:min-h-[61px]">
              <div className="truncate text-[15px] font-semibold leading-5" title={item.nome} style={{ color: 'var(--color-text)' }}>{item.nome}</div>
              <div className="mt-0.5 wrap-anywhere sm:truncate text-xs leading-4" title={item.descricao} style={{ color: 'var(--color-text-subtle)' }}>{item.descricao}</div>
              {item.rota && <div className="mt-1 truncate text-xs leading-4" title={item.rota} style={{ color: 'var(--color-text-muted)' }}>{item.rota}</div>}
            </div>

            <div className="mt-auto flex flex-wrap gap-1.5">
              <Badge label={`Herdado: ${herdado ? 'permitido' : 'negado'}`} variant={herdado ? 'info' : 'neutral'} />
              <Badge label={`Final: ${acessoFinal ? 'permitido' : 'negado'}`} variant={acessoFinal ? 'success' : 'error'} />
            </div>

            <SegmentedControl label={item.nome} value={valor[item.chave] ?? 'inherit'} size="sm" layout="fill"
              isDisabled={disabled} onChange={value => {
                const opcao = OPCOES.find(item => item.valor === value);
                if (opcao) onChange({ ...valor, [item.chave]: opcao.valor });
              }} className="mt-2.5">
              {OPCOES.map(opcao => <SegmentedControlItem key={opcao.valor} value={opcao.valor} label={opcao.label} />)}
            </SegmentedControl>
          </Card>
        );
      })}
    </div>
  );
}
