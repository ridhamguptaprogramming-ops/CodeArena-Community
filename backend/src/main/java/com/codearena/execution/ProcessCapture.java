package com.codearena.execution;

public record ProcessCapture(int exitCode, String stdout, String stderr, boolean timedOut,
                             boolean outputTruncated, boolean processStarted, boolean memoryExceeded) { }
