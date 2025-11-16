# Build stage
FROM rust:latest as builder

WORKDIR /app

# Copy everything
COPY . .

# Build for release
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary and assets
COPY --from=builder /app/target/release/yavin-ai ./yavin-ai
COPY templates ./templates
COPY static ./static

ENV RUST_LOG=info
EXPOSE 8080

CMD ["./yavin-ai"]

