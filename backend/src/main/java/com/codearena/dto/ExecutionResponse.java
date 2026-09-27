package com.codearena.dto;

public record ExecutionResponse(
        String executionId,
        String status,
        String stdout,
        String stderr,
        String compileError,
        Integer exitCode,
        Long executionTime,
        Long memoryUsage,
        String message,
        boolean processStarted,
        boolean outputTruncated
) { }
