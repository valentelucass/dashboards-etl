import { Toast } from '@astryxdesign/core/Toast';
import { useEffect, useState } from 'react';
import { API_STATUS_ALERT_EVENT, type ApiStatusAlertDetail } from '../../api/clienteAxios';

export default function ApiStatusToast() {
  const [alerta, setAlerta] = useState<{ detail: ApiStatusAlertDetail; id: number } | null>(null);

  useEffect(() => {
    function handleApiStatusAlert(event: Event) {
      const detail = (event as CustomEvent<ApiStatusAlertDetail>).detail;
      setAlerta(current => ({ detail, id: (current?.id ?? 0) + 1 }));
    }
    window.addEventListener(API_STATUS_ALERT_EVENT, handleApiStatusAlert);
    return () => window.removeEventListener(API_STATUS_ALERT_EVENT, handleApiStatusAlert);
  }, []);

  if (!alerta) return null;

  return (
    <div className="fixed inset-x-4 top-4 z-[1000] mx-auto max-w-[400px]">
      <Toast key={alerta.id} type={alerta.detail.tipo === 'timeout' ? 'info' : 'error'} body={alerta.detail.mensagem}
        isAutoHide autoHideDuration={6500} onDismiss={() => setAlerta(null)} />
    </div>
  );
}
