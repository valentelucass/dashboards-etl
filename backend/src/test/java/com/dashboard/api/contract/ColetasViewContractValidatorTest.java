package com.dashboard.api.contract;
import com.dashboard.api.model.VisaoColetasEntity;
import jakarta.persistence.Column;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.Mock;
import org.springframework.jdbc.core.JdbcOperations;
import org.springframework.jdbc.core.ResultSetExtractor;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ColetasViewContractValidatorTest {

    @Mock
    private JdbcOperations jdbcTemplate;

    private static List<String> colunasConsumidas() {
        return Arrays.stream(VisaoColetasEntity.class.getDeclaredFields())
                .filter(campo -> campo.isAnnotationPresent(Column.class))
                .map(campo -> campo.getAnnotation(Column.class).name().replace("[", "").replace("]", ""))
                .toList();
    }

    private static Stream<String> colunaObrigatoria() {
        return colunasConsumidas().stream();
    }

    private void publicarColunas(List<String> colunas) {
        when(jdbcTemplate.queryForList(anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn(colunas);
    }

    private List<Map<String, Object>> tiposConsumidos() {
        return Arrays.stream(VisaoColetasEntity.class.getDeclaredFields())
                .filter(campo -> campo.isAnnotationPresent(Column.class))
                .map(campo -> {
                    String tipo = switch (campo.getType().getSimpleName()) {
                        case "Long" -> "bigint";
                        case "Integer" -> "int";
                        case "BigDecimal" -> "decimal(28,8)";
                        case "LocalDate" -> "date";
                        case "LocalDateTime" -> "datetime2(7)";
                        case "Boolean" -> "bit";
                        case "String" -> "nvarchar(255)";
                        default -> throw new IllegalArgumentException("Tipo do consumidor sem caso de teste");
                    };
                    return Map.<String, Object>of("coluna",
                            campo.getAnnotation(Column.class).name().replace("[", "").replace("]", ""),
                            "tipo", tipo);
                }).toList();
    }

    private void publicarTipos() {
        when(jdbcTemplate.queryForList(anyString())).thenReturn(tiposConsumidos());
    }

    @Test
    @SuppressWarnings("unchecked")
    void validarSolicitacaoNativaAceitaTipoDate() {
        publicarColunas(colunasConsumidas());
        publicarTipos();
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class))).thenReturn("date", "nvarchar(100)", "bit");

        ColetasViewContractValidator validator = new ColetasViewContractValidator(jdbcTemplate);

        assertThatCode(validator::validarSolicitacaoNativa).doesNotThrowAnyException();
    }

    @Test
    @SuppressWarnings("unchecked")
    void validarSolicitacaoNativaRejeitaTexto() {
        publicarColunas(colunasConsumidas());
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class))).thenReturn("nvarchar");

        ColetasViewContractValidator validator = new ColetasViewContractValidator(jdbcTemplate);

        assertThatThrownBy(validator::validarSolicitacaoNativa)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("vw_coletas_powerbi.[Solicitacao]")
                .hasMessageContaining("tipo de data nativo")
                .hasMessageContaining("nvarchar");
    }

    @Test
    @SuppressWarnings("unchecked")
    void validarSolicitacaoNativaRejeitaFlagDeExclusaoComTipoInvalido() {
        publicarColunas(colunasConsumidas());
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class))).thenReturn("date", "nvarchar(100)", "int");

        ColetasViewContractValidator validator = new ColetasViewContractValidator(jdbcTemplate);

        assertThatThrownBy(validator::validarSolicitacaoNativa)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("vw_coletas_powerbi.[Excluída na Origem]")
                .hasMessageContaining("deve ser bit")
                .hasMessageContaining("int");
    }

    @ParameterizedTest
    @MethodSource("colunaObrigatoria")
    void informaCadaColunaConsumidaQueEstiverAusente(String ausente) {
        publicarColunas(colunasConsumidas().stream().filter(coluna -> !coluna.equals(ausente)).toList());

        assertThatThrownBy(new ColetasViewContractValidator(jdbcTemplate)::validarSolicitacaoNativa)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Dados de Coletas incompletos")
                .hasMessageContaining(ausente);
    }

    @Test
    @SuppressWarnings("unchecked")
    void permiteColunasAdicionaisEReutilizaSomenteContratoCompleto() {
        List<String> publicadas = new ArrayList<>(colunasConsumidas());
        publicadas.add("Informação adicional da API");
        publicarColunas(publicadas);
        publicarTipos();
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class))).thenReturn("date", "nvarchar(100)", "bit");
        ColetasViewContractValidator validator = new ColetasViewContractValidator(jdbcTemplate);

        assertThatCode(() -> {
            validator.validarSolicitacaoNativa();
            validator.validarSolicitacaoNativa();
        }).doesNotThrowAnyException();
        verify(jdbcTemplate, times(1)).queryForList(anyString(), org.mockito.ArgumentMatchers.eq(String.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void listaTodasAsAusenciasESomenteAceitaAposPublicacaoCompleta() {
        when(jdbcTemplate.queryForList(anyString(), org.mockito.ArgumentMatchers.eq(String.class)))
                .thenReturn(colunasConsumidas().stream()
                        .filter(coluna -> !List.of("Volumes", "Peso Taxado").contains(coluna)).toList(),
                        colunasConsumidas());
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class))).thenReturn("date", "nvarchar(100)", "bit");
        publicarTipos();
        ColetasViewContractValidator validator = new ColetasViewContractValidator(jdbcTemplate);

        assertThatThrownBy(validator::validarSolicitacaoNativa)
                .hasMessageContaining("Volumes, Peso Taxado");
        assertThatCode(validator::validarSolicitacaoNativa).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @MethodSource("colunaObrigatoria")
    @SuppressWarnings("unchecked")
    void rejeitaTipoIncompativelEmCadaColunaConsumida(String coluna) {
        publicarColunas(colunasConsumidas());
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class)))
                .thenReturn("date", "nvarchar(100)", "bit");
        when(jdbcTemplate.queryForList(anyString())).thenReturn(tiposConsumidos().stream()
                .map(campo -> coluna.equals(campo.get("coluna"))
                        ? Map.<String, Object>of("coluna", coluna, "tipo", "varbinary(max)") : campo)
                .toList());

        assertThatThrownBy(new ColetasViewContractValidator(jdbcTemplate)::validarSolicitacaoNativa)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("tipos incompatíveis")
                .hasMessageContaining(coluna);
    }

    @Test
    @SuppressWarnings("unchecked")
    void rejeitaPesoEmPontoFlutuanteEVolumeQuePodeUltrapassarInteger() {
        publicarColunas(colunasConsumidas());
        when(jdbcTemplate.query(anyString(), any(ResultSetExtractor.class)))
                .thenReturn("date", "nvarchar(100)", "bit", "date", "nvarchar(100)", "bit");
        List<Map<String, Object>> invalidos = tiposConsumidos().stream()
                .map(campo -> "Peso Real".equals(campo.get("coluna"))
                        ? Map.<String, Object>of("coluna", "Peso Real", "tipo", "float")
                        : "Volumes".equals(campo.get("coluna"))
                        ? Map.<String, Object>of("coluna", "Volumes", "tipo", "bigint") : campo)
                .toList();
        when(jdbcTemplate.queryForList(anyString())).thenReturn(invalidos, tiposConsumidos());
        ColetasViewContractValidator validator = new ColetasViewContractValidator(jdbcTemplate);

        assertThatThrownBy(validator::validarSolicitacaoNativa)
                .hasMessageContaining("Volumes, Peso Real");
        assertThatCode(validator::validarSolicitacaoNativa).doesNotThrowAnyException();
    }
}
