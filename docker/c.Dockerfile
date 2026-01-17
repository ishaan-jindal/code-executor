FROM gcc:13

WORKDIR /app

RUN useradd -m runner
USER runner

CMD ["sh", "-c", "gcc main.c -O2 -o main && ./main"]

