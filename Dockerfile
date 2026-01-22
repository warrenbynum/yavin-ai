# Build stage
FROM rust:1.75 AS builder

WORKDIR /app

# Copy manifests first for better caching
COPY Cargo.toml Cargo.lock ./

# Create dummy src to build dependencies
RUN mkdir src && echo "fn main() {println!(\"placeholder\");}" > src/main.rs
RUN cargo build --release || true
RUN rm -rf src

# Copy actual source
COPY src ./src

# Touch to invalidate cache and rebuild
RUN touch src/main.rs
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy binary
COPY --from=builder /app/target/release/yavin-ai .

# Copy static assets
COPY static ./static
COPY templates ./templates

ENV RUST_LOG=info
ENV PORT=8080

EXPOSE 8080

CMD ["./yavin-ai"]
