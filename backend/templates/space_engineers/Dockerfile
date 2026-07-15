FROM cm2network/steamcmd:latest
USER root
RUN dpkg --add-architecture i386 && apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl lib32gcc-s1 wine64 xvfb && \
    rm -rf /var/lib/apt/lists/*
RUN mkdir -p /server/data /server/mods /steamcmd_cache
WORKDIR /server/data
ENV PORT=27016
ENV SERVER_NAME="ForgePanel Server"
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 27016/udp 27017/udp
ENTRYPOINT ["/entrypoint.sh"]
