# Production Deployment Guide

## Prerequisites

1. **Server Requirements**
   - Ubuntu 22.04 LTS or newer
   - Minimum 4GB RAM, 2 CPU cores, 50GB SSD
   - Docker & Docker Compose v2 installed
   - Nginx installed (`apt install nginx`)
   - Domain name with DNS configured

2. **External Services**
   - Sui mainnet RPC access (or your own node)
   - Google OAuth credentials
   - Enoki API credentials (Mysten Labs)

## Deployment Steps

### 1. Clone Repository
```bash
git clone https://github.com/your-org/rosmar-crm.git
cd rosmar-crm
```

### 2. Environment Configuration
```bash
# Copy production env template
cp .env.production.example .env.production

# Edit with your values
nano .env.production

# Generate strong secrets
openssl rand -base64 32  # For JWT_SECRET, POSTGRES_PASSWORD, REDIS_PASSWORD
```

### 3. Deploy Move Contracts
```bash
# Build and deploy Move packages to Sui mainnet
cd packages/move
sui client publish --gas-budget 100000000 crm_core
sui client publish --gas-budget 100000000 crm_data
sui client publish --gas-budget 100000000 crm_vault
sui client publish --gas-budget 100000000 crm_action

# Copy package IDs and object IDs to .env.production
```

### 4. Start Services
```bash
# Load production env
export $(cat .env.production | xargs)

# Start with production config
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f
```

### 5. Database Migration
```bash
# Run Prisma migrations
docker compose -f docker-compose.prod.yml exec bff sh
npx prisma migrate deploy
exit
```

### 6. Configure Nginx
```bash
# Copy nginx config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/rosmar-crm

# Update domain name in config
sudo nano /etc/nginx/sites-available/rosmar-crm

# Enable site
sudo ln -s /etc/nginx/sites-available/rosmar-crm /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### 7. SSL Certificate (Let's Encrypt)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Auto-renewal is configured automatically
sudo certbot renew --dry-run
```

### 8. Verify Deployment
```bash
# Check service health
curl https://yourdomain.com/api/health
curl https://yourdomain.com

# Check logs
docker compose -f docker-compose.prod.yml logs bff
docker compose -f docker-compose.prod.yml logs frontend
```

## Security Checklist

- [ ] `.env.production` has strong passwords (min 16 chars)
- [ ] `.env.production` is NOT committed to git
- [ ] `SUI_DRY_RUN=false` in production
- [ ] SSL certificates configured and auto-renewing
- [ ] Database and Redis only accessible via internal network
- [ ] Firewall configured (only 80, 443, SSH open)
- [ ] Regular backups configured for PostgreSQL
- [ ] Sui private key backed up securely offline

## Monitoring

### Health Checks
```bash
# BFF health
curl https://yourdomain.com/api/health

# Frontend health
curl https://yourdomain.com
```

### Logs
```bash
# Application logs
docker compose -f docker-compose.prod.yml logs -f bff
docker compose -f docker-compose.prod.yml logs -f frontend

# Nginx logs
sudo tail -f /var/log/nginx/rosmar_access.log
sudo tail -f /var/log/nginx/rosmar_error.log
```

### Resource Usage
```bash
# Container stats
docker stats

# Disk usage
docker system df
```

## Backup & Restore

### Database Backup
```bash
# Backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U crm crm > backup-$(date +%Y%m%d).sql

# Restore
docker compose -f docker-compose.prod.yml exec -T postgres psql -U crm crm < backup-20260216.sql
```

### Volume Backup
```bash
# Backup volumes
docker run --rm -v rosmar-crm_pg_data:/data -v $(pwd):/backup ubuntu tar czf /backup/pg_data-$(date +%Y%m%d).tar.gz /data
docker run --rm -v rosmar-crm_redis_data:/data -v $(pwd):/backup ubuntu tar czf /backup/redis_data-$(date +%Y%m%d).tar.gz /data
```

## Troubleshooting

### Services Won't Start
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs

# Verify env vars
docker compose -f docker-compose.prod.yml config

# Restart services
docker compose -f docker-compose.prod.yml restart
```

### Database Connection Issues
```bash
# Check Postgres health
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U crm

# Verify DATABASE_URL
docker compose -f docker-compose.prod.yml exec bff env | grep DATABASE
```

### SSL Certificate Issues
```bash
# Test SSL
sudo nginx -t

# Renew manually
sudo certbot renew --force-renewal
```

## Scaling

### Horizontal Scaling (Multiple Instances)
```bash
# Scale BFF instances
docker compose -f docker-compose.prod.yml up -d --scale bff=3

# Update nginx upstream block with multiple servers
```

### Vertical Scaling (More Resources)
Edit resource limits in `docker-compose.prod.yml`:
```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
```

## Maintenance

### Update Application
```bash
# Pull latest code
git pull origin main

# Rebuild images
docker compose -f docker-compose.prod.yml build

# Restart services (zero-downtime with multiple instances)
docker compose -f docker-compose.prod.yml up -d --no-deps bff
docker compose -f docker-compose.prod.yml up -d --no-deps frontend
```

### Cleanup
```bash
# Remove old images
docker image prune -a

# Remove old volumes (CAREFUL!)
docker volume prune
```
