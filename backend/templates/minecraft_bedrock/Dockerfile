FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl unzip jq ca-certificates libcurl4 && \
    rm -rf /var/lib/apt/lists/*
RUN mkdir -p /server/data
WORKDIR /server/data
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 19132/udp
ENTRYPOINT ["/entrypoint.sh"]
