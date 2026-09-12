import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import clienteAxios from '../api/clienteAxios';
import { useAutenticacao } from '../contexts/AutenticacaoContext';

export default function usePresencaNavegacao() {
  const { pathname } = useLocation();
  const { usuario } = useAutenticacao();
  const rota = useRef(pathname);
  const notificarRota = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (rota.current === pathname) return;
    rota.current = pathname;
    notificarRota.current?.();
  }, [pathname]);

  const usuarioId = usuario?.id;
  useEffect(() => {
    if (!usuarioId) return;
    const fluxoId = crypto.randomUUID();
    const controller = new AbortController();
    let fila = Promise.resolve();
    let estavaVisivel = false;
    let saidaPendente = false;
    let paginaEncerrada = false;
    const estaVisivel = () => !paginaEncerrada && document.visibilityState === 'visible' && document.hasFocus();
    const enviar = () => {
      const visivel = estaVisivel();
      if (!visivel && !estavaVisivel && !saidaPendente) return;
      if (!visivel) saidaPendente = true;
      estavaVisivel = visivel;
      const pagina = rota.current;
      // O fluxo e a fila sobrevivem à navegação. Não abortar uma escrita de
      // rota enquanto ela pode estar chegando ao servidor.
      fila = fila.then(async () => {
        if (controller.signal.aborted) return;
        // Um pulso que esperou na fila não comprova foco numa página já deixada.
        if (visivel && (!estaVisivel() || pagina !== rota.current)) return;
        try {
          await clienteAxios.put('/api/sessao/presenca', { rota: pagina, visivel, fluxoId },
            { signal: controller.signal, timeout: 10000 });
          if (!visivel || estaVisivel()) saidaPendente = false;
        } catch {
          if (!visivel) saidaPendente = true;
        }
      });
    };
    const encerrarPagina = () => { paginaEncerrada = true; enviar(); };
    const retomarPagina = () => { paginaEncerrada = false; enviar(); };
    notificarRota.current = enviar;
    enviar();
    const timer = window.setInterval(enviar, 30000);
    document.addEventListener('visibilitychange', enviar);
    window.addEventListener('focus', enviar);
    window.addEventListener('blur', enviar);
    window.addEventListener('pagehide', encerrarPagina);
    window.addEventListener('pageshow', retomarPagina);
    window.addEventListener('online', enviar);
    return () => {
      controller.abort();
      notificarRota.current = null;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', enviar);
      window.removeEventListener('focus', enviar);
      window.removeEventListener('blur', enviar);
      window.removeEventListener('pagehide', encerrarPagina);
      window.removeEventListener('pageshow', retomarPagina);
      window.removeEventListener('online', enviar);
    };
  }, [usuarioId]);
}
