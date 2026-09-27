package com.codearena.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ExecutionRequest(
        @NotBlank @Size(max = 131072) String sourceCode,
        @NotBlank @Size(max = 32) String language,
        @NotNull @Size(max = 65536) String stdin,
        @Size(max = 80) String executionId
) {
    public ExecutionRequest(String sourceCode, String language, String stdin) {
        this(sourceCode, language, stdin, null);
    }
}
