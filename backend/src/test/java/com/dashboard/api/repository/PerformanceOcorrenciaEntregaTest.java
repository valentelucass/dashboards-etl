package com.dashboard.api.repository;

import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class PerformanceOcorrenciaEntregaTest {
    @Test void notaSemHistoricoPertenceAMesmaMinutaEAceitaEspacosNoNumero() throws Exception {
        try (var conexao = DriverManager.getConnection("jdbc:h2:mem:notas;MODE=MSSQLServer;NON_KEYWORDS=VALUE");
             var comando = conexao.createStatement()) {
            comando.execute("CREATE SCHEMA dbo");
            comando.execute("CREATE TABLE dbo.dashboard_performance_ocorrencias (minuta bigint, nota_fiscal varchar(50))");
            comando.execute("INSERT INTO dbo.dashboard_performance_ocorrencias VALUES (1, ' 20 '), (1, '20'), (2, '30'), (2, NULL)");
            String sql = """
                    SELECT a.numero_minuta, TRIM(n.value) FROM (VALUES (1), (2)) a(numero_minuta)
                    CROSS JOIN (VALUES ('20'), (' 30 '), ('')) n(value)
                    WHERE TRIM(n.value) <> '' AND %s ORDER BY a.numero_minuta
                    """.formatted(PerformanceOperacaoSql.NOTA_SEM_HISTORICO);
            List<String> semHistorico = new ArrayList<>();
            try (var linhas = comando.executeQuery(sql)) {
                while (linhas.next()) semHistorico.add(linhas.getLong(1) + "/" + linhas.getString(2));
            }
            assertEquals(List.of("1/30", "2/20"), semHistorico);
        }
    }

    @Test void soEventosDeEntregaAoDestinatarioOuRetornoConcluidoBaixamANota() throws Exception {
        String sql = """
                SELECT o.codigo, o.tipo FROM (VALUES
                (1,'Normal'),(65,'Normal'),(136,'Normal'),(140,'Normal'),
                (25,'Normal'),(25,'Redelivery'),(25,'Return'),
                (19,'Normal'),(53,'Normal'),(137,'Normal'),(114,'Normal')
                ) o(codigo,tipo)
                WHERE """ + " " + PerformanceOperacaoSql.entrega("o.tipo") + " ORDER BY o.codigo";
        try (var conexao = DriverManager.getConnection("jdbc:h2:mem:entrega;MODE=MSSQLServer");
             var comando = conexao.createStatement(); var resultado = comando.executeQuery(sql)) {
            List<String> reconhecidas = new ArrayList<>();
            while (resultado.next()) reconhecidas.add(resultado.getInt(1) + " " + resultado.getString(2));
            assertEquals(List.of("1 Normal", "25 Return", "65 Normal", "136 Normal", "140 Normal"), reconhecidas);
        }
    }
}
