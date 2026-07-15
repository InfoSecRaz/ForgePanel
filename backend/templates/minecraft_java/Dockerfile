FROM eclipse-temurin:21-jre-jammy
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget jq && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /server/data
WORKDIR /server/data
ENV MEMORY_MB=4096
ENV SERVER_JAR=paper
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 25565
ENTRYPOINT ["/entrypoint.sh"]
