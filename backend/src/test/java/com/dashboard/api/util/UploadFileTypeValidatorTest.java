package com.dashboard.api.util;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;
import static com.dashboard.api.util.UploadFileTypeValidator.FileType.*;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class UploadFileTypeValidatorTest {
    @ParameterizedTest
    @ValueSource(strings = {"%PDF-1.7", "MZexecutavel", "GIF89A", "\u0089PNG", "campo\u0000binario", "\u0001controle"})
    void rejeitaBinarioDisfarcadoDeCsv(String content) {
        var file = new MockMultipartFile("arquivo", "dados.csv", "text/csv", content.getBytes(StandardCharsets.ISO_8859_1));
        assertThatThrownBy(() -> UploadFileTypeValidator.validarAssinatura(file, UploadFileTypeValidator.tipos(CSV), "inválido"))
                .isInstanceOf(IllegalArgumentException.class).hasMessage("inválido");
    }

    @ParameterizedTest
    @ValueSource(strings = {"nome;cidade\r\nJoão;São Paulo", "\ufeffnome,valor\nA,10", "coluna\tvalor\nA\t1"})
    void aceitaTextoUtf8ComSeparadoresEQuebrasPermitidas(String content) {
        var file = new MockMultipartFile("arquivo", "dados.csv", "application/octet-stream", content.getBytes(StandardCharsets.UTF_8));
        assertThatCode(() -> UploadFileTypeValidator.validarAssinatura(file, UploadFileTypeValidator.tipos(CSV), "inválido"))
                .doesNotThrowAnyException();
    }

    @ParameterizedTest
    @MethodSource("spreadsheetHeaders")
    void assinaturaDePlanilhaExigeTipoPermitido(byte[] bytes, UploadFileTypeValidator.FileType type) {
        var file = new MockMultipartFile("arquivo", "arquivo.csv", "text/csv", bytes);
        assertThatCode(() -> UploadFileTypeValidator.validarAssinatura(file, UploadFileTypeValidator.tipos(type), "inválido"))
                .doesNotThrowAnyException();
        assertThatThrownBy(() -> UploadFileTypeValidator.validarAssinatura(file, UploadFileTypeValidator.tipos(CSV), "inválido"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    static Stream<Arguments> spreadsheetHeaders() {
        return Stream.of(Arguments.of(new byte[]{0x50, 0x4B, 3, 4}, XLSX),
                Arguments.of(new byte[]{(byte) 0xD0, (byte) 0xCF, 0x11, (byte) 0xE0, (byte) 0xA1, (byte) 0xB1, 0x1A, (byte) 0xE1}, XLS));
    }

    @Test
    void rejeitaArquivoAusenteOuVazio() {
        for (MultipartFile file : new MultipartFile[]{null, new MockMultipartFile("arquivo", new byte[0])}) {
            assertThatThrownBy(() -> UploadFileTypeValidator.validarAssinatura(file, UploadFileTypeValidator.tipos(CSV), "inválido"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void falhaDeLeituraNaoExpoeCaminhoOuCausaInterna() throws Exception {
        MultipartFile file = mock(MultipartFile.class);
        when(file.isEmpty()).thenReturn(false);
        when(file.getInputStream()).thenThrow(new IOException("caminho-privado-simulado"));
        assertThatThrownBy(() -> UploadFileTypeValidator.validarAssinatura(file, UploadFileTypeValidator.tipos(CSV), "inválido"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Não foi possível validar o conteúdo do arquivo enviado.");
    }
}
