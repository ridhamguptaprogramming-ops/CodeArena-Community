package com.codearena.execution;

import com.codearena.config.ExecutionProperties;
import com.codearena.exception.ExecutionWorkerUnavailableException;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@Component
public class DockerSandbox {
    private static final int SANDBOX_UID = 65534;
    private final ExecutionProperties properties;
    private final ThreadPoolExecutor ioExecutor;

    public DockerSandbox(ExecutionProperties properties, ThreadPoolExecutor processIoExecutor) {
        this.properties = properties;
        this.ioExecutor = processIoExecutor;
    }

    public ProcessCapture run(String executionId, String phase, Path workspace, List<String> command,
                              String stdin, Duration timeout) {
        String containerName = "codearena-" + executionId + "-" + phase;
        List<String> args = dockerArgs(containerName, workspace, command);
        Process process;
        try {
            process = new ProcessBuilder(args).start();
        } catch (IOException exception) {
            throw new ExecutionWorkerUnavailableException("Unable to start the Docker execution worker.", exception);
        }

        int outputLimit = properties.maxOutputBytes();
        Future<CapturedStream> stdoutFuture = ioExecutor.submit(() -> capture(process.getInputStream(), outputLimit));
        Future<CapturedStream> stderrFuture = ioExecutor.submit(() -> capture(process.getErrorStream(), outputLimit));
        Future<?> stdinFuture = ioExecutor.submit(() -> writeStdin(process, stdin));
        try {
            boolean completedInTime = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
            boolean timedOut = !completedInTime;
            ContainerState state = inspectContainer(containerName);
            if (!completedInTime) {
                process.destroyForcibly();
                process.waitFor(2, TimeUnit.SECONDS);
                cleanupContainer(containerName);
            }

            try {
                stdinFuture.get(1, TimeUnit.SECONDS);
            } catch (TimeoutException exception) {
                stdinFuture.cancel(true);
            } catch (ExecutionException exception) {
                if (process.isAlive()) throw new IOException("Could not deliver stdin to the sandbox.", exception);
            }

            CapturedStream stdout = await(stdoutFuture);
            CapturedStream stderr = await(stderrFuture);
            int exitCode = timedOut ? -1 : process.exitValue();
            return new ProcessCapture(exitCode, stdout.text(), stderr.text(), timedOut,
                    stdout.truncated() || stderr.truncated(), state.started(), state.memoryExceeded());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            process.destroyForcibly();
            throw new ExecutionWorkerUnavailableException("Execution was interrupted.", exception);
        } catch (IOException | ExecutionException exception) {
            process.destroyForcibly();
            throw new ExecutionWorkerUnavailableException("Could not exchange data with the execution worker.", exception);
        } finally {
            if (process.isAlive()) process.destroyForcibly();
            cleanupContainer(containerName);
        }
    }

    public boolean isAvailable() {
        try {
            Process info = new ProcessBuilder(properties.dockerCommand(), "info", "--format", "{{.ServerVersion}}").start();
            if (!info.waitFor(3, TimeUnit.SECONDS)) {
                info.destroyForcibly();
                return false;
            }
            if (info.exitValue() != 0) return false;
            Process image = new ProcessBuilder(properties.dockerCommand(), "image", "inspect", "--format", "{{.Id}}", properties.dockerImage()).start();
            return image.waitFor(3, TimeUnit.SECONDS) && image.exitValue() == 0;
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            return false;
        }
    }

    private List<String> dockerArgs(String containerName, Path workspace, List<String> command) {
        boolean runtimePhase = containerName.endsWith("-run");
        String workspaceMount = "type=bind,src=" + workspace.toAbsolutePath() + ",dst=/workspace" + (runtimePhase ? ",readonly" : "");
        List<String> args = new ArrayList<>(List.of(
                properties.dockerCommand(), "run", "--interactive", "--name", containerName,
                "--network", "none", "--read-only",
                "--cpus", "1", "--memory", "256m", "--memory-swap", "256m", "--pids-limit", "64",
                "--security-opt", "no-new-privileges", "--cap-drop", "ALL",
                "--user", SANDBOX_UID + ":" + SANDBOX_UID,
                "--ulimit", "nofile=64:64", "--ulimit", "fsize=1048576:1048576",
                "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m",
                "--mount", workspaceMount,
                "--workdir", runtimePhase ? "/tmp" : "/workspace", "--env", "HOME=/tmp", "--env", "TMPDIR=/tmp",
                properties.dockerImage()
        ));
        args.addAll(command);
        return args;
    }

    private CapturedStream capture(InputStream stream, int limit) throws IOException {
        try (stream; var buffer = new ByteArrayOutputStream(Math.min(limit, 8192))) {
            byte[] chunk = new byte[8192];
            int captured = 0;
            boolean truncated = false;
            int read;
            while ((read = stream.read(chunk)) != -1) {
                int keep = Math.min(read, Math.max(0, limit - captured));
                if (keep > 0) buffer.write(chunk, 0, keep);
                captured += keep;
                if (keep < read) truncated = true;
            }
            return new CapturedStream(buffer.toString(StandardCharsets.UTF_8), truncated);
        }
    }

    private void writeStdin(Process process, String stdin) {
        try (var childInput = process.getOutputStream()) {
            childInput.write(stdin.getBytes(StandardCharsets.UTF_8));
            childInput.flush();
        } catch (IOException processEndedBeforeInputWasConsumed) {
            if (process.isAlive()) throw new RuntimeException(processEndedBeforeInputWasConsumed);
        }
    }

    private CapturedStream await(Future<CapturedStream> future) throws InterruptedException, ExecutionException {
        return future.get();
    }

    private void cleanupContainer(String containerName) {
        try {
            Process cleanup = new ProcessBuilder(properties.dockerCommand(), "rm", "--force", containerName).start();
            if (!cleanup.waitFor(3, TimeUnit.SECONDS)) cleanup.destroyForcibly();
        } catch (IOException exception) {
            // A successful `docker run` may already have removed the container.
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
        }
    }

    private ContainerState inspectContainer(String containerName) {
        try {
            Process inspect = new ProcessBuilder(properties.dockerCommand(), "inspect", "--format",
                    "{{.State.StartedAt}}|{{.State.Error}}|{{.State.OOMKilled}}", containerName).start();
            byte[] response = inspect.getInputStream().readNBytes(2048);
            if (!inspect.waitFor(3, TimeUnit.SECONDS) || inspect.exitValue() != 0) return new ContainerState(false, false);
            String[] fields = new String(response, StandardCharsets.UTF_8).trim().split("\\|", -1);
            if (fields.length != 3) return new ContainerState(false, false);
            boolean started = !fields[0].isBlank() && !fields[0].startsWith("0001-01-01") && fields[1].isBlank();
            return new ContainerState(started, fields[2].equalsIgnoreCase("true"));
        } catch (IOException | InterruptedException exception) {
            if (exception instanceof InterruptedException) Thread.currentThread().interrupt();
            return new ContainerState(false, false);
        }
    }

    private record CapturedStream(String text, boolean truncated) { }
    private record ContainerState(boolean started, boolean memoryExceeded) { }
}
