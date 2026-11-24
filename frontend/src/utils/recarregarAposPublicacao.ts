const CHAVE_TENTATIVA = 'dashboard:recarga-publicacao';
const FALHA_DE_MODULO = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css/i;

async function arquivoDisponivel(mensagem: string, signal: AbortSignal) {
  const endereco = mensagem.match(/https?:\/\/[^\s"'<>]+|\/assets\/[^\s"'<>]+/i)?.[0];
  if (!endereco) return false;
  const url = new URL(endereco, window.location.href);
  if (url.origin !== window.location.origin || !/^\/assets\/[^/]+\.(js|css)$/.test(url.pathname)) return false;
  const resposta = await fetch(url.pathname + url.search, { method: 'HEAD', cache: 'no-store', signal });
  const tipo = resposta.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  return resposta.ok && (url.pathname.endsWith('.css') ? tipo === 'text/css' : tipo === 'application/javascript' || tipo === 'text/javascript');
}

export async function recarregarAposPublicacao(error: unknown, signal: AbortSignal, reload = () => window.location.reload()) {
  const atual = document.documentElement.dataset.dashboardBuildId;
  if (!atual || atual === 'dev' || !(error instanceof Error) || !FALHA_DE_MODULO.test(error.message)) return;

  try {
    const resposta = await fetch('/build-info.json', { cache: 'no-store', signal });
    if (!resposta.ok) return;
    const { buildId } = await resposta.json();
    if (signal.aborted || typeof buildId !== 'string' || !buildId) return;
    const tentativa = atual + '/' + buildId;
    if (sessionStorage.getItem(CHAVE_TENTATIVA) === tentativa) return;
    if (buildId === atual && !await arquivoDisponivel(error.message, signal)) return;
    if (signal.aborted || sessionStorage.getItem(CHAVE_TENTATIVA) === tentativa) return;
    sessionStorage.setItem(CHAVE_TENTATIVA, tentativa);
    reload();
  } catch {
    // Quando a rede ou o armazenamento falha, a recarga manual continua disponível.
  }
}
