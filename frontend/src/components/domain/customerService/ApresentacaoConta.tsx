import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

export interface SlideConta {
  titulo: string;
  conteudo: ReactNode;
}

export default function ApresentacaoConta({ conta, periodo, slides, fechar }: {
  conta: string; periodo: string; slides: SlideConta[]; fechar: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const alvo = dialogo.current;
    if (!alvo) return;
    if (typeof alvo.showModal === 'function') alvo.showModal();
    else alvo.open = true;
    return () => { if (alvo.open && typeof alvo.close === 'function') alvo.close(); };
  }, []);
  const quantidade = slides.length;
  useEffect(() => {
    function atalho(event: KeyboardEvent) {
      if (event.altKey || event.metaKey || event.ctrlKey) return;
      switch (event.key) {
        case 'ArrowLeft': case 'PageUp': event.preventDefault(); setIndice(atual => Math.max(0, atual - 1)); break;
        case 'ArrowRight': case 'PageDown': event.preventDefault(); setIndice(atual => Math.min(quantidade - 1, atual + 1)); break;
        case 'Home': event.preventDefault(); setIndice(0); break;
        case 'End': event.preventDefault(); setIndice(quantidade - 1); break;
        case 'Escape': event.preventDefault(); fechar(); break;
      }
    }
    document.addEventListener('keydown', atalho);
    return () => document.removeEventListener('keydown', atalho);
  }, [quantidade, fechar]);
  return createPortal(<dialog ref={dialogo} aria-label={'Apresentação de ' + conta} className="cs-apresentacao"
    onCancel={event => { event.preventDefault(); fechar(); }}>
    <div className="cs-palco">
      <header className="cs-slide-cabecalho">
        <div><span className="cs-slide-conta">{conta}</span><span className="cs-slide-periodo">{periodo}</span></div>
        <button type="button" className="cs-botao" onClick={fechar} aria-label="Sair da apresentação"><X size={16} />Sair</button>
      </header>
      <div key={indice} className="cs-slide-corpo">
        <h2 aria-live="polite">{slides[indice].titulo}</h2>
        {slides[indice].conteudo}
      </div>
      <footer className="cs-slide-nav">
        <button type="button" className="cs-botao" disabled={indice === 0} onClick={() => setIndice(atual => Math.max(0, atual - 1))}><ArrowLeft size={17} />Anterior</button>
        <span aria-live="polite">{indice + 1} de {slides.length}</span>
        <button type="button" className="cs-botao" disabled={indice === quantidade - 1} onClick={() => setIndice(atual => Math.min(quantidade - 1, atual + 1))}>Próximo<ArrowRight size={17} /></button>
      </footer>
    </div>
  </dialog>, document.body);
}
