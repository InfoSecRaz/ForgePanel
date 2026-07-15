FROM cm2network/steamcmd:latest
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl lib32gcc-s1 && \
    rm -rf /var/lib/apt/lists/*
RUN mkdir -p /server/data /server/mods /steamcmd_cache
WORKDIR /server/data
ENV PORT=34197
ENV SERVER_NAME="ForgePanel Server"
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 34197/udp
ENTRYPOINT ["/entrypoint.sh"]
