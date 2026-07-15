FROM cm2network/steamcmd:latest
USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl lib32gcc-s1 && \
    rm -rf /var/lib/apt/lists/*
RUN mkdir -p /server/data /server/mods /steamcmd_cache
WORKDIR /server/data
ENV PORT=26900
ENV SERVER_NAME="ForgePanel Server"
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 26900/tcp 26900/udp 26901/udp 26902/udp 26903/udp
ENTRYPOINT ["/entrypoint.sh"]
