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

function getToneBadgeStyle(color: string) {
  if (color === '#ef4444') {
    return {
      backgroundColor: 'rgba(220, 38, 38, 0.14)',
      color: '#dc2626',
    };
  }

  if (color === '#10b981') {
    return {
      backgroundColor: 'rgba(22, 163, 74, 0.14)',
      color: '#15803d',
    };
  }

  return {
    backgroundColor: 'rgba(33, 71, 138, 0.14)',
    color,
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
          <div
            key={item.chave}
            className={`flex h-[156px] min-w-0 flex-[1_1_17rem] flex-col rounded-xl border p-3.5 ${disabled ? 'opacity-60' : ''}`}
            style={cardStyle}
          >
            <div className="min-h-[61px] min-w-0">
              <div className="truncate text-[15px] font-semibold leading-5" title={item.nome} style={{ color: 'var(--color-text)' }}>{item.nome}</div>
              <div className="mt-0.5 truncate text-xs leading-4" title={item.descricao} style={{ color: 'var(--color-text-subtle)' }}>{item.descricao}</div>
              {item.rota && <div className="mt-1 truncate text-xs leading-4" title={item.rota} style={{ color: 'var(--color-text-muted)' }}>{item.rota}</div>}
            </div>

            <div className="mt-auto flex gap-1.5 whitespace-nowrap text-xs">
              <span
                className="min-w-0 truncate rounded-full px-2 py-1 font-medium"
                title={`Herdado: ${herdado ? 'permitido' : 'negado'}`}
                style={
                  herdado
                    ? getToneBadgeStyle('var(--color-primary)')
                    : {
                        backgroundColor: 'rgba(71, 85, 105, 0.12)',
                        color: 'var(--color-text-subtle)',
                      }
                }
              >
                Herdado: {herdado ? 'permitido' : 'negado'}
              </span>
              <span
                className="min-w-0 truncate rounded-full px-2 py-1 font-medium"
                title={`Final: ${acessoFinal ? 'permitido' : 'negado'}`}
                style={acessoFinal ? getToneBadgeStyle('#10b981') : getToneBadgeStyle('#ef4444')}
              >
                Final: {acessoFinal ? 'permitido' : 'negado'}
              </span>
            </div>

            <div className="mt-2.5 flex items-center gap-1.5">
              {OPCOES.map((opcao) => {
                const ativo = valor[item.chave] === opcao.valor;
                return (
                  <button
                    key={opcao.valor}
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...valor,
                        [item.chave]: opcao.valor,
                      })
                    }
                    className="rounded-full border px-[clamp(0.25rem,1.5vw,0.75rem)] py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed"
                    style={
                      ativo
                        ? {
                            backgroundColor: 'var(--color-primary)',
                            borderColor: 'var(--color-primary)',
                            color: '#ffffff',
                          }
                        : {
                            backgroundColor: 'var(--color-card)',
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text)',
                          }
                    }
                  >
                    {opcao.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
