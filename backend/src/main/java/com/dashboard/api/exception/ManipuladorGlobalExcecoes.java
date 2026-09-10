package com.dashboard.api.exception;

import jakarta.validation.ConstraintViolationException;
import java.io.UncheckedIOException;
import java.sql.SQLException;
import java.time.LocalDateTime;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.transaction.TransactionException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class ManipuladorGlobalExcecoes {

    private static final Logger log = LoggerFactory.getLogger(ManipuladorGlobalExcecoes.class);

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<RespostaErroPadrao> handleUnreadableRequest(HttpMessageNotReadableException ex) {
        // Parser exceptions can contain the submitted payload; never log it here.
        log.warn("Corpo da requisição ausente ou inválido.");
        return ResponseEntity.badRequest().body(criarResposta(
                HttpStatus.BAD_REQUEST, "Bad Request", "Corpo da requisição ausente ou inválido."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<RespostaErroPadrao> handleMethodArgumentNotValid(MethodArgumentNotValidException ex) {
        log.warn("Corpo da requisição inválido: {}", ex.getMessage());

        RespostaErroPadrao resposta = criarResposta(
                HttpStatus.BAD_REQUEST,
                "Bad Request",
                "Dados inválidos na requisição."
        );

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resposta);
    }

    @ExceptionHandler({ConstraintViolationException.class, HandlerMethodValidationException.class})
    public ResponseEntity<RespostaErroPadrao> handleValidationFailure(Exception ex) {
        log.warn("Validação da requisição falhou: {}", ex.getMessage());

        RespostaErroPadrao resposta = criarResposta(
                HttpStatus.BAD_REQUEST,
                "Bad Request",
                "Dados inválidos na requisição."
        );

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resposta);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<RespostaErroPadrao> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Requisição inválida: {}", ex.getMessage());

        RespostaErroPadrao resposta = criarResposta(HttpStatus.BAD_REQUEST, "Bad Request", ex.getMessage());

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resposta);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<RespostaErroPadrao> handleMissingServletRequestParameter(
            MissingServletRequestParameterException ex
    ) {
        log.warn("Parâmetro obrigatório ausente: {}", ex.getParameterName());

        String mensagem = "Parâmetro obrigatório ausente: " + ex.getParameterName() + ".";
        RespostaErroPadrao resposta = criarResposta(HttpStatus.BAD_REQUEST, "Bad Request", mensagem);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resposta);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<RespostaErroPadrao> handleMethodArgumentTypeMismatch(MethodArgumentTypeMismatchException ex) {
        log.warn("Parâmetro inválido: {}={}", ex.getName(), ex.getValue());

        String mensagem = "Parâmetro inválido: " + ex.getName() + ".";
        RespostaErroPadrao resposta = criarResposta(HttpStatus.BAD_REQUEST, "Bad Request", mensagem);

        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resposta);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<RespostaErroPadrao> handleIllegalState(IllegalStateException ex) {
        log.warn("Conflito de regra de negócio: {}", ex.getMessage());

        RespostaErroPadrao resposta = criarResposta(HttpStatus.CONFLICT, "Conflict", ex.getMessage());

        return ResponseEntity.status(HttpStatus.CONFLICT).body(resposta);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<RespostaErroPadrao> handleResponseStatus(ResponseStatusException ex) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        HttpStatus statusSeguro = status != null ? status : HttpStatus.INTERNAL_SERVER_ERROR;
        String mensagem = ex.getReason() != null && !ex.getReason().isBlank()
                ? ex.getReason()
                : statusSeguro.getReasonPhrase();

        log.warn("Requisição recusada: status={} mensagem={}", ex.getStatusCode().value(), mensagem);

        RespostaErroPadrao resposta = criarResposta(statusSeguro, statusSeguro.getReasonPhrase(), mensagem);

        return ResponseEntity.status(ex.getStatusCode()).body(resposta);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<RespostaErroPadrao> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Acesso negado: {}", ex.getMessage());

        RespostaErroPadrao resposta = new RespostaErroPadrao(
                LocalDateTime.now(),
                HttpStatus.FORBIDDEN.value(),
                "Forbidden",
                "Acesso negado ao recurso."
        );

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(resposta);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<RespostaErroPadrao> handleMethodNotSupported(HttpRequestMethodNotSupportedException ex) {
        log.warn("Método HTTP não permitido: {}", ex.getMessage());

        RespostaErroPadrao resposta = criarResposta(
                HttpStatus.METHOD_NOT_ALLOWED,
                "Method Not Allowed",
                "Método HTTP não permitido para este endpoint."
        );

        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).body(resposta);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<RespostaErroPadrao> handleMediaTypeNotSupported(HttpMediaTypeNotSupportedException ex) {
        log.warn("Content-Type não suportado: {}", ex.getContentType());

        RespostaErroPadrao resposta = criarResposta(
                HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Unsupported Media Type",
                "Content-Type não suportado para este endpoint."
        );

        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(resposta);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<RespostaErroPadrao> handleNoResourceFound(NoResourceFoundException ex) {
        log.warn("Recurso não encontrado: {}", ex.getResourcePath());

        RespostaErroPadrao resposta = criarResposta(
                HttpStatus.NOT_FOUND,
                "Not Found",
                "Recurso não encontrado."
        );

        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(resposta);
    }

    @ExceptionHandler({
        jakarta.persistence.QueryTimeoutException.class,
        org.springframework.dao.QueryTimeoutException.class
    })
    public ResponseEntity<RespostaErroPadrao> handleQueryTimeout(Exception ex) {
        log.warn("Timeout na consulta ao banco de dados: {}", ex.getMessage());

        RespostaErroPadrao resposta = new RespostaErroPadrao(
                LocalDateTime.now(),
                HttpStatus.GATEWAY_TIMEOUT.value(),
                "Gateway Timeout",
                "A consulta excedeu o tempo limite. Reduza o período ou os filtros e tente novamente."
        );

        return ResponseEntity.status(HttpStatus.GATEWAY_TIMEOUT).body(resposta);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<RespostaErroPadrao> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        log.warn("Violação de integridade no banco de dados: {}", ex.getMostSpecificCause().getMessage());

        RespostaErroPadrao resposta = new RespostaErroPadrao(
                LocalDateTime.now(),
                HttpStatus.CONFLICT.value(),
                "Conflict",
                "Não foi possível salvar porque os dados violam uma regra de unicidade ou relacionamento."
        );

        return ResponseEntity.status(HttpStatus.CONFLICT).body(resposta);
    }

    @ExceptionHandler({SQLException.class, DataAccessException.class, TransactionException.class, jakarta.persistence.PersistenceException.class})
    public ResponseEntity<RespostaErroPadrao> handleDatabaseFailure(Exception ex) {
        log.error("Falha no acesso ao banco de dados: {}", ex.getMessage(), ex);

        RespostaErroPadrao resposta = new RespostaErroPadrao(
                LocalDateTime.now(),
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                "Service Unavailable",
                "Serviço de dados temporariamente indisponível."
        );

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(resposta);
    }

    @ExceptionHandler(RestClientException.class)
    public ResponseEntity<RespostaErroPadrao> handleExternalHttpFailure(RestClientException ex) {
        log.error("Falha ao chamar serviço HTTP externo: {}", ex.getMessage(), ex);

        RespostaErroPadrao resposta = new RespostaErroPadrao(
                LocalDateTime.now(),
                HttpStatus.SERVICE_UNAVAILABLE.value(),
                "Service Unavailable",
                "Serviço de integração temporariamente indisponível."
        );

        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(resposta);
    }

    @ExceptionHandler(UncheckedIOException.class)
    public ResponseEntity<RespostaErroPadrao> handleUncheckedIo(UncheckedIOException ex) {
        log.error("Falha de I/O não tratada (possível arquivo de configuração corrompido): {}", ex.getMessage(), ex);

        RespostaErroPadrao resposta = new RespostaErroPadrao(
                LocalDateTime.now(),
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Internal Server Error",
                "Erro interno no servidor."
        );

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(resposta);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<RespostaErroPadrao> handleGeneric(Exception ex) {
        log.error("Erro interno não tratado: {}", ex.getMessage(), ex);

        RespostaErroPadrao resposta = criarResposta(
                HttpStatus.INTERNAL_SERVER_ERROR,
                "Internal Server Error",
                "Erro interno no servidor."
        );

        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(resposta);
    }

    private RespostaErroPadrao criarResposta(HttpStatus status, String erro, String mensagem) {
        return new RespostaErroPadrao(
                LocalDateTime.now(),
                status.value(),
                erro,
                mensagem
        );
    }
}
