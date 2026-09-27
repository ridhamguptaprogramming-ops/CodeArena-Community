package com.codearena.execution;

import java.util.List;

public enum SupportedLanguage {
    JAVA("java", "Main.java", List.of("javac", "Main.java"), List.of("java", "-cp", "/workspace", "Main")),
    PYTHON("python3", "main.py", List.of(), List.of("python3", "/workspace/main.py")),
    JAVASCRIPT("javascript", "main.js", List.of(), List.of("node", "/workspace/main.js")),
    CPP("cpp", "main.cpp", List.of("g++", "-std=c++17", "main.cpp", "-o", "program"), List.of("/workspace/program")),
    C("c", "main.c", List.of("gcc", "-std=c17", "main.c", "-o", "program"), List.of("/workspace/program"));

    private final String apiName;
    private final String sourceFile;
    private final List<String> compileCommand;
    private final List<String> runCommand;

    SupportedLanguage(String apiName, String sourceFile, List<String> compileCommand, List<String> runCommand) {
        this.apiName = apiName;
        this.sourceFile = sourceFile;
        this.compileCommand = compileCommand;
        this.runCommand = runCommand;
    }

    public String apiName() { return apiName; }
    public String sourceFile() { return sourceFile; }
    public List<String> compileCommand() { return compileCommand; }
    public List<String> runCommand() { return runCommand; }

    public static SupportedLanguage from(String value) {
        if (value == null) throw new IllegalArgumentException("Language is required.");
        String normalized = value.trim().toLowerCase().replace("++", "pp");
        return switch (normalized) {
            case "java" -> JAVA;
            case "python", "python3", "py" -> PYTHON;
            case "javascript", "js", "node" -> JAVASCRIPT;
            case "cpp", "cxx" -> CPP;
            case "c" -> C;
            default -> throw new IllegalArgumentException("Unsupported language: " + value);
        };
    }
}
