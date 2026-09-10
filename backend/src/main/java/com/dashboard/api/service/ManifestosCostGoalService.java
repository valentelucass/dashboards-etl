package com.dashboard.api.service;

import com.dashboard.api.dto.FiltroConsultaDTO;
import com.dashboard.api.dto.manifestos.ManifestosCostGoalConfigDTO;
import com.dashboard.api.dto.manifestos.ManifestosCostGoalConfigRequestDTO;
import com.dashboard.api.dto.manifestos.ManifestosCustosEvolucaoDTO;
import com.dashboard.api.dto.manifestos.ManifestosCustosEvolucaoDTO.CustoDiarioDTO;
import com.dashboard.api.model.acesso.ManifestosCostGoalEntity;
import com.dashboard.api.model.acesso.UsuarioEntity;
import com.dashboard.api.repository.ManifestosCostDataRepository;
import com.dashboard.api.repository.acesso.ManifestosCostGoalRepository;
import com.dashboard.api.repository.acesso.ManifestosCostGoalRepository.GoalAggregateProjection;
import com.dashboard.api.repository.acesso.UsuarioRepository;
import com.dashboard.api.service.acesso.EscopoFilialService;
import com.dashboard.api.service.acesso.EscopoFilialService.EscopoFilial;
import com.dashboard.api.util.ConsultaFiltroUtils;
import com.dashboard.api.util.FilialKeyUtils;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ManifestosCostGoalService {

    private static final Logger log = LoggerFactory.getLogger(ManifestosCostGoalService.class);
    private static final ZoneId ZONE_ID_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final String GLOBAL_BRANCH_ID = "GLOBAL";
    private static final String DEFAULT_CONTRACT_TYPE = "GERAL";
    private static final String DEFAULT_CONTRACT_TYPE_KEY = "GERAL";
    private static final String ALL_CONTRACT_TYPES = "__all_contract_types__";
    private static final String ALL_CLASSIFICATIONS = "__all_classifications__";
    private static final List<String> FILTROS_SEM_DIMENSAO_ORCAMENTARIA = List.of(
            "status",
            "motoristas",
            "veiculos",
            "numeroManifesto",
            "tiposCarga",
            "tipoMotorista"
    );

    private final ManifestosCostGoalRepository goalRepository;
    private final ManifestosCostDataRepository performanceRepository;
    private final EscopoFilialService escopoFilialService;
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;

    @Autowired
    public ManifestosCostGoalService(
            ManifestosCostGoalRepository goalRepository,
            ManifestosCostDataRepository performanceRepository,
            EscopoFilialService escopoFilialService,
            UsuarioRepository usuarioRepository
    ) {
        this(
                goalRepository,
                performanceRepository,
                escopoFilialService,
                usuarioRepository,
                Clock.system(ZONE_ID_BRASILIA)
        );
    }

    ManifestosCostGoalService(
            ManifestosCostGoalRepository goalRepository,
            ManifestosCostDataRepository performanceRepository,
            EscopoFilialService escopoFilialService,
            Clock clock
    ) {
        this(goalRepository, performanceRepository, escopoFilialService, null, clock);
    }

    ManifestosCostGoalService(
            ManifestosCostGoalRepository goalRepository,
            ManifestosCostDataRepository performanceRepository,
            EscopoFilialService escopoFilialService,
            UsuarioRepository usuarioRepository,
            Clock clock
    ) {
        this.goalRepository = goalRepository;
        this.performanceRepository = performanceRepository;
        this.escopoFilialService = escopoFilialService;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock != null ? clock : Clock.system(ZONE_ID_BRASILIA);
    }

    @Transactional(readOnly = true)
    public List<ManifestosCostGoalConfigDTO> listar(int ano, int mes) {
        return listar(ano, mes, null);
    }

    @Transactional(readOnly = true)
    public List<ManifestosCostGoalConfigDTO> listar(int ano, int mes, String branchId) {
        LocalDate competencia = competencia(ano, mes);
        boolean filtroFilialAtivo = branchId != null && !branchId.isBlank();
        List<ManifestosCostGoalEntity> metasEntities;
        if (filtroFilialAtivo) {
            String normalizedBranchId = normalizarBranchId(branchId);
            metasEntities = normalizedBranchId == null
                    ? goalRepository.findGlobalByYearMonthOrdered(competencia)
                    : goalRepository.findAllByBranchIdAndYearMonthOrdered(normalizedBranchId, competencia);
        } else {
            metasEntities = goalRepository.findAllByYearMonthOrdered(competencia);
        }

        List<ManifestosCostGoalConfigDTO> metas = metasEntities.stream()
                .map(ManifestosCostGoalConfigDTO::from)
                .toList();

        if (metas.isEmpty() && !filtroFilialAtivo) {
            return List.of(ManifestosCostGoalConfigDTO.fallback(
                    ano,
                    mes,
                    "Orçamento de custo operacional não cadastrado"
            ));
        }
        return metas;
    }

    @Transactional
    public ManifestosCostGoalConfigDTO salvar(
            ManifestosCostGoalConfigRequestDTO request,
            String authenticationName
    ) {
        Objects.requireNonNull(request, "Dados da meta são obrigatórios.");
        LocalDate competencia = competencia(request.ano(), request.mes());
        String branchId = normalizarBranchId(request.branchId());
        ContractType contrato = normalizarContrato(request.contractType(), request.contractTypeKey());
        String classificationKey = normalizarClassificationKey(request.classificationKey());
        BigDecimal costGoal = normalizarMeta(request.costGoal());
        UsuarioEntity usuario = usuarioAutenticado(authenticationName);

        ManifestosCostGoalEntity entity = buscarExistente(
                branchId,
                competencia,
                contrato.key(),
                classificationKey
        ).orElseGet(ManifestosCostGoalEntity::new);
        entity.setBranchId(branchId);
        entity.setYearMonth(competencia);
        entity.setContractType(contrato.label());
        entity.setContractTypeKey(contrato.key());
        entity.setClassificationKey(classificationKey);
        entity.setCostGoal(costGoal);
        entity.setUpdatedByUser(usuario);

        return ManifestosCostGoalConfigDTO.from(goalRepository.saveAndFlush(entity));
    }

    @Transactional
    public void remover(
            String branchId,
            String contractTypeKey,
            String classificationKey,
            int ano,
            int mes
    ) {
        LocalDate competencia = competencia(ano, mes);
        String normalizedBranchId = normalizarBranchId(branchId);
        ContractType contrato = normalizarContrato(null, contractTypeKey);
        String normalizedClassificationKey = normalizarClassificationKey(classificationKey);
        buscarExistente(
                normalizedBranchId,
                competencia,
                contrato.key(),
                normalizedClassificationKey
        ).ifPresent(goalRepository::delete);
    }

    @Transactional
    public List<ManifestosCostGoalConfigDTO> replicar(
            int anoDestino,
            int mesDestino,
            String authenticationName
    ) {
        LocalDate competenciaDestino = competencia(anoDestino, mesDestino);
        LocalDate competenciaOrigem = competenciaDestino.minusMonths(1);
        YearMonth destino = YearMonth.from(competenciaDestino);
        YearMonth origem = YearMonth.from(competenciaOrigem);

        long totalDestino = goalRepository.countByYearMonth(competenciaDestino);
        if (totalDestino > 0) {
            throw new IllegalStateException(
                    "Já existem metas cadastradas para " + formatarCompetencia(destino) + "."
            );
        }

        long totalOrigem = goalRepository.countByYearMonth(competenciaOrigem);
        if (totalOrigem == 0) {
            throw new IllegalArgumentException(
                    "Não há metas cadastradas em " + formatarCompetencia(origem) + " para copiar."
            );
        }

        List<ManifestosCostGoalEntity> metasOrigem =
                goalRepository.findAllByYearMonthForReplication(competenciaOrigem);
        if (metasOrigem.size() != totalOrigem) {
            throw new IllegalStateException("A consulta das metas de origem não retornou todas as linhas esperadas.");
        }

        UsuarioEntity usuario = usuarioAutenticado(authenticationName);
        List<ManifestosCostGoalEntity> metasDestino = metasOrigem.stream()
                .map(metaOrigem -> copiarMeta(metaOrigem, competenciaDestino, usuario))
                .toList();

        goalRepository.saveAllAndFlush(metasDestino);
        return goalRepository.findAllByYearMonthOrdered(competenciaDestino).stream()
                .map(ManifestosCostGoalConfigDTO::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ManifestosCustosEvolucaoDTO calcular(FiltroConsultaDTO filtro, BigDecimal custoRealPeriodo) {
        return calcular(filtro, filtro, custoRealPeriodo);
    }

    @Transactional(readOnly = true)
    public ManifestosCustosEvolucaoDTO calcular(
            FiltroConsultaDTO filtro,
            FiltroConsultaDTO filtroOrcamento,
            BigDecimal custoRealPeriodo
    ) {
        FiltroConsultaDTO filtroMetas = filtroOrcamento == null ? filtro : filtroOrcamento;
        BigDecimal custoReal = moeda(custoRealPeriodo);
        List<CustoDiarioDTO> serieDiaria = performanceRepository.buscarCustosDiarios(filtro);
        LocalDate inicioCompetencia = filtro.dataInicio().withDayOfMonth(1);
        LocalDate fimCompetenciaExclusivo = filtro.dataFim().withDayOfMonth(1).plusMonths(1);
        LocalDate fimCompetencia = fimCompetenciaExclusivo.minusDays(1);
        LocalDate referenciaFechada = referenciaFechada(filtro.dataFim());
        LocalDate referenciaLimitada = referenciaFechada.isAfter(fimCompetencia)
                ? fimCompetencia
                : referenciaFechada;

        int totalDiasUteis = Math.max(1, contarDiasUteis(inicioCompetencia, fimCompetencia));
        int diasUteisDecorridos = referenciaLimitada.isBefore(inicioCompetencia)
                ? 0
                : contarDiasUteis(inicioCompetencia, referenciaLimitada);
        int diasUteisRestantes = Math.max(0, totalDiasUteis - diasUteisDecorridos);

        BigDecimal custoFechado = buscarCustoFechado(filtro, referenciaFechada, custoReal);
        BigDecimal custoMedioDiarioReal = dividir(custoFechado, Math.max(1, diasUteisDecorridos));
        BigDecimal tendenciaCusto = custoReal
                .add(custoMedioDiarioReal.multiply(BigDecimal.valueOf(diasUteisRestantes)))
                .setScale(2, RoundingMode.HALF_UP);

        AplicabilidadeOrcamento aplicabilidade = resolverAplicabilidade(filtroMetas);
        if (!aplicabilidade.aplicavel()) {
            return montarRespostaSemOrcamento(
                    false,
                    aplicabilidade.observacao(),
                    totalDiasUteis,
                    diasUteisDecorridos,
                    diasUteisRestantes,
                    custoReal,
                    custoMedioDiarioReal,
                    tendenciaCusto,
                    serieDiaria
            );
        }

        GoalAggregateProjection aggregate = aplicabilidade.usarMetaGlobal()
                ? goalRepository.aggregateGlobalOrBranches(
                        inicioCompetencia,
                        fimCompetenciaExclusivo,
                        aplicabilidade.contractTypeKeys(),
                        aplicabilidade.contractTypeFilterActive(),
                        aplicabilidade.classificationKeys(),
                        aplicabilidade.classificationFilterActive()
                )
                : goalRepository.aggregateByBranches(
                        inicioCompetencia,
                        fimCompetenciaExclusivo,
                        aplicabilidade.filiais(),
                        aplicabilidade.contractTypeKeys(),
                        aplicabilidade.contractTypeFilterActive(),
                        aplicabilidade.classificationKeys(),
                        aplicabilidade.classificationFilterActive()
        );
        BigDecimal orcamentoCusto = moeda(aggregate == null ? null : aggregate.getCostGoal());
        boolean configurado = aggregate != null && aggregate.getConfiguredGoals() > 0;
        if (!configurado) {
            return montarRespostaSemOrcamento(
                    true,
                    "Orçamento de custo não configurado para as competências e filiais selecionadas.",
                    totalDiasUteis,
                    diasUteisDecorridos,
                    diasUteisRestantes,
                    custoReal,
                    custoMedioDiarioReal,
                    tendenciaCusto,
                    serieDiaria
            );
        }
        BigDecimal limiteDiarioBase = dividir(orcamentoCusto, totalDiasUteis);
        BigDecimal saldoOrcamentario = orcamentoCusto.subtract(custoFechado)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal saldoDisponivelParaLimite = saldoOrcamentario.max(BigDecimal.ZERO);
        BigDecimal limiteDiarioDinamico = dividir(
                saldoDisponivelParaLimite,
                Math.max(1, diasUteisRestantes)
        );
        BigDecimal consumoOrcamento = percentual(custoReal, orcamentoCusto);

        return new ManifestosCustosEvolucaoDTO(
                true,
                true,
                null,
                totalDiasUteis,
                diasUteisDecorridos,
                diasUteisRestantes,
                orcamentoCusto,
                custoReal,
                limiteDiarioBase,
                custoMedioDiarioReal,
                saldoOrcamentario,
                limiteDiarioDinamico,
                tendenciaCusto,
                consumoOrcamento,
                serieDiaria
        );
    }

    private Optional<ManifestosCostGoalEntity> buscarExistente(
            String branchId,
            LocalDate competencia,
            String contractTypeKey,
            String classificationKey
    ) {
        if (branchId == null) {
            return goalRepository.findGlobalByYearMonthAndContractTypeKeyAndClassificationKey(
                    competencia,
                    contractTypeKey,
                    classificationKey
            );
        }
        return goalRepository.findByBranchIdAndYearMonthAndContractTypeKeyAndClassificationKey(
                branchId,
                competencia,
                contractTypeKey,
                classificationKey
        );
    }

    private ManifestosCostGoalEntity copiarMeta(
            ManifestosCostGoalEntity origem,
            LocalDate competenciaDestino,
            UsuarioEntity usuario
    ) {
        ContractType contrato = normalizarContrato(origem.getContractType(), origem.getContractTypeKey());
        ManifestosCostGoalEntity destino = new ManifestosCostGoalEntity();
        destino.setBranchId(normalizarBranchId(origem.getBranchId()));
        destino.setYearMonth(competenciaDestino);
        destino.setContractType(contrato.label());
        destino.setContractTypeKey(contrato.key());
        destino.setClassificationKey(normalizarClassificationKey(origem.getClassificationKey()));
        destino.setCostGoal(origem.getCostGoal());
        destino.setUpdatedByUser(usuario);
        return destino;
    }

    private String formatarCompetencia(YearMonth competencia) {
        return String.format("%02d/%d", competencia.getMonthValue(), competencia.getYear());
    }

    private LocalDate competencia(int ano, int mes) {
        if (ano < 2000 || ano > 2100) {
            throw new IllegalArgumentException("Ano da meta deve estar entre 2000 e 2100.");
        }
        if (mes < 1 || mes > 12) {
            throw new IllegalArgumentException("Mês da meta deve estar entre 1 e 12.");
        }
        return LocalDate.of(ano, mes, 1);
    }

    private String normalizarBranchId(String branchId) {
        String normalized = branchId == null || branchId.isBlank() ? GLOBAL_BRANCH_ID : branchId.trim();
        if (GLOBAL_BRANCH_ID.equalsIgnoreCase(normalized)) {
            return null;
        }
        normalized = FilialKeyUtils.extrairCodigoOperacional(normalized);
        if (normalized == null) {
            throw new IllegalArgumentException("Filial da meta deve usar uma sigla operacional válida.");
        }
        if (normalized.length() > 120) {
            throw new IllegalArgumentException("Filial da meta excede 120 caracteres.");
        }
        return normalized;
    }

    private ContractType normalizarContrato(String contractType, String contractTypeKey) {
        String key = contractTypeKey == null || contractTypeKey.isBlank()
                ? normalizarContractTypeKey(contractType)
                : contractTypeKey.trim().toUpperCase(Locale.ROOT);
        if (key.isBlank()) {
            key = DEFAULT_CONTRACT_TYPE_KEY;
        }
        String label = contractType == null || contractType.isBlank()
                ? labelContrato(key)
                : contractType.trim().toUpperCase(Locale.ROOT);
        if (label.length() > 100) {
            throw new IllegalArgumentException("Tipo de contrato da meta excede 100 caracteres.");
        }
        if (key.length() > 100) {
            throw new IllegalArgumentException("Chave do tipo de contrato da meta excede 100 caracteres.");
        }
        return new ContractType(label, key);
    }

    private String normalizarContractTypeKey(String contractType) {
        if (contractType == null || contractType.isBlank()) {
            return DEFAULT_CONTRACT_TYPE_KEY;
        }
        return contractType.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizarClassificationKey(String classificationKey) {
        if (classificationKey == null || classificationKey.isBlank()) {
            return null;
        }
        String normalized = classificationKey.trim().toUpperCase(Locale.ROOT);
        if (GLOBAL_BRANCH_ID.equals(normalized) || DEFAULT_CONTRACT_TYPE_KEY.equals(normalized)) {
            return null;
        }
        if (normalized.length() > 120) {
            throw new IllegalArgumentException("Chave da classificação da meta excede 120 caracteres.");
        }
        return normalized;
    }

    private String labelContrato(String contractTypeKey) {
        return switch (contractTypeKey) {
            case "FROTA" -> "FROTA";
            case "AGREGADO" -> "AGREGADO";
            case "TERCEIRO" -> "TERCEIRO";
            case "FROTA + PX" -> "FROTA + PX";
            default -> DEFAULT_CONTRACT_TYPE_KEY.equals(contractTypeKey) ? DEFAULT_CONTRACT_TYPE : contractTypeKey;
        };
    }

    private BigDecimal normalizarMeta(BigDecimal costGoal) {
        BigDecimal normalized = Objects.requireNonNullElse(costGoal, BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
        if (normalized.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("Meta mensal de custo não pode ser negativa.");
        }
        return normalized;
    }

    private UsuarioEntity usuarioAutenticado(String authenticationName) {
        if (usuarioRepository == null) {
            throw new IllegalStateException("Repositório de usuários não configurado para persistir metas.");
        }
        String email = authenticationName == null ? "" : authenticationName;
        return usuarioRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new IllegalArgumentException("Usuário autenticado não encontrado."));
    }

    private ManifestosCustosEvolucaoDTO montarRespostaSemOrcamento(
            boolean aplicavel,
            String observacao,
            int totalDiasUteis,
            int diasUteisDecorridos,
            int diasUteisRestantes,
            BigDecimal custoReal,
            BigDecimal custoMedioDiarioReal,
            BigDecimal tendenciaCusto,
            List<CustoDiarioDTO> serieDiaria
    ) {
        BigDecimal zero = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        return new ManifestosCustosEvolucaoDTO(
                aplicavel,
                false,
                observacao,
                totalDiasUteis,
                diasUteisDecorridos,
                diasUteisRestantes,
                zero,
                custoReal,
                zero,
                custoMedioDiarioReal,
                zero,
                zero,
                tendenciaCusto,
                zero,
                serieDiaria
        );
    }

    private BigDecimal buscarCustoFechado(FiltroConsultaDTO filtro, LocalDate referenciaFechada, BigDecimal custoRealPeriodo) {
        LocalDate fimFechado = referenciaFechada.isAfter(filtro.dataFim())
                ? filtro.dataFim()
                : referenciaFechada;
        if (fimFechado.isBefore(filtro.dataInicio())) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        if (fimFechado.equals(filtro.dataFim())) {
            return custoRealPeriodo;
        }
        return performanceRepository.buscarCustoTotal(new FiltroConsultaDTO(
                filtro.dataInicio(),
                fimFechado,
                filtro.filtros()
        ));
    }

    private AplicabilidadeOrcamento resolverAplicabilidade(FiltroConsultaDTO filtro) {
        List<String> filtrosIncompativeis = FILTROS_SEM_DIMENSAO_ORCAMENTARIA.stream()
                .filter(filtro::temFiltro)
                .toList();
        if (!filtrosIncompativeis.isEmpty()) {
            return AplicabilidadeOrcamento.indisponivel(
                    "Orçamento indisponível com filtros sem dimensão orçamentária: "
                            + String.join(", ", filtrosIncompativeis) + "."
            );
        }

        EscopoFilial escopo = escopoFilialService.escopoAtual();
        if (!escopo.acessoTotal() && escopo.filiaisOrdenadas().isEmpty()) {
            return AplicabilidadeOrcamento.indisponivel(
                    "Orçamento indisponível porque o usuário não possui filial autorizada."
            );
        }

        List<String> contractTypeKeys = normalizar(filtro.valores("tiposContrato"));
        List<String> classificationKeys = normalizar(filtro.valores("classificacoes"));
        boolean filtroFiliaisAtivo = filtro.temFiltro("filiais");
        List<String> filiaisSelecionadas = normalizarFiliais(filtro.valores("filiais"));
        if (filtroFiliaisAtivo && filiaisSelecionadas.isEmpty()) {
            return AplicabilidadeOrcamento.indisponivel(
                    "Orçamento indisponível porque as filiais selecionadas não possuem chave orçamentária."
            );
        }
        if (escopo.acessoTotal() && filiaisSelecionadas.isEmpty()) {
            return AplicabilidadeOrcamento.global(contractTypeKeys, classificationKeys);
        }

        List<String> filiaisPermitidas = escopo.acessoTotal()
                ? filiaisSelecionadas
                : intersecao(filiaisSelecionadas, escopo.filiaisOrdenadas());
        if (!escopo.acessoTotal() && filiaisSelecionadas.isEmpty()) {
            filiaisPermitidas = normalizarFiliais(escopo.filiaisOrdenadas());
        }
        if (filiaisPermitidas.isEmpty()) {
            return AplicabilidadeOrcamento.indisponivel(
                    "Orçamento indisponível porque as filiais selecionadas estão fora do escopo autorizado."
            );
        }
        return AplicabilidadeOrcamento.porFiliais(filiaisPermitidas, contractTypeKeys, classificationKeys);
    }

    private List<String> intersecao(Collection<String> selecionadas, Collection<String> permitidas) {
        Set<String> permitidasNormalizadas = new LinkedHashSet<>(normalizarFiliais(permitidas));
        return normalizarFiliais(selecionadas).stream()
                .filter(permitidasNormalizadas::contains)
                .toList();
    }

    private List<String> normalizarFiliais(Collection<String> valores) {
        return FilialKeyUtils.normalizarCodigosParaOrcamento(valores);
    }

    private List<String> normalizar(Collection<String> valores) {
        if (valores == null) {
            return List.of();
        }
        return valores.stream()
                .filter(valor -> valor != null && !valor.isBlank())
                .map(valor -> valor.trim().toUpperCase(Locale.ROOT))
                .distinct()
                .toList();
    }

    private LocalDate referenciaFechada(LocalDate dataFimFiltro) {
        LocalDate ultimoDiaUtilFechado = buscarUltimoDiaUtilFechado(LocalDate.now(clock));
        return dataFimFiltro.isAfter(ultimoDiaUtilFechado) ? ultimoDiaUtilFechado : dataFimFiltro;
    }

    private LocalDate buscarUltimoDiaUtilFechado(LocalDate dataReferencia) {
        try {
            LocalDate ultimoDiaUtil = performanceRepository.buscarUltimoDiaUtilFechado(dataReferencia);
            if (ultimoDiaUtil != null) {
                return ultimoDiaUtil;
            }
        } catch (RuntimeException ex) {
            log.warn(
                    "Não foi possível consultar dim_calendario para tendência de custos. "
                            + "Usando fallback por fim de semana. Motivo: {}",
                    ex.getMessage()
            );
        }
        return ultimoDiaUtilAnterior(dataReferencia);
    }

    private int contarDiasUteis(LocalDate inicio, LocalDate fim) {
        if (inicio.isAfter(fim)) {
            return 0;
        }
        try {
            Integer total = performanceRepository.contarDiasUteisCalendario(inicio, fim);
            if (total != null) {
                return total;
            }
        } catch (RuntimeException ex) {
            log.warn(
                    "Não foi possível consultar dias úteis na dim_calendario para custos. "
                            + "Usando fallback por fim de semana. Motivo: {}",
                    ex.getMessage()
            );
        }
        return contarDiasUteisPorFimDeSemana(inicio, fim);
    }

    private LocalDate ultimoDiaUtilAnterior(LocalDate data) {
        LocalDate candidato = data.minusDays(1);
        while (!isDiaUtil(candidato)) {
            candidato = candidato.minusDays(1);
        }
        return candidato;
    }

    private int contarDiasUteisPorFimDeSemana(LocalDate inicio, LocalDate fim) {
        int total = 0;
        for (LocalDate data = inicio; !data.isAfter(fim); data = data.plusDays(1)) {
            if (isDiaUtil(data)) {
                total++;
            }
        }
        return total;
    }

    private boolean isDiaUtil(LocalDate data) {
        DayOfWeek dia = data.getDayOfWeek();
        return dia != DayOfWeek.SATURDAY && dia != DayOfWeek.SUNDAY;
    }

    private BigDecimal dividir(BigDecimal valor, int divisor) {
        if (divisor <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return moeda(valor).divide(BigDecimal.valueOf(divisor), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal percentual(BigDecimal valor, BigDecimal base) {
        if (base == null || base.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return moeda(valor)
                .multiply(BigDecimal.valueOf(100))
                .divide(base, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal moeda(BigDecimal valor) {
        return ConsultaFiltroUtils.zeroSeNulo(valor).setScale(2, RoundingMode.HALF_UP);
    }

    private record ContractType(String label, String key) {
    }

    private record AplicabilidadeOrcamento(
            boolean aplicavel,
            boolean usarMetaGlobal,
            List<String> filiais,
            List<String> contractTypeKeys,
            List<String> classificationKeys,
            String observacao
    ) {
        static AplicabilidadeOrcamento global(List<String> contractTypeKeys, List<String> classificationKeys) {
            return new AplicabilidadeOrcamento(
                    true,
                    true,
                    List.of(),
                    filtroContrato(contractTypeKeys),
                    filtroClassificacao(classificationKeys),
                    null
            );
        }

        static AplicabilidadeOrcamento porFiliais(
                List<String> filiais,
                List<String> contractTypeKeys,
                List<String> classificationKeys
        ) {
            return new AplicabilidadeOrcamento(
                    true,
                    false,
                    filiais,
                    filtroContrato(contractTypeKeys),
                    filtroClassificacao(classificationKeys),
                    null
            );
        }

        static AplicabilidadeOrcamento indisponivel(String observacao) {
            return new AplicabilidadeOrcamento(
                    false,
                    false,
                    List.of(),
                    List.of(ALL_CONTRACT_TYPES),
                    List.of(ALL_CLASSIFICATIONS),
                    observacao
            );
        }

        int contractTypeFilterActive() {
            return contractTypeKeys.size() == 1 && ALL_CONTRACT_TYPES.equals(contractTypeKeys.get(0)) ? 0 : 1;
        }

        int classificationFilterActive() {
            return classificationKeys.size() == 1 && ALL_CLASSIFICATIONS.equals(classificationKeys.get(0)) ? 0 : 1;
        }

        private static List<String> filtroContrato(List<String> contractTypeKeys) {
            return contractTypeKeys == null || contractTypeKeys.isEmpty()
                    ? List.of(ALL_CONTRACT_TYPES)
                    : contractTypeKeys;
        }

        private static List<String> filtroClassificacao(List<String> classificationKeys) {
            return classificationKeys == null || classificationKeys.isEmpty()
                    ? List.of(ALL_CLASSIFICATIONS)
                    : classificationKeys;
        }
    }
}
