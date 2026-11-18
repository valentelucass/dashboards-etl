import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ExportButton from './ExportButton';

describe('ExportButton', () => {
  it('habilita exportacao quando recebe onExport mesmo sem dados', () => {
    const html = renderToStaticMarkup(
      createElement(ExportButton, {
        nomeArquivo: 'fretes',
        onExport: () => Promise.resolve(),
      }),
    );

    expect(html).toContain('Exportar CSV');
    expect(html).not.toContain('disabled=""');
  });

  it('desabilita exportacao quando nao recebe onExport', () => {
    const html = renderToStaticMarkup(
      createElement(ExportButton, {
        nomeArquivo: 'fretes',
        dados: [{ id: 1 }],
      }),
    );

    expect(html).toContain('aria-disabled="true"');
  });
});
