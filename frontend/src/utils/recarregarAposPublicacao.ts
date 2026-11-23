const CHAVE_TENTATIVA = 'dashboard:recarga-publicacao';
const FALHA_DE_MODULO = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css/i;

export async function recarregarAposPublicacao(error: unknown, signal: AbortSignal, reload = () => window.location.reload()) {
  const atual = document.documentElement.dataset.dashboardBuildId;
  if (!atual || atual === 'dev' || !(error instanceof Error) || !FALHA_DE_MODULO.test(error.message)) return;

  try {
    const resposta = await fetch('/build-info.json', { cache: 'no-store', signal });
    if (!resposta.ok) return;
    const { buildId } = await resposta.json();
    if (signal.aborted || typeof buildId !== 'string' || !buildId || buildId === atual) return;
    const tentativa = atual + '/' + buildId;
    if (sessionStorage.getItem(CHAVE_TENTATIVA) === tentativa) return;
    sessionStorage.setItem(CHAVE_TENTATIVA, tentativa);
    reload();
  } catch {
    // Quando a rede ou o armazenamento falha, a recarga manual continua disponível.
  }
}
