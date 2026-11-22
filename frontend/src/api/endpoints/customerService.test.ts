// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import clienteAxios from '../clienteAxios';
import { aplicarCarteiraCS, conferirCarteiraCS, type ResumoCarteiraCS } from './customerService';

afterEach(() => vi.restoreAllMocks());

it('envia a mesma planilha e a revisão conferida para confirmar a substituição da carteira', async () => {
  const dados: ResumoCarteiraCS = {competencia:'2026-11', versaoAtual:4, hashCarteira:'hash-do-servidor',
    grupos:2, cnpjs:12, adicionados:1, removidos:2, transferidos:0, semAlteracao:false};
  const post = vi.spyOn(clienteAxios, 'post').mockResolvedValue({data:dados});
  const arquivo = new File(['planilha'], 'clientes.xlsx');
  const previa = await conferirCarteiraCS(arquivo, dados.competencia);
  await aplicarCarteiraCS(arquivo, previa);
  expect(post.mock.calls.map(([url]) => url)).toEqual(['/api/admin/customer-service/carteira/previa', '/api/admin/customer-service/carteira/aplicar']);
  const [leitura, confirmacao] = post.mock.calls.map(([,corpo]) => corpo as FormData);
  for (const formulario of [leitura, confirmacao]) {
    expect(formulario.get('arquivo')).toBe(arquivo);
    expect(formulario.get('competencia')).toBe('2026-11');
  }
  expect(leitura.has('versaoAtual')).toBe(false);
  expect(confirmacao.get('versaoAtual')).toBe('4');
  expect(confirmacao.get('hashCarteira')).toBe('hash-do-servidor');
});
