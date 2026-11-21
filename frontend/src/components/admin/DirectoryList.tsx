import { useState } from 'react';
import PeoplePagination from './PeoplePagination';

const PAGE_SIZE = 5;

export default function DirectoryList({ label, items }: { label: string; items: string[] }) {
  const [requestedPage, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  return <>
    <PeoplePagination label={`Paginação de ${label}`} page={page} totalPages={totalPages} onChange={setPage} />
    <ul aria-label={label} className="divide-y divide-[var(--color-border)]">
      {items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((item, index) =>
        <li key={index} className="wrap-anywhere py-2 text-sm">{item}</li>)}
    </ul>
  </>;
}
