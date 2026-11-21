import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { ArrowLeft, ChevronRight, Eye, X } from 'lucide-react';
import DashboardAdaptiveDialog from '../shared/DashboardAdaptiveDialog';
import DirectoryList from './DirectoryList';

type DetailField = { label: string } & (
  { value: ReactNode } | { items: string[]; empty: string }
);
interface DetailSection {
  title: string;
  fields: DetailField[];
}
interface DetailsProps {
  name: string;
  subtitle?: string;
  icon: ReactNode;
  badge: ReactNode;
  closeLabel: string;
  sections: DetailSection[];
  onClose: () => void;
}

export function DirectoryDetailsButton({ name, onClick }: { name: string; onClick: () => void }) {
  return <Button label="Ver mais" aria-label={`Ver detalhes de ${name}`} aria-haspopup="dialog"
    icon={<Eye size={14} />} size="sm" variant="secondary" onClick={onClick} />;
}

export default function DirectoryDetailsDialog({ name, subtitle, icon, badge, closeLabel, sections, onClose }: DetailsProps) {
  const [listLabel, setListLabel] = useState<string | null>(null);
  const active = sections.flatMap(section => section.fields).find(field => field.label === listLabel);
  const list = active && 'items' in active ? active.items : null;
  const body = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (listLabel) {
      heading.current?.focus();
    } else if (returnTo.current) {
      const name = returnTo.current;
      Array.from(body.current?.querySelectorAll<HTMLButtonElement>('[data-detail-list]') ?? [])
        .find(button => button.dataset.detailList === name)?.focus();
      returnTo.current = null;
    }
  }, [listLabel]);

  function renderValue(field: DetailField) {
    if ('value' in field) return field.value;
    if (!field.items.length) return field.empty;
    if (field.items.length === 1 && field.items[0].length <= 100) return field.items[0];
    return <Button label={`Ver lista (${field.items.length})`} aria-label={`Ver ${field.label.toLocaleLowerCase('pt-BR')} (${field.items.length})`}
      data-detail-list={field.label} variant="ghost" size="sm" icon={<ChevronRight size={14}/>}
      onClick={() => { returnTo.current = field.label; setListLabel(field.label); }} />;
  }

  return <DashboardAdaptiveDialog label={`Detalhes de ${name}`} isOpen onOpenChange={open => { if (!open) onClose(); }}
    purpose="info" sheetHeight="hug" width="min(54rem, calc(100dvw - 2rem))" maxHeight="calc(100dvh - 2rem)" padding={0}>
    <div className="admin-detail-frame">
      <header className="flex shrink-0 items-start gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:px-5">
        <span className="mt-1 shrink-0 text-[var(--color-primary)]" aria-hidden="true">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="wrap-anywhere text-base font-bold">{name}</h2>{badge}
          </div>
          {subtitle && <p className="mt-1 wrap-anywhere text-sm text-[var(--color-text-muted)]">{subtitle}</p>}
        </div>
        <Button label={closeLabel} isIconOnly variant="ghost" size="sm" icon={<X size={18} />} onClick={onClose} />
      </header>
      <div ref={body} className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
        {list && listLabel ? <>
          <Button label="Voltar ao resumo" icon={<ArrowLeft size={14}/>} variant="ghost" size="sm" onClick={() => setListLabel(null)} />
          <h3 ref={heading} tabIndex={-1} className="my-2 text-sm font-bold">{listLabel} ({list.length})</h3>
          <DirectoryList label={listLabel} items={list} />
        </> : <div className="grid gap-4">{sections.map(section =>
          <section key={section.title}>
            <h3 className="mb-1.5 text-sm font-bold">{section.title}</h3>
            <dl className="admin-detail-grid">{section.fields.map(field =>
              <div key={field.label} className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                <dt className="text-xs text-[var(--color-text-subtle)]">{field.label}</dt>
                <dd className="mt-1 wrap-anywhere text-sm font-medium">{renderValue(field)}</dd>
              </div>)}</dl>
          </section>)}</div>}
      </div>
    </div>
  </DashboardAdaptiveDialog>;
}
