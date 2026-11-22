package com.dashboard.api.util;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.Map;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import static org.junit.jupiter.api.Assertions.*;

class CustomerServiceCarteiraExcelTest {
    private final CustomerServiceCarteiraExcel leitor = new CustomerServiceCarteiraExcel();

    @Test void aceitaMascaraAlfanumericoColunasExtrasEZeroInicialNumerico() throws Exception {
        var dados = arquivo(new Object[][]{
                {"Telefone", "CNPJ", "Key Account"}, {"ignorar", 101010000113L, " Alfa "},
                {"ignorar", "12.abc.345/01de-35", "alfa"}
        });
        assertEquals(Map.of("00101010000113", "ALFA", "12ABC34501DE35", "ALFA"), leitor.ler(dados));
    }

    @Test void importacaoInteiraFalhaSeUmCnpjForInvalidoOuDuplicado() throws Exception {
        for (Object[] invalida : new Object[][]{
                {"Grupo B", "12ABC34501DE34"}, {"Grupo B","12.345.678/0001-95"},
                {"","12ABC34501DE35"}, {"Grupo B","00000000000000"},
                {"Grupo B", 15.3}, {"Grupo B", "CNPJ 12ABC34501DE35"}, {"Grupo B", ""}
        }) {
            var dados = arquivo(new Object[][]{
                    {"KEY ACCOUNT","CNPJ"},{"Grupo A","12345678000195"}, invalida
            });
            var erro = assertThrows(IllegalArgumentException.class, () -> leitor.ler(dados));
            assertTrue(erro.getMessage().contains("Linha 3"));
        }
    }

    @Test void recusaFormulaColunasAusentesOuRepetidasModeloVazioEOutrosFormatos() throws Exception {
        var formula = arquivo(new Object[][]{{"KEY ACCOUNT","CNPJ"},{"Grupo","=A1"}});
        assertThrows(IllegalArgumentException.class, () -> leitor.ler(formula));
        for (Object[] header : new Object[][]{{"KEY ACCOUNT","documento"},{"CNPJ","CNPJ","KEY ACCOUNT"}}) {
            var dados = arquivo(new Object[][]{header, {"Grupo","12ABC34501DE35"}});
            assertThrows(IllegalArgumentException.class, () -> leitor.ler(dados));
        }
        byte[] bytes = leitor.modelo();
        try (var wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            assertEquals("KEY ACCOUNT", wb.getSheetAt(0).getRow(0).getCell(0).getStringCellValue());
            assertEquals("CNPJ", wb.getSheetAt(0).getRow(0).getCell(1).getStringCellValue());
        }
        assertThrows(IllegalArgumentException.class, () -> leitor.ler(upload(bytes)));
        assertThrows(IllegalArgumentException.class, () -> leitor.ler(upload(new byte[]{1,2,3})));
        assertThrows(IllegalArgumentException.class, () -> leitor.ler(upload(new byte[5 * 1024 * 1024 + 1])));
    }

    @Test void rejeitaSegundaAbaComDadosParaEvitarSubstituicaoParcial() throws Exception {
        try (var wb = new XSSFWorkbook(new ByteArrayInputStream(leitor.modelo()));
                var out = new ByteArrayOutputStream()) {
            wb.createSheet("Outro grupo").createRow(0).createCell(0).setCellValue("CNPJ");
            wb.write(out);
            assertThrows(IllegalArgumentException.class, () -> leitor.ler(upload(out.toByteArray())));
        }
    }

    private static MockMultipartFile arquivo(Object[][] dados) throws Exception {
        try (var wb = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
            var aba = wb.createSheet("Carteira");
            for (int i = 0; i < dados.length; i++) {
                var linha = aba.createRow(i);
                for (int j = 0; j < dados[i].length; j++) {
                    var celula = linha.createCell(j);
                    var valor = dados[i][j];
                    if (valor instanceof Number n) celula.setCellValue(n.doubleValue());
                    else if (valor.toString().startsWith("=")) celula.setCellFormula(valor.toString().substring(1));
                    else celula.setCellValue(valor.toString());
                }
            }
            wb.write(out);
            return upload(out.toByteArray());
        }
    }

    private static MockMultipartFile upload(byte[] bytes) {
        return new MockMultipartFile("arquivo", "carteira.xlsx", "application/octet-stream", bytes);
    }
}
