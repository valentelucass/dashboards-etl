import type { PermissionCatalogItem, PermissionMap } from '../../types/access';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';

interface PermissionMatrixProps {
  catalogo: PermissionCatalogItem[];
  valor: PermissionMap;
  onChange: (proximo: PermissionMap) => void;
  disabled?: boolean;
}

export default function PermissionMatrix({ catalogo, valor, onChange, disabled }: PermissionMatrixProps) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
      {catalogo.map((item) => {
        const ativo = Boolean(valor[item.chave]);

        return (
          <Card padding={0}
            key={item.chave}
            className={`flex min-w-0 max-sm:flex-col sm:min-h-[122px] items-start gap-2.5 rounded-xl border px-3.5 py-3 transition-colors ${disabled ? 'opacity-60' : ''}`}
            style={
              ativo
                ? {
                    backgroundColor: 'var(--color-bg)',
                    borderColor: 'var(--color-primary)',
                  }
                : {
                    backgroundColor: 'var(--color-card)',
                    borderColor: 'var(--color-border)',
                  }
            }
          >
            <CheckboxInput
              label={item.nome}
              description={item.descricao}
              value={ativo}
              isDisabled={disabled}
              onChange={(checked) =>
                onChange({
                  ...valor,
                  [item.chave]: checked,
                })
              }
            />
            {item.rota && <div className="mt-1 truncate text-xs" title={item.rota} style={{ color: 'var(--color-text-muted)' }}>{item.rota}</div>}
          </Card>
        );
      })}
    </div>
  );
}
