package com.dashboard.api.repository;

import java.sql.DriverManager;
import java.util.ArrayList;
import java.util.List;
import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class PerformanceOcorrenciaEntregaTest {
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
