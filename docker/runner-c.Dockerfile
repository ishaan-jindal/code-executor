FROM gcc:13

WORKDIR /app

RUN useradd -m runner
USER runner

CMD []
