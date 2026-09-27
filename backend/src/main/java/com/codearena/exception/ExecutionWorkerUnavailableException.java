package com.codearena.exception;

public class ExecutionWorkerUnavailableException extends RuntimeException {
    public ExecutionWorkerUnavailableException(String message) {
        super(message);
    }

    public ExecutionWorkerUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
