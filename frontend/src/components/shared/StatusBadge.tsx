import { CORES_STATUS } from '../../utils/chartColors';
import { formatarStatusOperacional } from '../../utils/statusLabels';

interface StatusBadgeProps {
  status: string;
  tone?: 'warning';
}

const TEXT_COLORS_BY_HEX: Record<string, string> = {
  '#21478A': '#21478A',
  '#10b981': '#047857',
  '#ef4444': '#dc2626',
  '#06b6d4': '#0e7490',
  '#7c3aed': '#6d28d9',
  '#f97316': '#ea580c',
  '#3b82f6': '#2563eb',
  '#8b5cf6': '#7c3aed',
  '#6366f1': '#4f46e5',
  '#d1d5db': '#475569',
  '#6b7280': '#475569',
};

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) {
    return 'rgba(71, 85, 105, 0.14)';
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export default function StatusBadge({ status, tone }: StatusBadgeProps) {
  const statusLabel = formatarStatusOperacional(status) || 'Sem status';
  const statusNormalizado = statusLabel.trim().toLowerCase();
  const statusComUnderscore = statusNormalizado.replace(/\s+/g, '_');
  const cor = CORES_STATUS[statusNormalizado] ?? CORES_STATUS[statusComUnderscore] ?? '#6b7280';
  const textColor = TEXT_COLORS_BY_HEX[cor] ?? cor;

  return (
    <span
      className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
      style={tone === 'warning'
        ? { backgroundColor: 'var(--color-warning-badge-bg)', color: 'var(--color-warning-badge-text)' }
        : { backgroundColor: hexToRgba(textColor, 0.14), color: textColor }}
    >
      {statusLabel}
    </span>
  );
}
