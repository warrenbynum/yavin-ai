# Yavin AI Launch Guide

Complete setup and launch instructions for the Yavin AI educational platform built with Rust.

---

## 📋 Prerequisites

### Required Software

1. **Rust and Cargo** (1.70 or later)
   ```bash
   # Check if Rust is installed
   rustc --version
   cargo --version
   
   # If not installed, install via rustup
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

2. **Modern Web Browser**
   - Chrome, Firefox, Safari, or Edge (latest versions)

---

## 🚀 Quick Start (Development)

### Step 1: Navigate to Project Directory
```bash
cd /Users/wbj/Desktop/education
```

### Step 2: Build and Run
```bash
# Development build and run (faster compilation, less optimization)
cargo run

# The server will start on http://localhost:8080
# You'll see output like:
# [INFO] Starting Yavin AI server...
# [INFO] Starting 8 workers
# [INFO] Listening on 127.0.0.1:8080
```

### Step 3: Access the Site
Open your browser to: **http://localhost:8080**

### Step 4: Stop the Server
Press `Ctrl+C` in the terminal

---

## 📦 Production Deployment

### Build for Production
```bash
# Create optimized production build
cargo build --release

# The binary will be at: ./target/release/yavin-ai
# This build includes:
# - Link-time optimization (LTO)
# - Aggressive optimizations (opt-level = 3)
# - Single codegen unit for maximum performance
```

### Run Production Build
```bash
# From project root
./target/release/yavin-ai

# Or specify a different host/port via environment variables
HOST=0.0.0.0 PORT=3000 ./target/release/yavin-ai
```

---

## 🌐 Deployment Options

### Option 1: Systemd Service (Linux)

1. **Create service file** `/etc/systemd/system/yavin-ai.service`:
```ini
[Unit]
Description=Yavin AI Education Platform
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/yavin-ai
Environment="RUST_LOG=info"
ExecStart=/opt/yavin-ai/target/release/yavin-ai
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

2. **Deploy**:
```bash
# Copy files to deployment location
sudo mkdir -p /opt/yavin-ai
sudo cp -r /Users/wbj/Desktop/education/* /opt/yavin-ai/
cd /opt/yavin-ai
sudo cargo build --release

# Set permissions
sudo chown -R www-data:www-data /opt/yavin-ai

# Enable and start service
sudo systemctl enable yavin-ai
sudo systemctl start yavin-ai
sudo systemctl status yavin-ai

# View logs
sudo journalctl -u yavin-ai -f
```

---

### Option 2: Docker Container

1. **Create Dockerfile** (already in project root):
```dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/yavin-ai /usr/local/bin/
COPY --from=builder /app/templates /templates
COPY --from=builder /app/static /static
WORKDIR /
EXPOSE 8080
ENV RUST_LOG=info
CMD ["yavin-ai"]
```

2. **Build and run**:
```bash
# Build image
docker build -t yavin-ai:latest .

# Run container
docker run -d -p 8080:8080 --name yavin-ai yavin-ai:latest

# View logs
docker logs -f yavin-ai

# Stop container
docker stop yavin-ai
```

---

### Option 3: Nginx Reverse Proxy

**Benefits**: SSL termination, static file caching, load balancing

1. **Nginx configuration** `/etc/nginx/sites-available/yavin-ai`:
```nginx
server {
    listen 80;
    server_name yavin.ai www.yavin.ai;

    # Redirect to HTTPS (if SSL configured)
    # return 301 https://$server_name$request_uri;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Cache static files
    location /static/ {
        proxy_pass http://127.0.0.1:8080/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

2. **Enable site**:
```bash
sudo ln -s /etc/nginx/sites-available/yavin-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### Option 4: Cloud Platforms

#### **AWS (EC2 + ALB)**
```bash
# Launch EC2 instance (Ubuntu/Amazon Linux)
# Install Rust and dependencies
# Clone repository
# Build and run with systemd
# Configure ALB for load balancing
# Set up CloudWatch for monitoring
```

#### **Google Cloud (Cloud Run)**
```bash
# Build Docker image
gcloud builds submit --tag gcr.io/PROJECT_ID/yavin-ai

# Deploy to Cloud Run
gcloud run deploy yavin-ai \
  --image gcr.io/PROJECT_ID/yavin-ai \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### **Heroku**
```bash
# Create Heroku app
heroku create yavin-ai

# Add Rust buildpack
heroku buildpacks:set emk/rust

# Deploy
git push heroku main
```

---

## 🔧 Configuration

### Environment Variables

```bash
# Server configuration
export HOST="127.0.0.1"    # Bind address (use 0.0.0.0 for external access)
export PORT="8080"          # Port number
export RUST_LOG="info"      # Log level (error, warn, info, debug, trace)

# Example: Run on port 3000 with debug logging
RUST_LOG=debug PORT=3000 cargo run
```

### Logging

The application uses `env_logger`. Control verbosity:
```bash
# Error only
RUST_LOG=error cargo run

# Info (default - recommended for production)
RUST_LOG=info cargo run

# Debug (verbose - useful for development)
RUST_LOG=debug cargo run

# Trace (very verbose)
RUST_LOG=trace cargo run
```

---

## 📊 Monitoring and Maintenance

### Health Check
```bash
# Check if server is responding
curl http://localhost:8080/

# Check specific page
curl http://localhost:8080/foundations
```

### Performance Monitoring

**Key metrics to monitor:**
- Response time (should be <10ms for most requests)
- Memory usage (stable, no leaks)
- CPU usage (low, spikes during compilation/deployment)
- Active connections
- Error rates

**Tools:**
- `htop` / `top` - System resources
- `systemctl status yavin-ai` - Service status
- Application logs - Error tracking
- Nginx access logs - Traffic patterns

### Database Integration (Future Enhancement)

Currently stateless. To add user progress tracking:

1. Add PostgreSQL dependency to `Cargo.toml`:
```toml
[dependencies]
sqlx = { version = "0.7", features = ["runtime-tokio-native-tls", "postgres"] }
```

2. Create database schema
3. Update handlers to persist quiz scores, progress, feedback

---

## 🐛 Troubleshooting

### Issue: "Address already in use"
**Solution**: Another process is using port 8080
```bash
# Find process using port 8080
lsof -i :8080
# Kill process
kill -9 <PID>
# Or use different port
PORT=3000 cargo run
```

### Issue: "Template error"
**Solution**: Templates directory missing or incorrect path
```bash
# Verify templates exist
ls -la templates/
# Ensure running from project root
pwd  # Should be /Users/wbj/Desktop/education
```

### Issue: "Static files not found"
**Solution**: Static directory missing or misconfigured
```bash
# Verify static files exist
ls -la static/css/
ls -la static/js/
ls -la static/*.png
```

### Issue: Compilation errors
**Solution**: Update Rust or check dependencies
```bash
# Update Rust
rustup update
# Clean and rebuild
cargo clean
cargo build
```

---

## 🚢 Pre-Launch Checklist

Before deploying to production:

- [ ] Run in release mode and test all pages
- [ ] Verify all images load correctly
- [ ] Test quiz functionality on Foundations and Ethics pages
- [ ] Test feedback form submission
- [ ] Test search functionality
- [ ] Test accessibility controls (contrast, TTS, translate)
- [ ] Test on multiple browsers (Chrome, Firefox, Safari)
- [ ] Test on mobile devices
- [ ] Test all navigation links
- [ ] Verify error handling (404 pages, etc.)
- [ ] Set up monitoring and logging
- [ ] Configure firewall rules
- [ ] Set up automated backups (if database added)
- [ ] Configure SSL/TLS certificates (Let's Encrypt)
- [ ] Set up CDN for static assets (optional, for scale)
- [ ] Load test with expected traffic
- [ ] Document rollback procedure

---

## 📈 Scaling Considerations

### Vertical Scaling (Single Server)
- Start with modest server (2 CPU, 4GB RAM)
- Monitor and upgrade as traffic grows
- Release build handles ~10,000 req/sec on modern hardware

### Horizontal Scaling (Multiple Servers)
- Stateless design enables easy replication
- Use load balancer (ALB, Nginx, HAProxy)
- Deploy multiple instances
- Consider CDN for static assets

### Performance Optimization
- Enable HTTP/2 in Nginx
- Implement caching headers
- Use CDN for static assets (Cloudflare, CloudFront)
- Consider server-side rendering cache
- Implement rate limiting to prevent abuse

---

## 📞 Support

For issues or questions:
1. Check this guide's troubleshooting section
2. Review application logs
3. Check Rust/Actix-web documentation
4. Open issue in project repository

---

## 🎉 Success!

Once running, you should see:
- Home page at `http://localhost:8080/`
- Fully functional navigation
- All 9 pages accessible (Home, Foundations, Learning, Neural, Deep, Modern, Ethics, Glossary, Mission)
- Interactive features working (search, quizzes, accessibility controls)
- Responsive design on all devices

**Your AI education platform is now live!** 🚀

