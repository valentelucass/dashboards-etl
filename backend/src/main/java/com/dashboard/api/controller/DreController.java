package com.dashboard.api.controller;

import com.dashboard.api.repository.DreReceitaRepository;
import com.dashboard.api.repository.DrePagarRepository;
import com.dashboard.api.repository.DreTransporteRepository;
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
    private final DrePagarRepository pagar;
    private final DreTransporteRepository transporte;

    public DreController(DreReceitaRepository receitas, DrePagarRepository pagar, DreTransporteRepository transporte) {
        this.receitas = receitas;
        this.pagar = pagar;
        this.transporte = transporte;
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

    @GetMapping("/contas-a-pagar/dimensoes")
    public List<DrePagarRepository.Opcao> dimensoesPagar(@RequestParam String competencia, @RequestParam(required=false) String empresa,
            @RequestParam(required=false) String filial, @RequestParam(required=false) String centro) {
        return pagar.dimensoes(new Filtro(mes(competencia), empresa, filial, centro));
    }

    @GetMapping("/contas-a-pagar/resumo")
    public DrePagarRepository.Resumo resumoPagar(@RequestParam String competencia, @RequestParam(required=false) String empresa,
            @RequestParam(required=false) String filial, @RequestParam(required=false) String centro,
            @RequestParam(required=false) String fornecedor, @RequestParam(required=false) String conta) {
        return pagar.resumo(new Filtro(mes(competencia), empresa, filial, centro), fornecedor, conta);
    }

    @GetMapping("/contas-a-pagar/lancamentos")
    public DrePagarRepository.Pagina lancamentos(@RequestParam String competencia, @RequestParam(required=false) String empresa,
            @RequestParam(required=false) String filial, @RequestParam(required=false) String centro,
            @RequestParam(required=false) String fornecedor, @RequestParam(required=false) String conta,
            @RequestParam(defaultValue="false") boolean acumulado, @RequestParam(defaultValue="0") int pagina) {
        if (pagina < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Página inválida");
        return pagar.lancamentos(new Filtro(mes(competencia), empresa, filial, centro), fornecedor, conta, acumulado, pagina);
    }

    @GetMapping("/transporte/resumo")
    public List<DreTransporteRepository.Valor> custosTransporte(@RequestParam String competencia, @RequestParam(required=false) String empresa,
            @RequestParam(required=false) String filial, @RequestParam(required=false) String centro,
            @RequestParam(required=false) String fornecedor, @RequestParam(required=false) String conta) {
        var filtro = new Filtro(mes(competencia),empresa,filial,centro);
        if ((fornecedor != null && !fornecedor.isBlank()) || (conta != null && !conta.isBlank())) return List.of();
        return transporte.resumo(filtro);
    }

    @GetMapping("/transporte/lancamentos")
    public DreTransporteRepository.Pagina documentos(@RequestParam String competencia, @RequestParam String linha,
            @RequestParam(required=false) String empresa, @RequestParam(required=false) String filial, @RequestParam(required=false) String centro,
            @RequestParam(required=false) String fornecedor, @RequestParam(required=false) String conta,
            @RequestParam(defaultValue="false") boolean acumulado, @RequestParam(defaultValue="0") int pagina) {
        var filtro = new Filtro(mes(competencia),empresa,filial,centro);
        if (pagina < 0 || !List.of("D33","D34","D35").contains(linha)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Conta ou página inválida");
        if ((fornecedor != null && !fornecedor.isBlank()) || (conta != null && !conta.isBlank())) return new DreTransporteRepository.Pagina(List.of(),false);
        return transporte.lancamentos(filtro,linha,acumulado,pagina);
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
