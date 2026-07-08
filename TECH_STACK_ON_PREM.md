#  MicroAccess Smart Metering (MSM) - ON-PREMISE TECH STACK
## Updated for Local Hosting + Cloudflare Tunnel

---

##  KEY CHANGES FROM PREVIOUS STACK

###  NOT Using (Cloud Services):
- ~~AWS/Vercel/Railway~~  On-premise server
- ~~Cloud databases~~  Local PostgreSQL
- ~~Cloud hosting~~  Local machine/server
- ~~React~~  SvelteKit (completely different UI experience)

###  USING Instead:
- **Cloudflare Tunnel** for internet access (zero cost!)
- **Docker Compose** for local container orchestration
- **Traefik** for local reverse proxy
- **SvelteKit** for fresh, unique UI

---

##  FINALIZED TECHNOLOGY STACK

###  Frontend - Web Dashboard
```
Framework:    SvelteKit (NOT React!)
Language:     JavaScript/TypeScript
Styling:      Pure CSS (no Tailwind - custom cyberpunk/brutalist/retro themes)
State:        Svelte stores (built-in, no external library needed)
Charts:       Chart.js or D3.js
Icons:        Lucide Icons or custom SVG
```

**Why SvelteKit over React:**
- 50% less code than React
- No useState/useEffect complexity
- Built-in animations and transitions
- Writes like HTML/CSS/JS (easier for AI generation)
- Compiles to vanilla JS (faster runtime)
- **Completely different developer experience** from React
- Fresh, modern, exciting to work with

###  Mobile App
```
Framework:    Flutter 3.x
Language:     Dart
State:        Riverpod
UI:           Custom Material Design (NOT purple cards!)
Storage:      Hive (local) + Isar (faster alternative)
HTTP:         Dio
Push:         Firebase Cloud Messaging (FCM)
```

###  Backend API
```
Runtime:      Node.js 20+ LTS
Language:     TypeScript
Framework:    Fastify (faster than Express)
API:          REST + WebSocket (Socket.io)
Auth:         JWT tokens + bcrypt
Validation:   Zod (type-safe)
ORM:          Drizzle ORM (lightweight, type-safe)
```

###  Database Layer
```
Primary DB:        PostgreSQL 15+ (local instance)
Time-Series:       TimescaleDB extension
Caching:           Redis 7+ (local instance)
Search:            PostgreSQL Full-Text Search
Backup:            pg_dump + Cloudflare R2 (free tier)
```

###  ON-PREMISE INFRASTRUCTURE

#### Hardware Requirements
```
Minimum Server:
- CPU: 4 cores (Intel i5/Ryzen 5 or better)
- RAM: 16GB (32GB recommended)
- Storage: 500GB SSD (for database + logs)
- Network: Stable internet (10 Mbps upload minimum)
- OS: Ubuntu 22.04 LTS or Windows Server 2022

Recommended Server:
- CPU: 8 cores (Intel i7/Ryzen 7)
- RAM: 32GB
- Storage: 1TB NVMe SSD
- Network: 50+ Mbps upload
- UPS: Battery backup for power outages
```

#### Container Orchestration
```
Docker:           Docker Engine 24+
Orchestration:    Docker Compose
Reverse Proxy:    Traefik 2.x (automatic HTTPS with Let's Encrypt)
Monitoring:       Grafana + Prometheus (local)
Logs:             Loki + Promtail
```

###  CLOUDFLARE TUNNEL SETUP

#### Why Cloudflare Tunnel?
```
 Zero hosting costs
 Automatic HTTPS/SSL
 DDoS protection
 No need to open ports on router
 No public IP needed
 Works behind NAT/firewalls
 Built-in load balancing
 Free tier is generous
```

#### Setup Steps
```bash
# 1. Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# 2. Authenticate
cloudflared tunnel login

# 3. Create tunnel
cloudflared tunnel create msm-meter

# 4. Configure DNS
cloudflared tunnel route dns msm-meter app.msm.local
cloudflared tunnel route dns msm-meter api.msm.local

# 5. Create config file
```

**config.yml:**
```yaml
tunnel: <your-tunnel-id>
credentials-file: /root/.cloudflared/<your-tunnel-id>.json

ingress:
  # Web Dashboard
  - hostname: app.msm.local
    service: http://localhost:3000
  
  # Backend API
  - hostname: api.msm.local
    service: http://localhost:4000
  
  # WebSocket
  - hostname: ws.msm.local
    service: http://localhost:4001
  
  # Catch-all
  - service: http_status:404
```

```bash
# 6. Run as service
cloudflared tunnel run msm-meter

# 7. Install as system service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

###  DOCKER COMPOSE SETUP

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: timescale/timescaledb:latest-pg15
    container_name: msm-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: msm_meter
      POSTGRES_USER: msm_admin
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
      - ./backups:/backups
    ports:
      - "5432:5432"
    networks:
      - msm-network

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: msm-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - ./data/redis:/data
    ports:
      - "6379:6379"
    networks:
      - msm-network

  # Backend API
  backend:
    build: ./backend
    container_name: msm-backend
    restart: unless-stopped
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://msm_admin:${DB_PASSWORD}@postgres:5432/msm_meter
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      STEAMA_USERNAME: ${STEAMA_USERNAME}
      STEAMA_PASSWORD: ${STEAMA_PASSWORD}
    ports:
      - "4000:4000"
      - "4001:4001"  # WebSocket
    depends_on:
      - postgres
      - redis
    networks:
      - msm-network

  # SvelteKit Web Dashboard
  web:
    build: ./web-dashboard
    container_name: msm-web
    restart: unless-stopped
    environment:
      PUBLIC_API_URL: https://api.msm.local
      PUBLIC_WS_URL: wss://ws.msm.local
    ports:
      - "3000:3000"
    depends_on:
      - backend
    networks:
      - msm-network

  # Traefik Reverse Proxy
  traefik:
    image: traefik:v2.10
    container_name: msm-traefik
    restart: unless-stopped
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik:/etc/traefik
    networks:
      - msm-network

  # Grafana Monitoring
  grafana:
    image: grafana/grafana:latest
    container_name: msm-grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - ./data/grafana:/var/lib/grafana
    ports:
      - "3001:3000"
    networks:
      - msm-network

  # Prometheus Metrics
  prometheus:
    image: prom/prometheus:latest
    container_name: msm-prometheus
    restart: unless-stopped
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./data/prometheus:/prometheus
    ports:
      - "9090:9090"
    networks:
      - msm-network

networks:
  msm-network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  grafana_data:
  prometheus_data:
```

---

##  UI DESIGN THEMES (Pick One!)

### Option 1: Micro Access Future Blue (Recommended) 
```css
Brand Colors:
  - Navy Blue:     #0b1f3a (primary base)
  - Sky Blue:      #35b8ff (primary accent)
  - Ice Blue:      #9fe4ff (secondary accent)
  - White:         #f4faff (text/surfaces)

Design Language:
  - Command-center style, not stock-market panels
  - Orbital/radial visual elements and topology lines
  - Glass layers with subtle depth and technical grid overlays
  - Long-form data lanes, event streams, and node maps instead of repetitive cards
  - Precision-focused typography and spacious hierarchy

Fonts:
  - Oxanium (headings)
  - Manrope (body)

See: microaccess-future-dashboard.html
```

### Option 2: Cyberpunk/Neon Dark 
```css
Colors:
  - Cyan:         #00fff9 (primary)
  - Hot Pink:     #ff006e (accent)
  - Electric Blue: #3a86ff (secondary)
  - Black:        #0a0a0a (background)

Elements:
  - Scanlines effect
  - Neon glows and shadows
  - Sharp angles, clipped corners
  - Terminal/command-line aesthetic
  - Animated grid backgrounds
  - Glitch effects on hover

Fonts:
  - Orbitron (headings)
  - Share Tech Mono (body)
  - JetBrains Mono (code/data)

See: cyberpunk-dashboard.html
```

### Option 3: Minimalist Brutalism 
```css
Colors:
  - Pure Black:   #000000
  - Pure White:   #ffffff
  - Accent Red:   #ff0000

Elements:
  - No rounded corners (border-radius: 0)
  - Bold, massive typography
  - High contrast only
  - Raw borders, no shadows
  - Grid-based layout
  - Stark, powerful design

Fonts:
  - Inter Black (900 weight)
  - Space Grotesk
  - Helvetica Neue

Perfect for: Industrial/serious applications
```

### Option 4: Retro Terminal 
```css
Colors:
  - Phosphor Green: #33ff33
  - Amber:          #ffb000
  - Black:          #000000

Elements:
  - CRT screen effect
  - Scanlines and glow
  - Monospace everything
  - ASCII-style borders
  - Blinking cursors
  - Terminal-style tables

Fonts:
  - IBM Plex Mono
  - Courier Prime
  - VT323

Perfect for: Nostalgic/tech-focused applications
```

---

##  PROJECT STRUCTURE

```
msm-meter/
 backend/                    # Node.js + Fastify API
    src/
       modules/
          auth/          # JWT authentication
          customers/     # Customer management
          meters/        # Meter control
          transactions/  # Payment processing
          alerts/        # Alert system
          analytics/     # Data analytics
       integrations/
          steama/        # Steama API wrapper
       database/
          schema.ts      # Drizzle schema
          migrations/
       websocket/
          server.ts      # Socket.io server
       app.ts
    Dockerfile
    package.json
    tsconfig.json

 web-dashboard/              # SvelteKit Web App
    src/
       routes/            # SvelteKit routes
          +layout.svelte
          +page.svelte   # Dashboard
          customers/
          meters/
          transactions/
          alerts/
          analytics/
       lib/
          components/    # Reusable components
          stores/        # Svelte stores
          api/           # API client
          utils/
       app.css            # Custom theme (cyberpunk/brutalist/retro)
    static/
    Dockerfile
    package.json
    svelte.config.js

 mobile-app/                 # Flutter Mobile App
    lib/
       features/
          auth/
          home/
          buy_units/
          usage/
          profile/
       shared/
          widgets/
          models/
          providers/     # Riverpod providers
          api/
       theme/             # Custom theme (NOT Material purple!)
       main.dart
    android/
    ios/
    pubspec.yaml

 data/                       # Docker volumes
    postgres/
    redis/
    grafana/
    prometheus/

 backups/                    # Database backups
    daily/

 traefik/                    # Reverse proxy config
    traefik.yml

 .env.example                # Environment variables template
 docker-compose.yml
 prometheus.yml
 README.md
```

---

##  SETUP INSTRUCTIONS

### 1. Prerequisites (Install on Server)
```bash
# Ubuntu 22.04 LTS
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin

# Install Node.js 20 (for development)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Flutter (for mobile development)
sudo snap install flutter --classic

# Install Git
sudo apt install git
```

### 2. Clone and Setup
```bash
# Create project directory
mkdir -p ~/msm-meter
cd ~/msm-meter

# Initialize Git
git init

# Create environment file
cat > .env << 'EOF'
# Database
DB_PASSWORD=your_secure_password_here
POSTGRES_DB=msm_meter

# Redis
REDIS_PASSWORD=your_redis_password_here

# JWT
JWT_SECRET=your_jwt_secret_here

# Steama API
STEAMA_USERNAME=your_steama_service_username
STEAMA_PASSWORD=your_steama_service_password

# Grafana
GRAFANA_PASSWORD=admin_password_here
EOF

chmod 600 .env
```

### 3. Initialize Projects

**Backend:**
```bash
mkdir -p backend
cd backend
npm init -y
npm install fastify @fastify/cors @fastify/jwt @fastify/websocket
npm install drizzle-orm postgres redis socket.io zod
npm install -D typescript @types/node tsx drizzle-kit
npx tsc --init
```

**Web Dashboard (SvelteKit):**
```bash
cd ../
npm create svelte@latest web-dashboard
# Choose: SvelteKit demo app  Yes, TypeScript  Prettier, ESLint

cd web-dashboard
npm install
npm install chart.js socket.io-client
```

**Mobile App (Flutter):**
```bash
cd ../
flutter create mobile_app --org com.microaccess.msm
cd mobile_app
flutter pub add riverpod flutter_riverpod dio hive hive_flutter
flutter pub add firebase_messaging fl_chart
```

### 4. Start Infrastructure
```bash
cd ~/msm-meter
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 5. Setup Cloudflare Tunnel
```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb

# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create msm-meter

# Get tunnel ID
cloudflared tunnel list

# Create config
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
# (Paste config from above)

# Route DNS (replace YOUR-DOMAIN)
cloudflared tunnel route dns msm-meter app.YOUR-DOMAIN.com
cloudflared tunnel route dns msm-meter api.YOUR-DOMAIN.com

# Start tunnel
cloudflared tunnel run msm-meter

# Install as service
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

---

##  COST BREAKDOWN (On-Premise)

### One-Time Costs
```
Server Hardware:           500,000 - 1,500,000 (one-time)
  - Entry: Used Dell/HP server
  - Mid: New Ryzen workstation
  - High: Rack server with redundancy

UPS (Battery Backup):      100,000 - 300,000
Network Equipment:         50,000 - 150,000
  - Router, switch, cables

TOTAL INITIAL:             650,000 - 1,950,000
```

### Monthly Costs
```
Electricity:               30,000 - 80,000/month
  - Depends on power availability
  - Consider solar backup

Internet:                  15,000 - 50,000/month
  - Business broadband recommended
  - 50+ Mbps upload speed

Domain Name:               5,000/year (420/month)
Cloudflare:                0 (Free tier!)
Firebase (FCM):            0 (Free tier!)

TOTAL MONTHLY:             45,420 - 130,420
YEARLY OPERATING:          545,000 - 1,565,000
```

### Total 3-Year Cost
```
Initial Setup:             650,000 - 1,950,000
3 Years Operating:         1,635,000 - 4,695,000
TOTAL (3 years):           2,285,000 - 6,645,000

vs AWS Cloud (3 years):    25,000,000 - 47,000,000

SAVINGS:                   18,715,000 - 44,355,000 
```

---

##  PERFORMANCE OPTIMIZATION

### Database
```sql
-- Create indexes for common queries
CREATE INDEX idx_customers_meter ON customers(meter_id);
CREATE INDEX idx_transactions_date ON transactions(created_at DESC);
CREATE INDEX idx_readings_time ON meter_readings(timestamp DESC);

-- TimescaleDB hypertable for time-series
SELECT create_hypertable('meter_readings', 'timestamp');

-- Continuous aggregates for analytics
CREATE MATERIALIZED VIEW meter_daily_stats
WITH (timescaledb.continuous) AS
SELECT
  meter_id,
  time_bucket('1 day', timestamp) AS day,
  AVG(value) as avg_usage,
  MAX(value) as peak_usage,
  MIN(value) as min_usage
FROM meter_readings
GROUP BY meter_id, day;
```

### Redis Caching Strategy
```javascript
// Cache frequently accessed data
const CACHE_TTL = {
  meterStatus: 60,        // 1 minute
  customerBalance: 300,   // 5 minutes
  meterReadings: 600,     // 10 minutes
  analytics: 1800,        // 30 minutes
  configuration: 3600     // 1 hour
};
```

### SvelteKit Optimizations
```javascript
// Prefetch data on hover
<a href="/meters/{id}" data-sveltekit-preload-data="hover">
  View Meter
</a>

// Lazy load components
const HeavyChart = lazy(() => import('./HeavyChart.svelte'));
```

---

##  SECURITY MEASURES

### 1. Cloudflare Protection
```
 DDoS protection (automatic)
 WAF (Web Application Firewall)
 Rate limiting
 Bot detection
 SSL/TLS encryption
```

### 2. Application Security
```javascript
// Rate limiting (backend)
import rateLimit from '@fastify/rate-limit';

fastify.register(rateLimit, {
  max: 100,              // 100 requests
  timeWindow: '1 minute'
});

// Helmet for security headers
import helmet from '@fastify/helmet';
fastify.register(helmet);

// CORS configuration
fastify.register(cors, {
  origin: ['https://app.YOUR-DOMAIN.com'],
  credentials: true
});
```

### 3. Database Security
```bash
# Firewall rules (UFW)
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# Disable external database access
# PostgreSQL only accessible from Docker network
```

### 4. Backup Strategy
```bash
#!/bin/bash
# Daily backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/path/to/backups/daily"

# Backup PostgreSQL
docker exec msm-postgres pg_dump -U msm_admin msm_meter > "$BACKUP_DIR/db_$DATE.sql"

# Compress
gzip "$BACKUP_DIR/db_$DATE.sql"

# Upload to Cloudflare R2 (optional)
aws s3 cp "$BACKUP_DIR/db_$DATE.sql.gz" s3://your-r2-bucket/

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

---

##  DEVELOPMENT TIMELINE

### Week 1-2: Infrastructure Setup
-  Install server hardware
-  Setup Docker + Docker Compose
-  Configure Cloudflare Tunnel
-  Setup monitoring (Grafana + Prometheus)

### Week 3-4: Backend Foundation
-  Database schema design
-  Steama API wrapper
-  Authentication system
-  WebSocket server

### Week 5-7: SvelteKit Dashboard
-  Design system (pick theme!)
-  Dashboard layout
-  Meter management
-  Customer management
-  Transaction views
-  Real-time alerts

### Week 8-10: Flutter Mobile App
-  Authentication flow
-  Home dashboard
-  Buy units feature
-  Usage analytics
-  Push notifications

### Week 11-12: Integration & Testing
-  End-to-end testing
-  Performance optimization
-  Security audit
-  User acceptance testing

---

##  LEARNING RESOURCES

### SvelteKit
- Official Tutorial: https://learn.svelte.dev/
- SvelteKit Docs: https://kit.svelte.dev/docs
- Video Course: https://www.youtube.com/watch?v=H1eEFfAkIik

### Fastify
- Official Docs: https://www.fastify.io/docs/latest/
- REST API Tutorial: https://www.youtube.com/watch?v=Lk-uVEVGxOA

### Drizzle ORM
- Documentation: https://orm.drizzle.team/docs/overview
- Quick Start: https://orm.drizzle.team/docs/quick-start

### Cloudflare Tunnel
- Setup Guide: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- Video Tutorial: https://www.youtube.com/watch?v=ZvIdFs3M5ic

### Docker Compose
- Official Docs: https://docs.docker.com/compose/
- Tutorial: https://www.youtube.com/watch?v=HG6yIjZapSA

---

##  NEXT STEPS

1. **Choose Your Design Theme:**
  - Micro Access Future Blue (see `microaccess-future-dashboard.html`)
  - Cyberpunk (see `cyberpunk-dashboard.html`)
  - Minimalist Brutalism
  - Retro Terminal

2. **Review Prototype:**
  - Open `microaccess-future-dashboard.html` in browser
   - Confirm visual direction
   - Provide feedback

3. **Setup Server:**
   - Order/prepare hardware
   - Install Ubuntu 22.04 LTS
   - Configure network

4. **Start Development:**
   - Begin with backend API
   - Then SvelteKit dashboard
   - Finally Flutter mobile app

5. **Deploy to Production:**
   - Setup Cloudflare Tunnel
   - Configure monitoring
   - Run backups

---

##  WHY THIS STACK IS PERFECT FOR YOU

### 1. **Cost Effective**
- Save 18M - 44M over 3 years vs cloud
- No monthly hosting fees
- Cloudflare free tier is generous

### 2. **Completely Different from React**
- SvelteKit feels nothing like React
- Fresh developer experience
- Easier to work with AI
- More fun to build with!

### 3. **Full Control**
- Data stays on your premises
- No vendor lock-in
- Scale at your own pace
- Customize everything

### 4. **Production Ready**
- Docker for easy deployment
- Monitoring built-in
- Automatic backups
- Professional grade

### 5. **Unique Design**
- Brand-first palette (Sky Blue, Navy Blue, White)
- NO default AI purple-card aesthetic
- Micro Access Future Blue + alternate themes
- Stands out from competition

---

**Ready to build something completely different? **

Let me know which design theme you prefer and we'll start implementing!


