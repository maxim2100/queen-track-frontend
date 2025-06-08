# Queen Track Frontend

A modern React application for tracking and monitoring with camera integration and real-time WebSocket communication.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. **Clone and install dependencies:**

   ```bash
   git clone <repository-url>
   cd queen-track-frontend
   npm install --legacy-peer-deps
   ```

2. **Set up environment:**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server:**

   ```bash
   npm start
   ```

4. **Run tests:**
   ```bash
   npm test
   ```

## 🏗️ Building for Production

```bash
npm run build:production
```

## 🚢 Deployment

### Automatic Deployment (Recommended)

1. **Set up GitHub secrets:**

   - Go to Repository Settings > Secrets and variables > Actions
   - Add: `SERVER_PASSWORD` = your server password

2. **Deploy via Git:**

   ```bash
   # Deploy to staging
   git push origin develop

   # Deploy to production
   git push origin main
   ```

### Manual Deployment

1. **Set up credentials:**

   ```bash
   export SERVER_PASSWORD='your-server-password'
   ```

2. **Deploy:**
   ```bash
   ./scripts/deploy.sh production  # or staging
   ```

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## 🧪 Testing

- **Unit tests:** `npm run test:unit`
- **Integration tests:** `npm run test:integration`
- **All tests:** `npm run test:ci`
- **Coverage:** `npm run test:coverage`

## 🏗️ Project Structure

```
src/
├── components/         # Reusable UI components
├── pages/             # Page components
├── utils/             # Utility functions
├── __tests__/         # Test files
└── styles/            # CSS files
```

## 🔧 Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run deploy:staging` - Deploy to staging
- `npm run deploy:production` - Deploy to production

## 🌐 Environment Configuration

The application supports multiple environments:

- **Development:** Local development with hot reloading
- **Staging:** Testing environment (port 3002)
- **Production:** Live environment (port 3001)

## 🔒 Security

- Never commit sensitive data (passwords, keys) to version control
- Use environment variables for configuration
- Use GitHub secrets for CI/CD credentials
- Regular dependency updates via `npm audit`

## 📊 Monitoring

- Health checks available at `/health`
- Application monitoring via browser dev tools
- Server logs in `/var/log/nginx/`

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Add tests
4. Submit a pull request

## 📞 Support

For issues and questions:

1. Check the [DEPLOYMENT.md](./DEPLOYMENT.md) guide
2. Review GitHub Actions logs
3. Check server logs
4. Contact the development team

---

**Live URLs:**

- Production: http://162.55.53.52:3001
- Staging: http://162.55.53.52:3002
