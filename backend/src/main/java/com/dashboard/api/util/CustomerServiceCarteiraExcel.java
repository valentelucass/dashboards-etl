package com.dashboard.api.util;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.Collections;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.zip.ZipInputStream;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.DateUtil;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class CustomerServiceCarteiraExcel {
    private static final int MIB = 1024 * 1024;
    private static final int MAX_ARQUIVO = 5 * MIB;
    private static final int MAX_DESCOMPACTADO = 20 * MIB;
    private static final int MAX_LINHAS = 20000;

    /** Chave por CNPJ completo; a ordem do arquivo não altera a impressão digital. */
    public Map<String, String> ler(MultipartFile arquivo) {
        if (arquivo == null || arquivo.isEmpty() || arquivo.getSize() > MAX_ARQUIVO) {
            throw new IllegalArgumentException("Envie uma planilha Excel .xlsx de até 5 MB.");
        }
        UploadFileTypeValidator.validarAssinatura(arquivo, Set.of(UploadFileTypeValidator.FileType.XLSX),
                "Use o formato Excel .xlsx.");
        try {
            verificarTamanhoExpandido(arquivo);
            try (var entrada = arquivo.getInputStream(); var livro = new XSSFWorkbook(entrada)) {
                Sheet dados = null;
                for (Sheet aba : livro) {
                    if (!aba.iterator().hasNext()) continue;
                    if (dados != null) throw new IllegalArgumentException("Reúna a carteira inteira em uma única aba.");
                    dados = aba;
                }
                if (dados == null) throw new IllegalArgumentException("Planilha vazia.");
                return lerAba(dados);
            }
        } catch (IllegalArgumentException ex) {
            // Mensagens de bibliotecas de planilha não devem expor o conteúdo das células.
            if (ex instanceof ErroCarteira) throw ex;
            throw new IllegalArgumentException("Planilha inválida. Use o modelo .xlsx e uma única aba de dados.");
        } catch (IOException | RuntimeException ex) {
            throw new IllegalArgumentException("Não foi possível ler a planilha .xlsx.");
        }
    }

    private static void verificarTamanhoExpandido(MultipartFile arquivo) throws IOException {
        int arquivos = 0;
        long total = 0;
        byte[] buffer = new byte[8192];
        try (var zip = new ZipInputStream(arquivo.getInputStream())) {
            while (zip.getNextEntry() != null) {
                if (++arquivos > 256) throw erro("A planilha excedeu o limite de componentes.");
                int lidos;
                while ((lidos = zip.read(buffer)) >= 0) {
                    total += lidos;
                    if (total > MAX_DESCOMPACTADO) throw erro("A planilha excedeu o limite de conteúdo.");
                }
            }
        }
    }

    private static Map<String, String> lerAba(Sheet aba) {
        var linhas = aba.iterator();
        Row cabecalho = null;
        while (linhas.hasNext() && cabecalho == null) {
            Row linha = linhas.next();
            if (!vazia(linha)) cabecalho = linha;
        }
        if (cabecalho == null) throw erro("Planilha sem cabeçalho.");
        int colGrupo = coluna(cabecalho, "KEY ACCOUNT");
        int colDocumento = coluna(cabecalho, "CNPJ");
        var documentos = new TreeMap<String, String>();
        while (linhas.hasNext()) {
            Row linha = linhas.next();
            if (vazia(linha)) continue;
            int numero = linha.getRowNum() + 1;
            if (documentos.size() >= MAX_LINHAS) throw erro("A planilha excede 20.000 vínculos.");
            Cell grupoCell = linha.getCell(colGrupo);
            if (grupoCell == null || grupoCell.getCellType() != CellType.STRING) {
                throw erroLinha(numero, "informe o nome do Key Account.");
            }
            String grupo = Normalizer.normalize(grupoCell.getStringCellValue().strip(), Normalizer.Form.NFC)
                    .toUpperCase(Locale.ROOT);
            if (grupo.isBlank() || grupo.length() > 200 || grupo.chars().anyMatch(Character::isISOControl)) {
                throw erroLinha(numero, "nome do Key Account inválido.");
            }
            String cnpj = documento(linha.getCell(colDocumento), numero);
            if (documentos.putIfAbsent(cnpj, grupo) != null) {
                throw erroLinha(numero, "CNPJ repetido. Cada CNPJ deve aparecer uma única vez.");
            }
        }
        if (documentos.isEmpty()) throw erro("A planilha precisa ter pelo menos um CNPJ.");
        return Collections.unmodifiableMap(documentos);
    }

    private static boolean vazia(Row linha) {
        for (Cell celula : linha) {
            if (celula.getCellType() == CellType.BLANK) continue;
            if (celula.getCellType() != CellType.STRING || !celula.getStringCellValue().isBlank()) return false;
        }
        return true;
    }

    private static int coluna(Row cabecalho, String nome) {
        int coluna = -1;
        for (Cell celula : cabecalho) {
            if (celula.getCellType() != CellType.STRING ||
                    !nome.equalsIgnoreCase(celula.getStringCellValue().strip())) continue;
            if (coluna >= 0) throw erro("Cabeçalho repetido: " + nome + ".");
            coluna = celula.getColumnIndex();
        }
        if (coluna < 0) throw erro("Coluna obrigatória ausente: " + nome + ".");
        return coluna;
    }

    private static String documento(Cell celula, int linha) {
        String cnpj = "";
        if (celula != null && celula.getCellType() == CellType.STRING) {
            cnpj = celula.getStringCellValue().strip().toUpperCase(Locale.ROOT);
            if (cnpj.matches("[A-Z0-9]{2}\\.[A-Z0-9]{3}\\.[A-Z0-9]{3}/[A-Z0-9]{4}-[0-9]{2}")) {
                cnpj = cnpj.replace(".", "").replace("/", "").replace("-", "");
            }
        } else if (celula != null && celula.getCellType() == CellType.NUMERIC && !DateUtil.isCellDateFormatted(celula)) {
            double valor = celula.getNumericCellValue();
            if (valor >= 0 && valor < 100_000_000_000_000d && valor == Math.rint(valor)) {
                String numero = BigDecimal.valueOf(valor).toBigInteger().toString();
                cnpj = "0".repeat(14 - numero.length()) + numero;
            }
        }
        if (!cnpj.matches("[0-9A-Z]{12}[0-9]{2}") || cnpj.chars().distinct().count() == 1
                || !digitoValido(cnpj, 12) || !digitoValido(cnpj, 13)) {
            throw erroLinha(linha, "CNPJ inválido. Confira o número completo e os dígitos verificadores.");
        }
        return cnpj;
    }

    private static boolean digitoValido(String cnpj, int posicao) {
        int soma = 0;
        for (int i = 0; i < posicao; i++) {
            soma += (cnpj.charAt(i) - '0') * (2 + (posicao - 1 - i) % 8);
        }
        int resto = soma % 11;
        return cnpj.charAt(posicao) - '0' == (resto < 2 ? 0 : 11 - resto);
    }

    public byte[] modelo() {
        try (var livro = new XSSFWorkbook(); var saida = new ByteArrayOutputStream()) {
            var aba = livro.createSheet("Carteira");
            var cabecalho = aba.createRow(0);
            cabecalho.createCell(0).setCellValue("KEY ACCOUNT");
            cabecalho.createCell(1).setCellValue("CNPJ");
            var texto = livro.createCellStyle();
            texto.setDataFormat(livro.createDataFormat().getFormat("@"));
            aba.setDefaultColumnStyle(1, texto);
            aba.setColumnWidth(0, 32 * 256);
            aba.setColumnWidth(1, 24 * 256);
            livro.write(saida);
            return saida.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Falha ao gerar o modelo.", ex);
        }
    }

    private static ErroCarteira erroLinha(int linha, String motivo) {
        return erro("Linha " + linha + ": " + motivo);
    }

    private static ErroCarteira erro(String motivo) {
        return new ErroCarteira(motivo);
    }

    private static final class ErroCarteira extends IllegalArgumentException {
        ErroCarteira(String motivo) {
            super(motivo);
        }
    }
}
