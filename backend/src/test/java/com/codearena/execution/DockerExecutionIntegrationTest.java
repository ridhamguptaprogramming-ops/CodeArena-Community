package com.codearena.execution;

import com.codearena.config.ExecutionProperties;
import com.codearena.dto.ExecutionRequest;
import com.codearena.dto.ExecutionResponse;
import com.codearena.service.ExecutionService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;

import java.nio.file.Path;
import java.util.concurrent.Semaphore;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class DockerExecutionIntegrationTest {
    private ThreadPoolExecutor ioExecutor;
    private ExecutionService service;

    @BeforeEach
    void setUp() {
        ExecutionProperties properties = new ExecutionProperties(
                "codearena/sandbox:latest", "docker", Path.of(System.getProperty("java.io.tmpdir"), "codearena-test-executions"),
                2, 25, 131072, 65536, 1048576, 2);
        ioExecutor = new ThreadPoolExecutor(4, 4, 0, TimeUnit.SECONDS, new ArrayBlockingQueue<>(64));
        DockerSandbox sandbox = new DockerSandbox(properties, ioExecutor);
        Assumptions.assumeTrue(sandbox.isAvailable(), "Build backend/sandbox/Dockerfile and start Docker to run integration tests.");
        service = new ExecutionService(properties, sandbox, new Semaphore(2, true));
    }

    @AfterEach
    void tearDown() {
        if (ioExecutor != null) ioExecutor.shutdownNow();
    }

    @Test
    void allFiveLanguagesCaptureRealStdout() {
        assertOutput("java", "public class Main { public static void main(String[] args) { System.out.println(\"JAVA_WORKING\"); } }", "JAVA_WORKING\n");
        assertOutput("python3", "print('PYTHON_WORKING')", "PYTHON_WORKING\n");
        assertOutput("javascript", "console.log('JAVASCRIPT_WORKING');", "JAVASCRIPT_WORKING\n");
        assertOutput("cpp", "#include <iostream>\nint main(){ std::cout << \"CPP_WORKING\" << std::endl; }", "CPP_WORKING\n");
        assertOutput("c", "#include <stdio.h>\nint main(){ printf(\"C_WORKING\\n\"); return 0; }", "C_WORKING\n");
    }

    @Test
    void stdinIsWrittenAndClosedForAllLanguages() {
        assertInput("java", "import java.util.*; public class Main { public static void main(String[] args) { Scanner s = new Scanner(System.in); System.out.println(s.nextInt() + s.nextInt()); } }", "10 20\n", "30\n");
        assertInput("python3", "a,b=map(int,input().split()); print(a+b)", "10 20\n", "30\n");
        assertInput("javascript", "const fs=require('fs'); const [a,b]=fs.readFileSync(0,'utf8').trim().split(/\\s+/).map(Number); console.log(a+b);", "10 20\n", "30\n");
        assertInput("cpp", "#include <iostream>\nint main(){int a,b; std::cin>>a>>b; std::cout<<a+b<<std::endl;}", "10 20\n", "30\n");
        assertInput("c", "#include <stdio.h>\nint main(){int a,b; scanf(\"%d%d\",&a,&b); printf(\"%d\\n\",a+b);}", "10 20\n", "30\n");
    }

    @Test
    void eofBasedJavaInputTerminates() {
        String code = "import java.util.*; public class Main { public static void main(String[] args) { Scanner s = new Scanner(System.in); int sum=0; while(s.hasNextInt()) sum+=s.nextInt(); System.out.println(sum); } }";
        assertInput("java", code, "1 2 3 4 5\n", "15\n");
    }

    @Test
    void stdoutAndStderrStaySeparateAndEmptyStdoutIsReal() {
        ExecutionResponse result = service.execute(new ExecutionRequest(
                "public class Main { public static void main(String[] args) { System.out.println(\"visible\"); System.err.println(\"diagnostic\"); } }", "java", ""));
        assertEquals("ACCEPTED", result.status());
        assertEquals("visible\n", result.stdout());
        assertEquals("diagnostic\n", result.stderr());
        assertEquals(0, result.exitCode());

        ExecutionResponse empty = service.execute(new ExecutionRequest(
                "public class Main { public static void main(String[] args) { } }", "java", ""));
        assertEquals("ACCEPTED", empty.status());
        assertEquals("", empty.stdout());
        assertEquals(0, empty.exitCode());
    }

    @Test
    void compileFailureIsNotAccepted() {
        ExecutionResponse result = service.execute(new ExecutionRequest("public class Main { broken }", "java", ""));
        assertEquals("COMPILATION_ERROR", result.status());
        assertNotNull(result.compileError());
        assertEquals("", result.stdout());
    }

    @Test
    void runtimeFailureAndTimeoutAreNotAccepted() {
        ExecutionResponse crashed = service.execute(new ExecutionRequest(
                "public class Main { public static void main(String[] args) { System.exit(7); } }", "java", ""));
        assertEquals("RUNTIME_ERROR", crashed.status());
        assertEquals(7, crashed.exitCode());

        ExecutionResponse timedOut = service.execute(new ExecutionRequest(
                "#include <iostream>\nint main(){for(;;){} }", "cpp", ""));
        assertEquals("TIME_LIMIT_EXCEEDED", timedOut.status());
    }

    @Test
    void memoryLimitIsReportedWhenContainerIsOomKilled() {
        String source = "#include <cstdlib>\nint main(){ volatile char* p=(char*)std::malloc(1024ull*1024ull*1024ull); if(!p)return 2; for(unsigned long long i=0;i<1024ull*1024ull*1024ull;i+=4096)p[i]=1; return 0; }";
        ExecutionResponse result = service.execute(new ExecutionRequest(source, "cpp", ""));
        assertEquals("MEMORY_LIMIT_EXCEEDED", result.status());
    }

    private void assertOutput(String language, String sourceCode, String expected) {
        ExecutionResponse result = service.execute(new ExecutionRequest(sourceCode, language, ""));
        assertEquals("ACCEPTED", result.status(), result.stderr());
        assertEquals(expected, result.stdout());
        assertEquals(0, result.exitCode());
    }

    private void assertInput(String language, String sourceCode, String stdin, String expected) {
        ExecutionResponse result = service.execute(new ExecutionRequest(sourceCode, language, stdin));
        assertEquals("ACCEPTED", result.status(), result.stderr());
        assertEquals(expected, result.stdout());
    }
}
