package com.codearena.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.nio.file.Path;

@ConfigurationProperties(prefix = "codearena.execution")
public record ExecutionProperties(
        String dockerImage,
        String dockerCommand,
        Path tempRoot,
        long timeoutSeconds,
        long compileTimeoutSeconds,
        int maxSourceBytes,
        int maxStdinBytes,
        int maxOutputBytes,
        int maxParallelExecutions
) { }
