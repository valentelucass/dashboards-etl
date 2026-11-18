package com.dashboard.api.service;

import com.dashboard.api.dto.dimensoes.PagadorDimDTO;
import com.dashboard.api.dto.dimensoes.PlanoContasDimDTO;
import com.dashboard.api.dto.dimensoes.UsuarioDimDTO;
import com.dashboard.api.dto.dimensoes.VeiculoDimDTO;
import com.dashboard.api.repository.DimFilialRepository;
import com.dashboard.api.repository.DimMotoristaRepository;
import com.dashboard.api.repository.DimUsuarioRepository;
import com.dashboard.api.repository.DimVeiculoRepository;
import com.dashboard.api.repository.VisaoColetasRepository;
import com.dashboard.api.repository.VisaoContasAPagarRepository;
import com.dashboard.api.repository.VisaoCotacoesRepository;
import com.dashboard.api.repository.VisaoFaturasClienteRepository;
import com.dashboard.api.repository.VisaoFretesRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;

@Service
public class DimensoesService {

    private static final Logger log = LoggerFactory.getLogger(DimensoesService.class);
    private static final Duration CACHE_FILIAIS_TTL = Duration.ofMinutes(10);
    private static final int LIMITE_MAXIMO_PAGADORES = 50;
    private static final String CACHE_FILIAIS_KEY = "filiais";
    private static final List<String> FILIAIS_OPERACIONAIS_PADRAO = List.of(
            "AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "CAS - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "CPQ - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "CWB - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "NHB - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "REC - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "RJR - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA",
            "SPO - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA"
    );

    private final DimFilialRepository dimFilialRepository;
    private final DimMotoristaRepository dimMotoristaRepository;
    private final DimUsuarioRepository dimUsuarioRepository;
    private final DimVeiculoRepository dimVeiculoRepository;
    private final VisaoColetasRepository coletasRepository;
    private final VisaoFretesRepository fretesRepository;
    private final VisaoCotacoesRepository cotacoesRepository;
    private final VisaoFaturasClienteRepository faturasClienteRepository;
    private final VisaoContasAPagarRepository contasAPagarRepository;
    private final EscopoFilialService escopoFilialService;
    private final ConcurrentMap<String, CacheEntry<List<String>>> filiaisCache = new ConcurrentHashMap<>();

    @Autowired
    public DimensoesService(
            DimFilialRepository dimFilialRepository,
            DimMotoristaRepository dimMotoristaRepository,
            DimUsuarioRepository dimUsuarioRepository,
            DimVeiculoRepository dimVeiculoRepository,
            VisaoColetasRepository coletasRepository,
            VisaoFretesRepository fretesRepository,
            VisaoCotacoesRepository cotacoesRepository,
            VisaoFaturasClienteRepository faturasClienteRepository,
            VisaoContasAPagarRepository contasAPagarRepository,
            EscopoFilialService escopoFilialService
    ) {
        this.dimFilialRepository = dimFilialRepository;
        this.dimMotoristaRepository = dimMotoristaRepository;
        this.dimUsuarioRepository = dimUsuarioRepository;
        this.dimVeiculoRepository = dimVeiculoRepository;
        this.coletasRepository = coletasRepository;
        this.fretesRepository = fretesRepository;
        this.cotacoesRepository = cotacoesRepository;
        this.faturasClienteRepository = faturasClienteRepository;
        this.contasAPagarRepository = contasAPagarRepository;
        this.escopoFilialService = escopoFilialService;
    }

    public List<String> listarFiliais() {
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        if (escopo.acessoTotal()) {
            return listarFiliaisComCache();
        }
        return limparFiliaisParaExibicao(escopo.filiaisOrdenadas());
    }

    private List<String> listarFiliaisComCache() {
        Instant agora = Instant.now();
        CacheEntry<List<String>> novaEntry = new CacheEntry<>(
                new CompletableFuture<>(),
                agora.plus(CACHE_FILIAIS_TTL)
        );

        CacheEntry<List<String>> entry = filiaisCache.compute(CACHE_FILIAIS_KEY, (key, existente) ->
                existente != null && existente.validaEm(agora) ? existente : novaEntry
        );

        if (entry == novaEntry) {
            try {
                List<String> filiais = consultarFiliais();
                novaEntry.future().complete(filiais);
                return filiais;
            } catch (RuntimeException ex) {
                novaEntry.future().completeExceptionally(ex);
                filiaisCache.remove(CACHE_FILIAIS_KEY, novaEntry);
                List<String> fallback = fallbackFiliais(ex);
                filiaisCache.put(CACHE_FILIAIS_KEY, CacheEntry.pronta(fallback, agora.plus(Duration.ofMinutes(2))));
                return fallback;
            }
        }

        try {
            return entry.future().join();
        } catch (CompletionException ex) {
            if (ex.getCause() instanceof RuntimeException runtimeException) {
                return fallbackFiliais(runtimeException);
            }
            throw ex;
        }
    }

    private List<String> consultarFiliais() {
        return limparFiliaisParaExibicao(dimFilialRepository.findDistinctNomes());
    }

    private List<String> limparFiliaisParaExibicao(List<String> filiais) {
        return filiais.stream()
                .filter(this::temTexto)
                .map(this::normalizarFilialParaExibicao)
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }

    private String normalizarFilialParaExibicao(String filial) {
        return filial.trim().toUpperCase(Locale.ROOT);
    }

    private List<String> fallbackFiliais(RuntimeException ex) {
        log.warn(
                "Dimensão de filiais indisponível; usando lista operacional padrão temporária. causa={}",
                ex.getMessage()
        );
        return FILIAIS_OPERACIONAIS_PADRAO;
    }

    public List<String> listarClientes() {
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        Set<String> clientes = new LinkedHashSet<>();

        listarClientesColetas(escopo).forEach(clientes::add);
        listarClientesFretes(escopo).forEach(clientes::add);
        listarClientesCotacoes(escopo).forEach(clientes::add);

        try {
            listarClientesFaturas(escopo).forEach(clientes::add);
        } catch (DataAccessException ex) {
            log.warn("Dimensão de clientes ignorou faturas_por_cliente temporariamente. Verifique a fato_gestao_vista_faturas. Causa: {}",
                    ex.getMostSpecificCause().getMessage());
        }

        return clientes.stream()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }

    private List<String> listarClientesColetas(EscopoFilialService.EscopoFilial escopo) {
        return limparTextos(escopo.acessoTotal()
                ? coletasRepository.findDistinctClientes()
                : coletasRepository.findDistinctClientesByFilialIn(filiaisNormalizadas(escopo)));
    }

    private List<String> listarClientesFretes(EscopoFilialService.EscopoFilial escopo) {
        try {
            return limparTextos(escopo.acessoTotal()
                    ? fretesRepository.findDistinctClientes()
                    : fretesRepository.findDistinctClientesByFilialIn(filiaisNormalizadas(escopo)));
        } catch (DataAccessException ex) {
            log.warn("Dimensão de clientes ignorou fretes temporariamente. Verifique a tabela fato_fretes_faturamento. Causa: {}",
                    ex.getMostSpecificCause().getMessage());
            return List.of();
        }
    }

    private List<String> listarClientesCotacoes(EscopoFilialService.EscopoFilial escopo) {
        return limparTextos(escopo.acessoTotal()
                ? cotacoesRepository.findDistinctClientes()
                : cotacoesRepository.findDistinctClientesByFilialIn(filiaisNormalizadas(escopo)));
    }

    private List<String> listarClientesFaturas(EscopoFilialService.EscopoFilial escopo) {
        return limparTextos(escopo.acessoTotal()
                ? faturasClienteRepository.findDistinctClientes()
                : faturasClienteRepository.findDistinctClientesByFilialIn(filiaisNormalizadas(escopo)));
    }

    public List<String> listarPagadoresFaturasPorCliente() {
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        if (escopo.acessoTotal()) {
            return faturasClienteRepository.findDistinctPagadores();
        }

        if (escopo.filiaisOrdenadas().isEmpty()) {
            return List.of();
        }

        return faturasClienteRepository.findDistinctPagadoresByFilialIn(filiaisNormalizadas(escopo));
    }

    public List<String> listarClientesCnpjFaturasPorCliente() {
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        if (escopo.acessoTotal()) {
            return faturasClienteRepository.findDistinctClienteCnpj();
        }

        if (escopo.filiaisOrdenadas().isEmpty()) {
            return List.of();
        }

        return faturasClienteRepository.findDistinctClienteCnpjByFilialIn(filiaisNormalizadas(escopo));
    }

    public List<PagadorDimDTO> buscarPagadores(String busca, int limite) {
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        String termo = busca == null ? "" : busca.trim().toLowerCase(Locale.ROOT);
        int buscaVazia = termo.isBlank() ? 1 : 0;
        int limiteSeguro = Math.max(1, Math.min(limite, LIMITE_MAXIMO_PAGADORES));
        List<String> escopoFiliais = escopo.acessoTotal()
                ? List.of("__todos__")
                : filiaisNormalizadas(escopo);
        int escopoFiliaisVazio = escopo.acessoTotal() ? 1 : 0;

        return fretesRepository.buscarPagadores(
                        buscaVazia == 1 ? "" : termo + "%",
                        buscaVazia,
                        escopoFiliais,
                        escopoFiliaisVazio,
                        limiteSeguro
                ).stream()
                .map(row -> new PagadorDimDTO(row.getNome(), row.getDocumento()))
                .toList();
    }

    public List<String> listarMotoristas() {
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        return limparTextos(escopo.acessoTotal()
                ? dimMotoristaRepository.findDistinctNomes()
                : dimMotoristaRepository.findDistinctNomesByFilialIn(filiaisOrdenadasOuSentinela(escopo)));
    }

    public List<VeiculoDimDTO> listarVeiculos() {
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        return (escopo.acessoTotal()
                ? dimVeiculoRepository.findDistinctVeiculos()
                : dimVeiculoRepository.findDistinctVeiculosByFilialIn(filiaisOrdenadasOuSentinela(escopo))).stream()
                .map(veiculo -> new VeiculoDimDTO(veiculo.getPlaca(), veiculo.getTipoVeiculo(), veiculo.getProprietario()))
                .sorted((a, b) -> a.placa().compareToIgnoreCase(b.placa()))
                .toList();
    }

    public List<PlanoContasDimDTO> listarPlanoContas() {
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        return (escopo.acessoTotal()
                ? contasAPagarRepository.findDistinctPlanoContas()
                : contasAPagarRepository.findDistinctPlanoContasByFilialIn(filiaisNormalizadas(escopo))).stream()
                .map(row -> new PlanoContasDimDTO(
                        row.getDescricao() != null ? row.getDescricao().trim() : "",
                        row.getClassificacao() != null ? row.getClassificacao().trim() : ""
                ))
                .distinct()
                .sorted((a, b) -> a.descricao().compareToIgnoreCase(b.descricao()))
                .toList();
    }

    public List<UsuarioDimDTO> listarUsuarios() {
        EscopoFilialService.EscopoFilial escopo = escopoFilialService.escopoAtual();
        return (escopo.acessoTotal()
                ? dimUsuarioRepository.findUsuariosComColetas()
                : dimUsuarioRepository.findUsuariosComColetasByFilialIn(filiaisNormalizadas(escopo))).stream()
                .map(usuario -> new UsuarioDimDTO(usuario.getUserId(), usuario.getNome()))
                .sorted((a, b) -> a.nome().compareToIgnoreCase(b.nome()))
                .toList();
    }

    private boolean temTexto(String valor) {
        return valor != null && !valor.isBlank();
    }

    private List<String> limparTextos(List<String> valores) {
        return valores.stream()
                .filter(this::temTexto)
                .map(String::trim)
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
    }

    private List<String> filiaisNormalizadas(EscopoFilialService.EscopoFilial escopo) {
        List<String> filiais = escopo.filiaisOrdenadas().stream()
                .filter(this::temTexto)
                .map(valor -> valor.trim().toLowerCase(Locale.ROOT))
                .distinct()
                .toList();
        return filiais.isEmpty() ? List.of("__sem_filial_autorizada__") : filiais;
    }

    private List<String> filiaisOrdenadasOuSentinela(EscopoFilialService.EscopoFilial escopo) {
        List<String> filiais = escopo.filiaisOrdenadas().stream()
                .filter(this::temTexto)
                .map(String::trim)
                .distinct()
                .toList();
        return filiais.isEmpty() ? List.of("__sem_filial_autorizada__") : filiais;
    }

    private record CacheEntry<T>(CompletableFuture<T> future, Instant expiraEm) {
        private boolean validaEm(Instant instante) {
            return expiraEm.isAfter(instante);
        }

        private static <T> CacheEntry<T> pronta(T valor, Instant expiraEm) {
            return new CacheEntry<>(CompletableFuture.completedFuture(valor), expiraEm);
        }
    }
}
