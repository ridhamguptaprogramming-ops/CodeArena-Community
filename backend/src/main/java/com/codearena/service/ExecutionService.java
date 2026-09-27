package com.codearena.service;

import com.codearena.config.ExecutionProperties;
import com.codearena.dto.ExecutionRequest;
import com.codearena.dto.ExecutionResponse;
import com.codearena.exception.ExecutionWorkerUnavailableException;
import com.codearena.execution.DockerSandbox;
import com.codearena.execution.ProcessCapture;
import com.codearena.execution.SupportedLanguage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.PosixFilePermission;
import java.time.Duration;
import java.util.EnumSet;
import java.util.UUID;
import java.util.concurrent.Semaphore;

@Service
public class ExecutionService {
    private static final Logger log = LoggerFactory.getLogger(ExecutionService.class);
    private final ExecutionProperties properties;
    private final DockerSandbox sandbox;
    private final Semaphore executionSlots;

    public ExecutionService(ExecutionProperties properties, DockerSandbox sandbox, Semaphore executionSlots) {
        this.properties = properties;
        this.sandbox = sandbox;
        this.executionSlots = executionSlots;
    }

    public ExecutionResponse execute(ExecutionRequest request) {
        SupportedLanguage language = SupportedLanguage.from(request.language());
        byte[] source = request.sourceCode().getBytes(StandardCharsets.UTF_8);
        byte[] stdin = request.stdin().getBytes(StandardCharsets.UTF_8);
        if (source.length > properties.maxSourceBytes()) throw new IllegalArgumentException("Source code exceeds the configured size limit.");
        if (stdin.length > properties.maxStdinBytes()) throw new IllegalArgumentException("Standard input exceeds the configured size limit.");
        if (!executionSlots.tryAcquire()) throw new ExecutionWorkerUnavailableException("All execution workers are busy. Try again shortly.");

        String executionId = request.executionId() != null && request.executionId().matches("[A-Za-z0-9_-]{1,80}")
                ? request.executionId()
                : UUID.randomUUID().toString();
        long startedAt = System.nanoTime();
        Path workspace = null;
        try {
            log.info("EXECUTION START executionId={} language={} sourceCodeLength={} stdinLength={} sourceFile={}",
                    executionId, language.apiName(), source.length, stdin.length, language.sourceFile());
            workspace = createWorkspace(executionId);
            Files.writeString(workspace.resolve(language.sourceFile()), request.sourceCode(), StandardCharsets.UTF_8);

            String compileStderr = "";
            boolean outputTruncated = false;
            if (!language.compileCommand().isEmpty()) {
                log.info("COMPILATION executionId={} compileCommand={}", executionId, language.compileCommand());
                ProcessCapture compile = sandbox.run(executionId, "compile", workspace, language.compileCommand(), "",
                        Duration.ofSeconds(properties.compileTimeoutSeconds()));
                log.info("COMPILATION RESULT executionId={} exitCode={} stdoutLength={} stderrLength={} timedOut={}",
                        executionId, compile.exitCode(), compile.stdout().length(), compile.stderr().length(), compile.timedOut());
                outputTruncated |= compile.outputTruncated();
                if (compile.memoryExceeded()) {
                    return response(executionId, "MEMORY_LIMIT_EXCEEDED", "", compile.stderr(), compile.stderr(),
                            null, startedAt, false, outputTruncated, "Compilation exceeded the memory limit.");
                }
                if (compile.timedOut()) {
                    return response(executionId, "TIME_LIMIT_EXCEEDED", "", compile.stderr(), compile.stderr(),
                            null, startedAt, false, outputTruncated, "Compilation exceeded the time limit.");
                }
                if (compile.exitCode() >= 125) {
                    throw new ExecutionWorkerUnavailableException("The sandbox could not start the configured compiler.");
                }
                if (compile.exitCode() != 0) {
                    return response(executionId, "COMPILATION_ERROR", "", compile.stderr(), compile.stderr(),
                            compile.exitCode(), startedAt, false, outputTruncated, "Compilation failed.");
                }
                compileStderr = compile.stderr();
            }

            log.info("RUNTIME executionId={} runCommand={}", executionId, language.runCommand());
            ProcessCapture runtime = sandbox.run(executionId, "run", workspace, language.runCommand(), request.stdin(),
                    Duration.ofSeconds(properties.timeoutSeconds()));
            log.info("RUNTIME RESULT executionId={} processStarted={} exitCode={} stdoutLength={} stderrLength={} timedOut={}",
                    executionId, runtime.processStarted(), runtime.exitCode(), runtime.stdout().length(),
                    runtime.stderr().length(), runtime.timedOut());
            outputTruncated |= runtime.outputTruncated();

            if (!runtime.processStarted()) {
                throw new ExecutionWorkerUnavailableException("The sandbox could not start the configured runtime.");
            }
            String stderr = appendStderr(compileStderr, runtime.stderr());
            String status = runtime.timedOut() ? "TIME_LIMIT_EXCEEDED"
                    : runtime.memoryExceeded() ? "MEMORY_LIMIT_EXCEEDED"
                    : runtime.exitCode() == 0 ? "ACCEPTED" : "RUNTIME_ERROR";
            String message = runtime.timedOut() ? "Execution exceeded the time limit."
                    : runtime.memoryExceeded() ? "Execution exceeded the memory limit."
                    : runtime.exitCode() == 0 ? "Execution completed." : "Program exited with a non-zero status.";
            return response(executionId, status, runtime.stdout(), stderr, "",
                    runtime.timedOut() || runtime.memoryExceeded() ? null : runtime.exitCode(), startedAt,
                    runtime.processStarted(), outputTruncated, message);
        } catch (IOException exception) {
            throw new ExecutionWorkerUnavailableException("Unable to prepare the isolated execution workspace.", exception);
        } finally {
            deleteWorkspace(workspace);
            executionSlots.release();
        }
    }

    public boolean workerAvailable() {
        return sandbox.isAvailable();
    }

    private Path createWorkspace(String executionId) throws IOException {
        Files.createDirectories(properties.tempRoot());
        setPermissions(properties.tempRoot(), EnumSet.of(PosixFilePermission.OWNER_READ, PosixFilePermission.OWNER_WRITE, PosixFilePermission.OWNER_EXECUTE));
        Path workspace = Files.createTempDirectory(properties.tempRoot(), executionId + "-");
        setPermissions(workspace, EnumSet.allOf(PosixFilePermission.class));
        return workspace;
    }

    private void setPermissions(Path path, EnumSet<PosixFilePermission> permissions) {
        try {
            Files.setPosixFilePermissions(path, permissions);
        } catch (UnsupportedOperationException | IOException exception) {
            log.debug("POSIX permissions unavailable for execution workspace {}", path.getFileName());
        }
    }

    private void deleteWorkspace(Path workspace) {
        if (workspace == null || !Files.exists(workspace)) return;
        try {
            Files.walkFileTree(workspace, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.deleteIfExists(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exception) throws IOException {
                    if (exception != null) throw exception;
                    Files.deleteIfExists(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException exception) {
            log.warn("Could not clean execution workspace {}", workspace.getFileName());
        }
    }

    private String appendStderr(String compilerStderr, String runtimeStderr) {
        if (compilerStderr.isBlank()) return runtimeStderr;
        if (runtimeStderr.isBlank()) return compilerStderr;
        return compilerStderr + (compilerStderr.endsWith("\n") ? "" : "\n") + runtimeStderr;
    }

    private ExecutionResponse response(String id, String status, String stdout, String stderr, String compileError,
                                       Integer exitCode, long startedAt, boolean processStarted,
                                       boolean outputTruncated, String message) {
        long durationMs = Duration.ofNanos(System.nanoTime() - startedAt).toMillis();
        log.info("EXECUTION END executionId={} status={} exitCode={} stdoutLength={} stderrLength={} durationMs={} outputTruncated={}",
                id, status, exitCode, stdout.length(), stderr.length(), durationMs, outputTruncated);
        return new ExecutionResponse(id, status, stdout, stderr, compileError, exitCode, durationMs,
                null, message, processStarted, outputTruncated);
    }
}
