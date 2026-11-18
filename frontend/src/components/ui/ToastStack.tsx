import { Banner } from '@astryxdesign/core/Banner';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

export default function ToastStack({ items }: { items: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed inset-x-4 top-18 z-[90] mx-auto grid max-w-96 gap-2">
      {items.map(item => <Banner key={item.id} status={item.tone} title={item.message}
        role={item.tone === 'success' ? 'status' : undefined} />)}
    </div>
  );
}
