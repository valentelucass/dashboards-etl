import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import clienteAxios from '../api/clienteAxios';
import { useAutenticacao } from '../contexts/AutenticacaoContext';

export default function usePresencaNavegacao() {
  const { pathname } = useLocation();
  const { usuario } = useAutenticacao();

  const usuarioId = usuario?.id;
  useEffect(() => {
    if (!usuarioId) return;
    const fluxoId = crypto.randomUUID();
    const controller = new AbortController();
    let fila = Promise.resolve();
    let estavaVisivel = false;
    const enviar = () => {
      const visivel = document.visibilityState === 'visible' && document.hasFocus();
      if (!visivel && !estavaVisivel) return;
      estavaVisivel = visivel;
      // Serialização preserva a ordem foco/blur; desmontagem cancela chamadas
      // antigas para não registrar outra rota ou identidade após a navegação.
      fila = fila.then(async () => {
        if (controller.signal.aborted) return;
        try {
          await clienteAxios.put('/api/sessao/presenca', { rota: pathname, visivel, fluxoId },
            { signal: controller.signal, timeout: 10000 });
        } catch { /* Uma falha de telemetria não bloqueia a página. */ }
      });
    };
    enviar();
    const timer = window.setInterval(enviar, 30000);
    document.addEventListener('visibilitychange', enviar);
    window.addEventListener('focus', enviar);
    window.addEventListener('blur', enviar);
    window.addEventListener('pagehide', enviar);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', enviar);
      window.removeEventListener('focus', enviar);
      window.removeEventListener('blur', enviar);
      window.removeEventListener('pagehide', enviar);
    };
  }, [pathname, usuarioId]);
}
