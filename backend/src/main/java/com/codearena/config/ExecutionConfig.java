package com.codearena.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

@Configuration
public class ExecutionConfig {
    @Bean(destroyMethod = "shutdown")
    ThreadPoolExecutor processIoExecutor(ExecutionProperties properties) {
        int workers = Math.max(3, properties.maxParallelExecutions() * 3);
        return new ThreadPoolExecutor(
                workers,
                workers,
                30,
                TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(workers * 16),
                task -> {
                    Thread thread = new Thread(task, "codearena-process-io");
                    thread.setDaemon(true);
                    return thread;
                },
                new ThreadPoolExecutor.AbortPolicy()
        );
    }

    @Bean
    java.util.concurrent.Semaphore executionSlots(ExecutionProperties properties) {
        return new java.util.concurrent.Semaphore(properties.maxParallelExecutions(), true);
    }
}
