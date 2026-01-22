# Use latest Rust
FROM rust:latest AS builder

WORKDIR /app

# Copy source
COPY Cargo.toml ./
COPY src ./src

# Build
RUN cargo build --release

# Runtime
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/yavin-ai .
COPY static ./static
COPY templates ./templates

ENV RUST_LOG=info
EXPOSE 8080

CMD ["./yavin-ai"]
