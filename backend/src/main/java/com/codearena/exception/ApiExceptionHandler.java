package com.codearena.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> validation(MethodArgumentNotValidException exception) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "sourceCode, language, and stdin are required and must be within the configured limits.");
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, IllegalArgumentException.class})
    ResponseEntity<?> invalidRequest(Exception exception) {
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", exception instanceof IllegalArgumentException ? exception.getMessage() : "Malformed JSON request.");
    }

    @ExceptionHandler(ExecutionWorkerUnavailableException.class)
    ResponseEntity<?> unavailable(ExecutionWorkerUnavailableException exception) {
        return error(HttpStatus.SERVICE_UNAVAILABLE, "EXECUTION_WORKER_UNAVAILABLE", exception.getMessage());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<?> unexpected(Exception exception) {
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "EXECUTION_ERROR", "The execution service could not complete this request.");
    }

    private ResponseEntity<?> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of(
                "success", false,
                "error", Map.of("code", code, "message", message)
        ));
    }
}
