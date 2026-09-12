export const POLLING_BASE_INTERVAL_MS = 30 * 60 * 1000;
export const POLLING_MAX_JITTER_MS = 60 * 1000;

/** Integrações acompanha turnos em execução; suspende consultas com a aba oculta. */
export const INTEGRATION_QUERY_POLLING_OPTIONS = {
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: 'always',
} as const;

export function calcularIntervaloComJitter(random = Math.random) {
  return POLLING_BASE_INTERVAL_MS + Math.floor(random() * POLLING_MAX_JITTER_MS);
}

export const OPERATIONAL_QUERY_POLLING_OPTIONS = {
  refetchInterval: () => calcularIntervaloComJitter(),
  refetchIntervalInBackground: true,
} as const;
