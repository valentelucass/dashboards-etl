import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge';
import { CORES_STATUS } from '../../utils/chartColors';
import { formatarStatusOperacional } from '../../utils/statusLabels';

interface StatusBadgeProps {
  status: string;
  tone?: 'warning';
}

const variantByColor: Record<string, BadgeVariant> = {
  '#21478a': 'info',
  '#10b981': 'success',
  '#ef4444': 'error',
  '#06b6d4': 'cyan',
  '#7c3aed': 'purple',
  '#f97316': 'warning',
  '#3b82f6': 'blue',
  '#8b5cf6': 'purple',
  '#6366f1': 'purple',
};

export default function StatusBadge({ status, tone }: StatusBadgeProps) {
  const statusLabel = formatarStatusOperacional(status) || 'Sem status';
  const statusNormalizado = statusLabel.trim().toLowerCase();
  const statusComUnderscore = statusNormalizado.replace(/\s+/g, '_');
  const cor = CORES_STATUS[statusNormalizado] ?? CORES_STATUS[statusComUnderscore] ?? '#6b7280';
  const variant = tone === 'warning' ? 'warning' : (variantByColor[cor.toLowerCase()] ?? 'neutral');
  return <Badge label={statusLabel} variant={variant} className="dashboard-status-badge" />;
}
