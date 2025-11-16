# Build stage
FROM rust:1.75 as builder

WORKDIR /app

# Copy manifests
COPY Cargo.toml ./

# Create dummy main to cache dependencies
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy actual source
COPY src ./src
COPY templates ./templates
COPY static ./static

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
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/static ./static

ENV RUST_LOG=info
EXPOSE 8080

CMD ["./yavin-ai"]

