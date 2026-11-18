package com.dashboard.api.repository;

import com.dashboard.api.config.ConsultaAnalitica;
import com.dashboard.api.model.VisaoManifestosEntity;
import com.dashboard.api.model.VisaoManifestosId;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@ConsultaAnalitica
public interface VisaoManifestosRepository extends JpaRepository<VisaoManifestosEntity, VisaoManifestosId>,
        JpaSpecificationExecutor<VisaoManifestosEntity> {

    String MANIFESTOS_FILTRADOS_SQL = """
            WITH manifestos AS (
                SELECT
                    TRY_CONVERT(BIGINT, [Número]) AS numero,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Identificador Único]))), '') AS identificador_unico,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status]))), '') AS status,
                    LOWER(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status]))), '')) AS status_normalizado,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Classificação]))), '') AS classificacao,
                    LOWER(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Classificação]))), '')) AS classificacao_normalizada,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '') AS filial,
                    LOWER(
                        NULLIF(
                            CASE
                                WHEN NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '') IS NULL THEN NULL
                                WHEN CHARINDEX(N'-', NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '')) > 0
                                THEN LTRIM(RTRIM(LEFT(
                                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), ''),
                                    CHARINDEX(N'-', NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '')) - 1
                                )))
                                WHEN LEN(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '')) = 3
                                THEN NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Filial]))), '')
                                ELSE NULL
                            END,
                            N''
                        )
                    ) AS filial_key,
                    [Data criação] AS data_criacao,
                    CAST([Data criação] AS date) AS data_criacao_periodo,
                    TRY_CONVERT(datetimeoffset, [Fechamento]) AS fechamento,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(50), [Veículo/Placa]))), '') AS veiculo_placa,
                    LOWER(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(50), [Veículo/Placa]))), '')) AS veiculo_placa_normalizado,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Tipo Veículo]))), '') AS tipo_veiculo,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Motorista]))), '') AS motorista,
                    LOWER(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Motorista]))), '')) AS motorista_normalizado,
                    TRY_CONVERT(DECIMAL(18, 2), [Total peso taxado]) AS total_peso_taxado,
                    TRY_CONVERT(DECIMAL(18, 2), [Total M3]) AS total_m3,
                    TRY_CONVERT(DECIMAL(18, 2), [Custo total]) AS custo_total,
                    TRY_CONVERT(DECIMAL(18, 2), [Valor frete]) AS valor_frete,
                    TRY_CONVERT(DECIMAL(18, 2), [Receita Total Transportada]) AS receita_total_transportada,
                    TRY_CONVERT(DECIMAL(18, 2), [Combustível]) AS combustivel,
                    TRY_CONVERT(DECIMAL(18, 2), [Pedágio]) AS pedagio,
                    TRY_CONVERT(DECIMAL(18, 2), [Saldo a pagar]) AS saldo_pagar,
                    TRY_CONVERT(DECIMAL(18, 2), [KM Total]) AS km_total,
                    TRY_CONVERT(DECIMAL(18, 2), [Capacidade Lotação Kg]) AS capacidade_kg,
                    TRY_CONVERT(DECIMAL(18, 2), [Veículo/Peso Cubado]) AS veiculo_peso_cubado,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Tipo de contrato]))), '') AS tipo_contrato,
                    LOWER(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Tipo de contrato]))), '')) AS tipo_contrato_normalizado,
                    NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Tipo de carga]))), '') AS tipo_carga,
                    LOWER(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Tipo de carga]))), '')) AS tipo_carga_normalizado,
                    TRY_CONVERT(INT, [Itens/Total]) AS itens_total,
                    TRY_CONVERT(INT, [Itens/Finalizados]) AS itens_finalizados,
                    TRY_CONVERT(datetime2, [Data de extracao]) AS data_extracao
                FROM dbo.vw_fato_manifestos_dash
            ),
            filtrados AS (
                SELECT *
                FROM manifestos
                WHERE data_criacao >= :dataInicio
                  AND data_criacao < :dataFimExclusivo
                  AND (:escopoFiliaisVazio = 1 OR filial_key IN (:escopoFiliais))
                  AND (:filiaisVazio = 1 OR filial_key IN (:filiais))
                  AND (:statusVazio = 1 OR status_normalizado IN (:status))
                  AND (:motoristasVazio = 1 OR motorista_normalizado IN (:motoristas))
                  AND (:veiculosVazio = 1 OR veiculo_placa_normalizado IN (:veiculos))
                  AND (:classificacoesVazio = 1 OR classificacao_normalizada IN (:classificacoes))
                  AND (:tiposCargaVazio = 1 OR tipo_carga_normalizado IN (:tiposCarga))
                  AND (:tiposContratoVazio = 1 OR tipo_contrato_normalizado IN (:tiposContrato))
            )
            """;

    @Query(value = MANIFESTOS_FILTRADOS_SQL + """
            SELECT
                MAX(data_extracao) AS updatedAt,
                CAST(COUNT_BIG(1) AS INT) AS totalManifestos,
                CAST(SUM(CASE WHEN status_normalizado IN (N'em trânsito', N'em transito') THEN 1 ELSE 0 END) AS INT) AS emTransito,
                CAST(SUM(CASE WHEN status_normalizado = N'encerrado' THEN 1 ELSE 0 END) AS INT) AS encerrados,
                COALESCE(SUM(km_total), 0) AS kmTotal,
                COALESCE(SUM(custo_total), 0) AS custoTotal,
                COALESCE(AVG(CASE
                    WHEN capacidade_kg > 0 THEN total_peso_taxado * 100 / capacidade_kg
                    ELSE NULL END), 0) AS ocupacaoPesoMediaPct,
                COALESCE(AVG(CASE
                    WHEN veiculo_peso_cubado > 0 THEN total_m3 * 100 / veiculo_peso_cubado
                    ELSE NULL END), 0) AS ocupacaoCubagemMediaPct
            FROM filtrados
            """, nativeQuery = true)
    ManifestosOverviewProjection buscarOverviewAgregado(
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFimExclusivo") LocalDate dataFimExclusivo,
            @Param("escopoFiliais") List<String> escopoFiliais,
            @Param("escopoFiliaisVazio") int escopoFiliaisVazio,
            @Param("filiais") List<String> filiais,
            @Param("filiaisVazio") int filiaisVazio,
            @Param("status") List<String> status,
            @Param("statusVazio") int statusVazio,
            @Param("motoristas") List<String> motoristas,
            @Param("motoristasVazio") int motoristasVazio,
            @Param("veiculos") List<String> veiculos,
            @Param("veiculosVazio") int veiculosVazio,
            @Param("classificacoes") List<String> classificacoes,
            @Param("classificacoesVazio") int classificacoesVazio,
            @Param("tiposCarga") List<String> tiposCarga,
            @Param("tiposCargaVazio") int tiposCargaVazio,
            @Param("tiposContrato") List<String> tiposContrato,
            @Param("tiposContratoVazio") int tiposContratoVazio
    );

    @Query(value = MANIFESTOS_FILTRADOS_SQL + """
            SELECT
                CONVERT(VARCHAR(10), data_criacao_periodo, 23) AS date,
                CAST(SUM(CASE WHEN status_normalizado = N'encerrado' THEN 1 ELSE 0 END) AS INT) AS encerrado,
                CAST(SUM(CASE WHEN status_normalizado IN (N'em trânsito', N'em transito') THEN 1 ELSE 0 END) AS INT) AS emTransito,
                CAST(SUM(CASE
                    WHEN COALESCE(status_normalizado, N'') NOT IN (N'encerrado', N'em trânsito', N'em transito') THEN 1 ELSE 0 END) AS INT) AS pendente
            FROM filtrados
            WHERE data_criacao_periodo IS NOT NULL
            GROUP BY data_criacao_periodo
            ORDER BY data_criacao_periodo
            """, nativeQuery = true)
    List<ManifestosTrendProjection> buscarSerieTemporalAgregada(
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFimExclusivo") LocalDate dataFimExclusivo,
            @Param("escopoFiliais") List<String> escopoFiliais,
            @Param("escopoFiliaisVazio") int escopoFiliaisVazio,
            @Param("filiais") List<String> filiais,
            @Param("filiaisVazio") int filiaisVazio,
            @Param("status") List<String> status,
            @Param("statusVazio") int statusVazio,
            @Param("motoristas") List<String> motoristas,
            @Param("motoristasVazio") int motoristasVazio,
            @Param("veiculos") List<String> veiculos,
            @Param("veiculosVazio") int veiculosVazio,
            @Param("classificacoes") List<String> classificacoes,
            @Param("classificacoesVazio") int classificacoesVazio,
            @Param("tiposCarga") List<String> tiposCarga,
            @Param("tiposCargaVazio") int tiposCargaVazio,
            @Param("tiposContrato") List<String> tiposContrato,
            @Param("tiposContratoVazio") int tiposContratoVazio
    );

    @Query(value = MANIFESTOS_FILTRADOS_SQL + """
            SELECT
                numero,
                identificador_unico AS identificadorUnico,
                status,
                classificacao,
                filial,
                CONVERT(NVARCHAR(48), data_criacao, 127) AS dataCriacao,
                CONVERT(NVARCHAR(48), fechamento, 127) AS fechamento,
                motorista,
                veiculo_placa AS veiculoPlaca,
                tipo_veiculo AS tipoVeiculo,
                COALESCE(total_peso_taxado, 0) AS totalPesoTaxado,
                COALESCE(total_m3, 0) AS totalM3,
                COALESCE(custo_total, 0) AS custoTotal,
                COALESCE(valor_frete, 0) AS valorFrete,
                COALESCE(combustivel, 0) AS combustivel,
                COALESCE(pedagio, 0) AS pedagio,
                COALESCE(saldo_pagar, 0) AS saldoPagar,
                COALESCE(km_total, 0) AS kmTotal,
                COALESCE(receita_total_transportada, 0) AS receitaTotalTransportada,
                COALESCE(capacidade_kg, 0) AS capacidadeKg,
                itens_finalizados AS itensFinalizados,
                itens_total AS itensTotal
            FROM filtrados
            ORDER BY data_criacao DESC
            OFFSET 0 ROWS FETCH NEXT :limite ROWS ONLY
            """, nativeQuery = true)
    List<ManifestoResumoProjection> buscarTabelaPaginada(
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFimExclusivo") LocalDate dataFimExclusivo,
            @Param("escopoFiliais") List<String> escopoFiliais,
            @Param("escopoFiliaisVazio") int escopoFiliaisVazio,
            @Param("filiais") List<String> filiais,
            @Param("filiaisVazio") int filiaisVazio,
            @Param("status") List<String> status,
            @Param("statusVazio") int statusVazio,
            @Param("motoristas") List<String> motoristas,
            @Param("motoristasVazio") int motoristasVazio,
            @Param("veiculos") List<String> veiculos,
            @Param("veiculosVazio") int veiculosVazio,
            @Param("classificacoes") List<String> classificacoes,
            @Param("classificacoesVazio") int classificacoesVazio,
            @Param("tiposCarga") List<String> tiposCarga,
            @Param("tiposCargaVazio") int tiposCargaVazio,
            @Param("tiposContrato") List<String> tiposContrato,
            @Param("tiposContratoVazio") int tiposContratoVazio,
            @Param("limite") int limite
    );

    @Query(value = MANIFESTOS_FILTRADOS_SQL + """
            SELECT
                COALESCE(filial, N'Sem filial') AS filial,
                COALESCE(SUM(custo_total), 0) AS custoTotal
            FROM filtrados
            GROUP BY COALESCE(filial, N'Sem filial')
            ORDER BY custoTotal DESC, filial
            """, nativeQuery = true)
    List<ManifestosCustoFilialProjection> buscarCustoPorFilial(
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFimExclusivo") LocalDate dataFimExclusivo,
            @Param("escopoFiliais") List<String> escopoFiliais,
            @Param("escopoFiliaisVazio") int escopoFiliaisVazio,
            @Param("filiais") List<String> filiais,
            @Param("filiaisVazio") int filiaisVazio,
            @Param("status") List<String> status,
            @Param("statusVazio") int statusVazio,
            @Param("motoristas") List<String> motoristas,
            @Param("motoristasVazio") int motoristasVazio,
            @Param("veiculos") List<String> veiculos,
            @Param("veiculosVazio") int veiculosVazio,
            @Param("classificacoes") List<String> classificacoes,
            @Param("classificacoesVazio") int classificacoesVazio,
            @Param("tiposCarga") List<String> tiposCarga,
            @Param("tiposCargaVazio") int tiposCargaVazio,
            @Param("tiposContrato") List<String> tiposContrato,
            @Param("tiposContratoVazio") int tiposContratoVazio
    );

    @Query(value = MANIFESTOS_FILTRADOS_SQL + """
            SELECT
                COALESCE(motorista, N'Sem motorista') AS motorista,
                CAST(COUNT_BIG(1) AS INT) AS manifestos,
                COALESCE(SUM(km_total), 0) AS km,
                COALESCE(SUM(custo_total), 0) AS custoTotal
            FROM filtrados
            GROUP BY COALESCE(motorista, N'Sem motorista')
            ORDER BY custoTotal DESC, motorista
            OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY
            """, nativeQuery = true)
    List<ManifestosRankingMotoristaProjection> buscarRankingMotorista(
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFimExclusivo") LocalDate dataFimExclusivo,
            @Param("escopoFiliais") List<String> escopoFiliais,
            @Param("escopoFiliaisVazio") int escopoFiliaisVazio,
            @Param("filiais") List<String> filiais,
            @Param("filiaisVazio") int filiaisVazio,
            @Param("status") List<String> status,
            @Param("statusVazio") int statusVazio,
            @Param("motoristas") List<String> motoristas,
            @Param("motoristasVazio") int motoristasVazio,
            @Param("veiculos") List<String> veiculos,
            @Param("veiculosVazio") int veiculosVazio,
            @Param("classificacoes") List<String> classificacoes,
            @Param("classificacoesVazio") int classificacoesVazio,
            @Param("tiposCarga") List<String> tiposCarga,
            @Param("tiposCargaVazio") int tiposCargaVazio,
            @Param("tiposContrato") List<String> tiposContrato,
            @Param("tiposContratoVazio") int tiposContratoVazio
    );

    @Query(value = MANIFESTOS_FILTRADOS_SQL + """
            SELECT categoria, valor
            FROM (
                SELECT
                    COALESCE(SUM(combustivel), 0) AS combustivel,
                    COALESCE(SUM(pedagio), 0) AS pedagio,
                    COALESCE(SUM(saldo_pagar), 0) AS saldo_pagar,
                    COALESCE(SUM(CASE
                        WHEN COALESCE(custo_total, 0)
                           - COALESCE(combustivel, 0)
                           - COALESCE(pedagio, 0)
                           - COALESCE(saldo_pagar, 0) > 0
                        THEN COALESCE(custo_total, 0)
                           - COALESCE(combustivel, 0)
                           - COALESCE(pedagio, 0)
                           - COALESCE(saldo_pagar, 0)
                        ELSE 0 END), 0) AS outros
                FROM filtrados
            ) totais
            CROSS APPLY (VALUES
                (N'Combustivel', combustivel),
                (N'Pedagio', pedagio),
                (N'Saldo a Pagar', saldo_pagar),
                (N'Outros', outros)
            ) composicao(categoria, valor)
            WHERE valor > 0
            ORDER BY categoria
            """, nativeQuery = true)
    List<ManifestosComposicaoProjection> buscarComposicaoCusto(
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFimExclusivo") LocalDate dataFimExclusivo,
            @Param("escopoFiliais") List<String> escopoFiliais,
            @Param("escopoFiliaisVazio") int escopoFiliaisVazio,
            @Param("filiais") List<String> filiais,
            @Param("filiaisVazio") int filiaisVazio,
            @Param("status") List<String> status,
            @Param("statusVazio") int statusVazio,
            @Param("motoristas") List<String> motoristas,
            @Param("motoristasVazio") int motoristasVazio,
            @Param("veiculos") List<String> veiculos,
            @Param("veiculosVazio") int veiculosVazio,
            @Param("classificacoes") List<String> classificacoes,
            @Param("classificacoesVazio") int classificacoesVazio,
            @Param("tiposCarga") List<String> tiposCarga,
            @Param("tiposCargaVazio") int tiposCargaVazio,
            @Param("tiposContrato") List<String> tiposContrato,
            @Param("tiposContratoVazio") int tiposContratoVazio
    );

    @Query(value = MANIFESTOS_FILTRADOS_SQL + """
            SELECT
                COALESCE(total_peso_taxado, 0) AS pesoTaxado,
                COALESCE(total_m3, 0) AS totalM3,
                COALESCE(custo_total, 0) AS custoTotal
            FROM filtrados
            ORDER BY data_criacao DESC
            OFFSET 0 ROWS FETCH NEXT 80 ROWS ONLY
            """, nativeQuery = true)
    List<ManifestosOcupacaoProjection> buscarOcupacaoScatter(
            @Param("dataInicio") LocalDate dataInicio,
            @Param("dataFimExclusivo") LocalDate dataFimExclusivo,
            @Param("escopoFiliais") List<String> escopoFiliais,
            @Param("escopoFiliaisVazio") int escopoFiliaisVazio,
            @Param("filiais") List<String> filiais,
            @Param("filiaisVazio") int filiaisVazio,
            @Param("status") List<String> status,
            @Param("statusVazio") int statusVazio,
            @Param("motoristas") List<String> motoristas,
            @Param("motoristasVazio") int motoristasVazio,
            @Param("veiculos") List<String> veiculos,
            @Param("veiculosVazio") int veiculosVazio,
            @Param("classificacoes") List<String> classificacoes,
            @Param("classificacoesVazio") int classificacoesVazio,
            @Param("tiposCarga") List<String> tiposCarga,
            @Param("tiposCargaVazio") int tiposCargaVazio,
            @Param("tiposContrato") List<String> tiposContrato,
            @Param("tiposContratoVazio") int tiposContratoVazio
    );

    interface ManifestosOverviewProjection {
        LocalDateTime getUpdatedAt();

        int getTotalManifestos();

        int getEmTransito();

        int getEncerrados();

        BigDecimal getKmTotal();

        BigDecimal getCustoTotal();

        BigDecimal getOcupacaoPesoMediaPct();

        BigDecimal getOcupacaoCubagemMediaPct();
    }

    interface ManifestosTrendProjection {
        String getDate();

        int getEncerrado();

        int getEmTransito();

        int getPendente();
    }

    interface ManifestoResumoProjection {
        Long getNumero();

        String getIdentificadorUnico();

        String getStatus();

        String getClassificacao();

        String getFilial();

        String getDataCriacao();

        String getFechamento();

        String getMotorista();

        String getVeiculoPlaca();

        String getTipoVeiculo();

        BigDecimal getTotalPesoTaxado();

        BigDecimal getTotalM3();

        BigDecimal getCustoTotal();

        BigDecimal getValorFrete();

        BigDecimal getCombustivel();

        BigDecimal getPedagio();

        BigDecimal getSaldoPagar();

        BigDecimal getKmTotal();

        BigDecimal getReceitaTotalTransportada();

        BigDecimal getCapacidadeKg();

        Integer getItensFinalizados();

        Integer getItensTotal();
    }

    interface ManifestosCustoFilialProjection {
        String getFilial();

        BigDecimal getCustoTotal();
    }

    interface ManifestosRankingMotoristaProjection {
        String getMotorista();

        int getManifestos();

        BigDecimal getKm();

        BigDecimal getCustoTotal();
    }

    interface ManifestosComposicaoProjection {
        String getCategoria();

        BigDecimal getValor();
    }

    interface ManifestosOcupacaoProjection {
        BigDecimal getPesoTaxado();

        BigDecimal getTotalM3();

        BigDecimal getCustoTotal();
    }
}
