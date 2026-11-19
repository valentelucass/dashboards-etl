import { Pagination, type PaginationProps } from '@astryxdesign/core/Pagination';

export default function PeoplePagination({ label, page, totalPages, onChange }: Pick<PaginationProps, 'label' | 'page' | 'onChange'> & { totalPages: number }) {
  if (totalPages <= 1) return null;
  return <Pagination className="admin-presence-pagination" label={label}
    page={page} totalPages={totalPages} onChange={onChange} variant="compact" hasFirstLast size="sm" />;
}
