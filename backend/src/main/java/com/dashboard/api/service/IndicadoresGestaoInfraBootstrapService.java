package com.dashboard.api.service;

import com.dashboard.api.config.ConsultaAnalitica;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(30)
public class IndicadoresGestaoInfraBootstrapService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(IndicadoresGestaoInfraBootstrapService.class);

    private final JdbcTemplate jdbcTemplate;
    private final boolean failOnSchemaMismatch;

    public IndicadoresGestaoInfraBootstrapService(
            @ConsultaAnalitica JdbcTemplate jdbcTemplate,
            @Value("${dashboard.indicadores.fail-on-schema-mismatch:false}") boolean failOnSchemaMismatch
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.failOnSchemaMismatch = failOnSchemaMismatch;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            auditarCompatibilidadeViews();
        } catch (DataAccessException ex) {
            log.error("Falha ao auditar infraestrutura de Indicadores de Gestão à Vista: {}", ex.getMessage(), ex);
            if (failOnSchemaMismatch) {
                throw ex;
            }
        }
    }

    private void auditarCompatibilidadeViews() {
        List<String> inconsistencias = new ArrayList<>();
        inconsistencias.addAll(auditarObjeto("vw_fretes_powerbi", List.of(
                "ID", "Nº Minuta", "Filial Emissora", "Responsável pela Região de Destino", "Previsão de Entrega",
                "Data de Finalização", "Performance Status", "Comprovante Anexado", "Destino",
                "Pagador Doc", "Peso Cubado", "Total M3", "Data de extracao"
        )));
        inconsistencias.addAll(auditarObjeto("vw_localizacao_cargas_powerbi", List.of(
                "N° Minuta", "Filial Emissora", "Responsável pela Região de Destino", "Data de extracao"
        )));
        inconsistencias.addAll(auditarObjeto("vw_fato_manifestos_dash", List.of(
                "Número", "Status", "Classificação", "Filial Emissora", "Local de Descarregamento",
                "Leitura Móvel/Em", "Itens/Total", "Itens/Finalizados", "Proprietário/Documento",
                "Tipo Motorista", "Data criação", "Data de extracao"
        )));
        inconsistencias.addAll(auditarObjeto("vw_inventario_powerbi", List.of(
                "Identificador Único", "N° Ordem", "Filial", "Filial da Ordem de Conferência",
                "Tipo", "Data/Hora início", "Data/Hora fim", "Data de extracao"
        )));
        inconsistencias.addAll(auditarObjeto("vw_sinistros_powerbi", List.of(
                "Identificador Único", "Nº do Sinistro", "Data abertura", "Minuta", "valor a pagar ao cliente",
                "Resultado final", "Pessoa/Nome fantasia", "Data de extracao"
        )));
        inconsistencias.addAll(auditarObjeto("horarios_corte", List.of(
                "data_operacao", "linha_ou_operacao_original", "linha_ou_operacao_chave", "filial_canonica",
                "sm_gerada", "corte", "nome_arquivo"
        )));
        inconsistencias.addAll(auditarObjeto("vw_horarios_corte_powerbi", List.of(
                "Data", "Filial", "Origem SM", "Destino SM", "Origem Destino", "Origem", "Ordem", "Destino",
                "Horario Corte SM", "Previsao Chegada Destino", "Transit Time", "Saiu no Horário",
                "Atraso Minutos", "Data de extracao"
        )));

        if (!inconsistencias.isEmpty() && failOnSchemaMismatch) {
            throw new IllegalStateException("Auditoria Indicadores de Gestão encontrou incompatibilidades: " + inconsistencias);
        }
    }

    private List<String> auditarObjeto(String nomeObjeto, List<String> colunasEsperadas) {
        List<String> colunasEncontradas = jdbcTemplate.queryForList("""
                SELECT name
                FROM sys.dm_exec_describe_first_result_set(
                    CONCAT(N'SELECT TOP (0) * FROM dbo.', QUOTENAME(?)),
                    NULL,
                    0
                )
                WHERE error_number IS NULL
                  AND is_hidden = 0
                ORDER BY column_ordinal
                """, String.class, nomeObjeto);

        if (colunasEncontradas.isEmpty()) {
            log.warn("Auditoria Indicadores de Gestão: objeto {} não encontrado.", nomeObjeto);
            return List.of("Objeto ausente: " + nomeObjeto);
        }

        List<String> faltantes = colunasFaltantes(colunasEsperadas, colunasEncontradas);

        if (faltantes.isEmpty()) {
            log.info("Auditoria Indicadores de Gestão: {} compatível com colunas esperadas.", nomeObjeto);
            return List.of();
        }

        log.warn("Auditoria Indicadores de Gestão: {} com colunas faltantes: {}", nomeObjeto, faltantes);
        return faltantes.stream()
                .map(coluna -> nomeObjeto + "." + coluna)
                .toList();
    }

    private List<String> colunasFaltantes(List<String> colunasEsperadas, List<String> colunasEncontradas) {
        return colunasEsperadas.stream()
                .filter(coluna -> !colunasEncontradas.contains(coluna))
                .toList();
    }
}
