FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       openjdk-21-jdk-headless python3 nodejs g++ gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
USER 65534:65534
