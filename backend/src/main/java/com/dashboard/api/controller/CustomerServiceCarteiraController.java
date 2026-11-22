package com.dashboard.api.controller;

import com.dashboard.api.dto.customerservice.CustomerServiceCarteiraDTO;
import com.dashboard.api.service.CustomerServiceCarteiraService;
import com.dashboard.api.util.CustomerServiceCarteiraExcel;
import java.security.Principal;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/customer-service/carteira")
@PreAuthorize("@acessoSeguranca.ehAdminPlataformaOuDesenvolvedor() && @acessoSeguranca.podeAcessar('customerService')")
public class CustomerServiceCarteiraController {
    private final CustomerServiceCarteiraExcel excel;
    private final CustomerServiceCarteiraService service;

    public CustomerServiceCarteiraController(CustomerServiceCarteiraExcel excel, CustomerServiceCarteiraService service) {
        this.excel = excel;
        this.service = service;
    }

    @GetMapping("/modelo")
    public ResponseEntity<byte[]> modelo() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("customer-service-carteira.xlsx").build().toString())
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(excel.modelo());
    }

    @PostMapping(path = "/previa", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CustomerServiceCarteiraDTO previa(@RequestPart("arquivo") MultipartFile arquivo,
            @RequestParam("competencia") String competencia) {
        return service.previa(excel.ler(arquivo), competencia);
    }

    @PostMapping(path = "/aplicar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CustomerServiceCarteiraDTO aplicar(@RequestPart("arquivo") MultipartFile arquivo,
            @RequestParam("competencia") String competencia, @RequestParam("versaoAtual") long versao,
            @RequestParam("hashCarteira") String hash, Principal responsavel) {
        return service.aplicar(excel.ler(arquivo), competencia, versao, hash, responsavel.getName());
    }
}
