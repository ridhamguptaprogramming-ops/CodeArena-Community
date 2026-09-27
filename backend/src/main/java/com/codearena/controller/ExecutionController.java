package com.codearena.controller;

import com.codearena.dto.ExecutionRequest;
import com.codearena.dto.ExecutionResponse;
import com.codearena.dto.HealthResponse;
import com.codearena.service.ExecutionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class ExecutionController {
    private final ExecutionService executionService;

    public ExecutionController(ExecutionService executionService) {
        this.executionService = executionService;
    }

    @PostMapping("/submit")
    @ResponseStatus(HttpStatus.OK)
    public ExecutionResponse submit(@Valid @RequestBody ExecutionRequest request) {
        return executionService.execute(request);
    }

    @GetMapping("/health")
    public HealthResponse health() {
        boolean available = executionService.workerAvailable();
        return new HealthResponse(available ? "UP" : "DEGRADED", "CodeArena Backend", available ? "UP" : "UNAVAILABLE");
    }
}
