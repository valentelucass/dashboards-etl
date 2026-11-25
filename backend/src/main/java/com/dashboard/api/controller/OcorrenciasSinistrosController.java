package com.dashboard.api.controller;

import com.dashboard.api.dto.sinistros.SinistrosFormularios.*;
import com.dashboard.api.repository.OcorrenciasSinistrosRepository;
import com.dashboard.api.repository.SinistrosEdicaoRepository;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import java.security.Principal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/painel/ocorrencias-e-sinistros")
@PreAuthorize(OcorrenciasSinistrosController.LEITURA)
public class OcorrenciasSinistrosController {
    static final String LEITURA="@acessoSeguranca.podeAcessar('ocorrenciasSinistros')";
    static final String EDICAO=LEITURA+" and @acessoSeguranca.podeAcessar('gerenciarSinistros')";
    private final OcorrenciasSinistrosRepository relatorios;
    private final SinistrosEdicaoRepository edicao;

    public OcorrenciasSinistrosController(OcorrenciasSinistrosRepository relatorios, SinistrosEdicaoRepository edicao) {
        this.relatorios=relatorios;
        this.edicao=edicao;
    }

    @GetMapping("/indicadores")
    public JsonNode indicadores(@RequestParam LocalDate dataInicio,@RequestParam LocalDate dataFim) {
        return relatorios.indicadores(dataInicio,dataFim);
    }

    @GetMapping("/sinistros")
    public JsonNode sinistros(@RequestParam LocalDate dataInicio,@RequestParam LocalDate dataFim,@RequestParam(defaultValue="0") int pagina,
                             @RequestParam(defaultValue="25") int tamanho) {
        return relatorios.relacao(dataInicio,dataFim,pagina,tamanho);
    }

    @PutMapping("/sinistros/{numero}") @PreAuthorize(EDICAO) @ResponseStatus(HttpStatus.NO_CONTENT)
    public void salvar(@PathVariable long numero,@Valid @RequestBody Acompanhamento dados,Principal usuario) {
        edicao.salvarAcompanhamento(numero,dados,usuario.getName());
    }

    @GetMapping("/gestao-global") @PreAuthorize(EDICAO)
    public boolean gestaoGlobal() { return edicao.acessoGlobal(); }

    @GetMapping("/apolices") @PreAuthorize(EDICAO)
    public List<ApoliceCadastrada> apolices() { return edicao.apolices(); }

    @PostMapping("/apolices") @PreAuthorize(EDICAO) @ResponseStatus(HttpStatus.CREATED)
    public void criar(@Valid @RequestBody Apolice dados,Principal usuario) {
        edicao.salvarApolice(null,dados,usuario.getName());
    }

    @PutMapping("/apolices/{id}") @PreAuthorize(EDICAO) @ResponseStatus(HttpStatus.NO_CONTENT)
    public void alterar(@PathVariable int id,@Valid @RequestBody Apolice dados,Principal usuario) {
        edicao.salvarApolice(id,dados,usuario.getName());
    }
}
