package com.dashboard.api.dto;

import com.dashboard.api.dto.acesso.*;
import com.dashboard.api.dto.apresentacao.ApresentacaoSequenciaRequestDTO;
import com.dashboard.api.dto.fretes.*;
import com.dashboard.api.dto.home.*;
import com.dashboard.api.dto.indicadoresgestao.*;
import com.dashboard.api.dto.manifestos.*;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.lang.reflect.RecordComponent;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import static org.assertj.core.api.Assertions.assertThat;

/** Business boundary examples are explicit: they are not inferred from validation annotations. */
class RequestValidationTest {
    private static final ValidatorFactory FACTORY = Validation.buildDefaultValidatorFactory();
    private static final Validator VALIDATOR = FACTORY.getValidator();

    private static final List<Object> VALID_REQUESTS = List.of(
            new LoginRequestDTO("usuario@example.test", "Senha@1234567"),
            new SolicitarRedefinicaoSenhaRequestDTO("usuario@example.test"),
            new NovaSenhaObrigatoriaRequestDTO("usuario@example.test", "Temporaria@123", "NovaSenha@123"),
            new AlterarSenhaRequestDTO("Atual@1234567", "Nova@12345678"),
            new RedefinirSenhaUsuarioRequestDTO("Temporaria@123"),
            new UsuarioRequestDTO("Usuário", "usuario@example.test", null, null, "setor", "usuario_comum",
                    List.of(), null, null, null, true),
            new SetorRequestDTO("Operação", null, Map.of(), List.of("CWB")),
            new UsuarioImportacaoLoteRequestDTO("lote", List.of(new UsuarioImportacaoSetorResolucaoDTO("TI", "setor"))),
            new ApresentacaoSequenciaRequestDTO("Operação", List.of("coletas")),
            new FretesGoalConfigRequestDTO(null, 2026, 9, BigDecimal.ZERO),
            new FretesGoalReplicarRequestDTO(2026, 9),
            new ManifestosCostGoalConfigRequestDTO(null, null, null, null, 2026, 9, BigDecimal.ZERO),
            new ManifestosGoalReplicarRequestDTO(2026, 9),
            new HomeComunicadoComentarioRequestDTO("Comentário"),
            new HomeComunicadoRequestDTO("Título", "Mensagem", "NOVO", "Todos"),
            new HomeSolicitacaoMelhoriaRequestDTO("MELHORIA", "Título", "Necessidade", null, null),
            new ViagemJustificativaRequestDTO(1L, "Justificativa"),
            new KpiGoalsUpdateRequestDTO(Map.of("delivery_performance", BigDecimal.valueOf(95)), false, null)
    );

    @AfterAll
    static void closeValidator() { FACTORY.close(); }

    @ParameterizedTest(name = "aceita contrato {index}")
    @MethodSource("validRequests")
    void aceitaContratoValido(Object request) {
        assertThat(VALIDATOR.validate(request)).isEmpty();
    }

    static Stream<Object> validRequests() { return VALID_REQUESTS.stream(); }

    @ParameterizedTest(name = "{0}.{1}: {3}")
    @MethodSource("invalidFields")
    void rejeitaCampoInvalidoSemContaminarOutrosCampos(Class<?> type, String field, Object value, String scenario)
            throws ReflectiveOperationException {
        var violations = VALIDATOR.validate(withField(type, field, value));
        assertThat(violations).as(scenario).isNotEmpty();
        assertThat(violations).allSatisfy(violation ->
                assertThat(violation.getPropertyPath().toString()).startsWith(field));
    }

    static Stream<Arguments> invalidFields() {
        List<Arguments> cases = new ArrayList<>();
        requiredText(cases, LoginRequestDTO.class, "email", "senha");
        requiredText(cases, SolicitarRedefinicaoSenhaRequestDTO.class, "email");
        requiredText(cases, NovaSenhaObrigatoriaRequestDTO.class, "email", "senhaTemporaria", "novaSenha");
        requiredText(cases, AlterarSenhaRequestDTO.class, "senhaAtual", "novaSenha");
        requiredText(cases, RedefinirSenhaUsuarioRequestDTO.class, "senhaTemporaria");
        requiredText(cases, UsuarioRequestDTO.class, "nome", "email", "setorId", "papel");
        requiredText(cases, SetorRequestDTO.class, "nome");
        requiredText(cases, UsuarioImportacaoLoteRequestDTO.class, "importacaoId");
        requiredText(cases, ApresentacaoSequenciaRequestDTO.class, "nome");
        requiredText(cases, HomeComunicadoComentarioRequestDTO.class, "corpo");
        requiredText(cases, HomeComunicadoRequestDTO.class, "titulo", "corpo", "tag", "publicoAlvo");
        requiredText(cases, HomeSolicitacaoMelhoriaRequestDTO.class, "tipo", "titulo", "descricao");
        requiredText(cases, ViagemJustificativaRequestDTO.class, "justificativa");
        for (Class<?> type : List.of(LoginRequestDTO.class, SolicitarRedefinicaoSenhaRequestDTO.class,
                NovaSenhaObrigatoriaRequestDTO.class, UsuarioRequestDTO.class)) {
            add(cases, type, "email", "sem-arroba", "email malformado");
        }
        absent(cases, UsuarioRequestDTO.class, "permissoesNegadas");
        absent(cases, SetorRequestDTO.class, "permissoes", "filiaisPermitidas");
        absent(cases, UsuarioImportacaoLoteRequestDTO.class, "resolucoesSetor");
        absent(cases, ApresentacaoSequenciaRequestDTO.class, "paginas");
        absent(cases, FretesGoalConfigRequestDTO.class, "metaFaturamento");
        absent(cases, ManifestosCostGoalConfigRequestDTO.class, "costGoal");
        absent(cases, ViagemJustificativaRequestDTO.class, "codSolicitacao");
        absent(cases, KpiGoalsUpdateRequestDTO.class, "goals");
        add(cases, SetorRequestDTO.class, "filiaisPermitidas", List.of(), "sem filial");
        add(cases, ApresentacaoSequenciaRequestDTO.class, "paginas", List.of(), "sem página");
        add(cases, ApresentacaoSequenciaRequestDTO.class, "paginas", Collections.nCopies(13, "coletas"), "13 páginas");
        add(cases, ApresentacaoSequenciaRequestDTO.class, "paginas", List.of(" "), "página em branco");
        add(cases, ApresentacaoSequenciaRequestDTO.class, "paginas", Collections.singletonList(null), "página nula");
        add(cases, ApresentacaoSequenciaRequestDTO.class, "paginas", List.of("a".repeat(61)), "página longa");
        add(cases, UsuarioImportacaoLoteRequestDTO.class, "resolucoesSetor",
                List.of(new UsuarioImportacaoSetorResolucaoDTO("", "setor")), "validação aninhada de origem");
        add(cases, UsuarioImportacaoLoteRequestDTO.class, "resolucoesSetor",
                List.of(new UsuarioImportacaoSetorResolucaoDTO("TI", "")), "validação aninhada de destino");
        for (Class<?> type : List.of(FretesGoalConfigRequestDTO.class, FretesGoalReplicarRequestDTO.class,
                ManifestosCostGoalConfigRequestDTO.class, ManifestosGoalReplicarRequestDTO.class)) {
            for (int year : new int[]{1999, 2101}) add(cases, type, "ano", year, "ano fora do limite");
            for (int month : new int[]{0, 13}) add(cases, type, "mes", month, "mês fora do limite");
        }
        add(cases, FretesGoalConfigRequestDTO.class, "metaFaturamento", new BigDecimal("-0.01"), "meta negativa");
        add(cases, ManifestosCostGoalConfigRequestDTO.class, "costGoal", new BigDecimal("-0.01"), "custo negativo");
        add(cases, ViagemJustificativaRequestDTO.class, "codSolicitacao", 0L, "código zero");
        add(cases, ViagemJustificativaRequestDTO.class, "codSolicitacao", -1L, "código negativo");
        add(cases, HomeComunicadoRequestDTO.class, "tag", "ADMIN", "tag desconhecida");
        add(cases, HomeSolicitacaoMelhoriaRequestDTO.class, "tipo", "melhoria", "tipo fora do contrato");
        textLimits().forEach(limit -> add(cases, limit.type(), limit.field(), "a".repeat(limit.max() + 1), "limite + 1"));
        return cases.stream();
    }

    @ParameterizedTest(name = "limite aceito {0}.{1}")
    @MethodSource("validBoundaries")
    void aceitaValorExatamenteNoLimite(Class<?> type, String field, Object value) throws ReflectiveOperationException {
        assertThat(VALIDATOR.validate(withField(type, field, value))).isEmpty();
    }

    static Stream<Arguments> validBoundaries() {
        List<Arguments> cases = new ArrayList<>();
        textLimits().forEach(limit -> cases.add(Arguments.of(limit.type(), limit.field(), "a".repeat(limit.max()))));
        for (Class<?> type : List.of(FretesGoalConfigRequestDTO.class, FretesGoalReplicarRequestDTO.class,
                ManifestosCostGoalConfigRequestDTO.class, ManifestosGoalReplicarRequestDTO.class)) {
            for (int year : new int[]{2000, 2100}) cases.add(Arguments.of(type, "ano", year));
            for (int month : new int[]{1, 12}) cases.add(Arguments.of(type, "mes", month));
        }
        cases.add(Arguments.of(ApresentacaoSequenciaRequestDTO.class, "paginas", Collections.nCopies(12, "coletas")));
        cases.add(Arguments.of(ApresentacaoSequenciaRequestDTO.class, "paginas", List.of("a".repeat(60))));
        for (String tag : List.of("NOVO", "ATENCAO", "FIXADO")) cases.add(Arguments.of(HomeComunicadoRequestDTO.class, "tag", tag));
        for (String tipo : List.of("MELHORIA", "AUTOMACAO", "DASHBOARD", "CORRECAO", "OUTRO"))
            cases.add(Arguments.of(HomeSolicitacaoMelhoriaRequestDTO.class, "tipo", tipo));
        return cases.stream();
    }

    private record TextLimit(Class<?> type, String field, int max) {}

    private static Stream<TextLimit> textLimits() {
        return Stream.of(
                new TextLimit(ApresentacaoSequenciaRequestDTO.class, "nome", 80),
                new TextLimit(FretesGoalConfigRequestDTO.class, "branchId", 120),
                new TextLimit(ManifestosCostGoalConfigRequestDTO.class, "branchId", 120),
                new TextLimit(ManifestosCostGoalConfigRequestDTO.class, "contractType", 100),
                new TextLimit(ManifestosCostGoalConfigRequestDTO.class, "contractTypeKey", 100),
                new TextLimit(ManifestosCostGoalConfigRequestDTO.class, "classificationKey", 120),
                new TextLimit(HomeComunicadoComentarioRequestDTO.class, "corpo", 700),
                new TextLimit(HomeComunicadoRequestDTO.class, "titulo", 140),
                new TextLimit(HomeComunicadoRequestDTO.class, "corpo", 700),
                new TextLimit(HomeComunicadoRequestDTO.class, "publicoAlvo", 140),
                new TextLimit(HomeSolicitacaoMelhoriaRequestDTO.class, "titulo", 140),
                new TextLimit(HomeSolicitacaoMelhoriaRequestDTO.class, "descricao", 2000),
                new TextLimit(HomeSolicitacaoMelhoriaRequestDTO.class, "resultadoEsperado", 1000),
                new TextLimit(HomeSolicitacaoMelhoriaRequestDTO.class, "localAplicacao", 500),
                new TextLimit(ViagemJustificativaRequestDTO.class, "justificativa", 1000));
    }

    private static void requiredText(List<Arguments> cases, Class<?> type, String... fields) {
        for (String field : fields) {
            add(cases, type, field, null, "nulo");
            add(cases, type, field, "", "vazio");
            add(cases, type, field, " \t\n", "espaços");
        }
    }

    private static void absent(List<Arguments> cases, Class<?> type, String... fields) {
        for (String field : fields) add(cases, type, field, null, "nulo");
    }

    private static void add(List<Arguments> cases, Class<?> type, String field, Object value, String description) {
        cases.add(Arguments.of(type, field, value, description));
    }

    private static Object withField(Class<?> type, String field, Object value) throws ReflectiveOperationException {
        Object baseline = VALID_REQUESTS.stream().filter(type::isInstance).findFirst().orElseThrow();
        RecordComponent[] components = type.getRecordComponents();
        Object[] values = new Object[components.length];
        boolean found = false;
        for (int index = 0; index < components.length; index++) {
            boolean selected = components[index].getName().equals(field);
            found |= selected;
            values[index] = selected ? value : components[index].getAccessor().invoke(baseline);
        }
        assertThat(found).as("campo %s.%s", type.getSimpleName(), field).isTrue();
        return type.getDeclaredConstructor(Arrays.stream(components).map(RecordComponent::getType).toArray(Class<?>[]::new))
                .newInstance(values);
    }
}
