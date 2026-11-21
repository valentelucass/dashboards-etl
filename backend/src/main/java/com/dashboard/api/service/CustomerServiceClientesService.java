package com.dashboard.api.service;

import com.dashboard.api.dto.customerservice.CustomerServiceContaDTO;
import com.dashboard.api.dto.customerservice.CustomerServiceContaDTO.Opcao;
import com.dashboard.api.service.acesso.EscopoFilialService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CustomerServiceClientesService {
    private final JdbcTemplate jdbc;
    private final EscopoFilialService escopo;

    public CustomerServiceClientesService(JdbcTemplate jdbc, EscopoFilialService escopo) {
        this.jdbc = jdbc;
        this.escopo = escopo;
    }

    public List<Opcao> listar() {
        if (!temEscopo()) return List.of();
        return jdbc.query("""
                SELECT c.id, c.nome
                FROM acesso.customer_service_contas c
                WHERE c.ativa = 1 AND EXISTS (
                    SELECT 1 FROM acesso.customer_service_documentos d WHERE d.conta_id = c.id
                )
                ORDER BY c.nome, c.id
                """, (rs, row) -> new Opcao(rs.getLong("id"), rs.getString("nome")));
    }

    public CustomerServiceContaDTO exigirCliente(List<Long> ids) {
        if (ids == null || ids.size() != 1 || ids.get(0) == null || ids.get(0) < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecione um único cliente.");
        }
        if (!temEscopo()) throw clienteIndisponivel();
        long id = ids.get(0);
        return jdbc.query("""
                SELECT c.nome, d.documento
                FROM acesso.customer_service_contas c
                JOIN acesso.customer_service_documentos d ON d.conta_id = c.id
                WHERE c.ativa = 1 AND c.id = ?
                ORDER BY d.documento
                """, rs -> {
                    if (!rs.next()) throw clienteIndisponivel();
                    String nome = rs.getString("nome");
                    var documentos = new java.util.ArrayList<String>();
                    do {
                        documentos.add(rs.getString("documento"));
                    } while (rs.next());
                    return new CustomerServiceContaDTO(id, nome, documentos);
                }, id);
    }

    private boolean temEscopo() {
        var autorizacao = escopo.escopoAtual();
        return autorizacao.acessoTotal() || !autorizacao.filiaisOrdenadas().isEmpty();
    }

    private static ResponseStatusException clienteIndisponivel() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Cliente indisponível para apresentação.");
    }
}
