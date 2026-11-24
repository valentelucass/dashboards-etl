package com.dashboard.api.controller;

import com.dashboard.api.repository.DreReceitaRepository;
import com.dashboard.api.repository.DreReceitaRepository.*;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/painel/dre")
@PreAuthorize("@acessoSeguranca.podeAcessar('dre')")
public class DreController {
    private final DreReceitaRepository receitas;

    public DreController(DreReceitaRepository receitas) {
        this.receitas = receitas;
    }

    @GetMapping("/dimensoes")
    public List<Dimensao> dimensoes(@RequestParam String competencia) {
        return receitas.dimensoes(mes(competencia));
    }

    @GetMapping("/resumo")
    public Resumo resumo(@RequestParam String competencia, @RequestParam(required=false) String empresa,
                         @RequestParam(required=false) String filial, @RequestParam(required=false) String centro) {
        return receitas.resumo(new Filtro(mes(competencia), empresa, filial, centro));
    }

    @GetMapping("/fretes")
    public Pagina fretes(@RequestParam String competencia, @RequestParam(required=false) String empresa,
                         @RequestParam(required=false) String filial, @RequestParam(required=false) String centro,
                         @RequestParam(required=false) String classe, @RequestParam(required=false) String tipo,
                         @RequestParam(defaultValue="false") boolean acumulado, @RequestParam(defaultValue="0") int pagina) {
        if (pagina < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Página inválida");
        return receitas.fretes(new Filtro(mes(competencia), empresa, filial, centro), classe, tipo, acumulado, pagina);
    }

    static YearMonth mes(String valor) {
        try {
            YearMonth mes = YearMonth.parse(valor);
            if (mes.getYear() >= 1900 && mes.getYear() <= 9998) return mes;
        } catch (DateTimeParseException ignored) {
            // A mesma mensagem atende tanto o formato quanto os limites do calendário.
        }
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Competência inválida");
    }
}
