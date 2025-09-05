# Crypto Signals Trading Bot

A professional-grade cryptocurrency trading signals platform with real-time monitoring, wallet tracking, and 24/7 backend operation.

## 🚀 Features

- **24/7 Backend Operation**: Continuous signal detection and price monitoring using PM2
- **Real-time Dashboard**: Live updates via WebSocket connections
- **Professional UI**: Responsive design with modern components
- **Wallet Tracking**: Monitor multiple cryptocurrency wallets
- **Signal Detection**: Automated detection based on wallet consensus
- **Performance Analytics**: Track win rates, PnL, and trading metrics
- **Telegram Integration**: Automated notifications for new signals

## 🏗️ Architecture

### Backend Service (`backend/`)
- **Express.js API**: RESTful endpoints for data management
- **WebSocket Server**: Real-time data streaming to frontend
- **Worker Processes**: Automated signal detection and price updates
- **PM2 Process Manager**: Ensures 24/7 uptime and process management

### Frontend Dashboard (`src/`)
- **Next.js Application**: Modern React-based dashboard
- **Real-time Updates**: WebSocket integration with fallback polling
- **Responsive Design**: Mobile-first approach with professional styling
- **Component Library**: Shadcn/ui components with Tailwind CSS

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start the backend service (24/7 operation)
npm run backend:start

# Start the frontend dashboard
npm run dev
```

### Service Management

```bash
# Backend service management
npm run backend:start    # Start backend with PM2
npm run backend:stop     # Stop backend service
npm run backend:restart  # Restart backend service
npm run backend:status   # Check service status
npm run backend:logs     # View service logs

# Development mode (no PM2)
npm run backend:dev      # Run backend in development mode
```

## 📊 Dashboard Features

### Real-time Metrics
- **Total Unrealized ROI**: Live P&L from active signals
- **Win Rate**: Performance based on closed signals
- **Active Signals**: Currently monitored trading positions
- **Tracked Wallets**: Number of wallets being monitored

### Visual Analytics
- **Performance Chart**: Monthly win rate trends
- **Signal Outcomes**: Distribution of take profit, stop loss, and open positions
- **Recent Signals Table**: Latest trading signals with real-time updates

### Connection Status
- **Real-time Indicator**: WebSocket connection status
- **Fallback System**: Automatic polling when WebSocket is unavailable
- **Error Handling**: Graceful degradation with user notifications

## ⚙️ Configuration

### Settings (`settings.json`)
- `minWalletCount`: Minimum wallets required for signal consensus
- `timeWindow`: Time window for signal detection (minutes)
- `minVolume`: Minimum volume threshold for signals
- `walletPollInterval`: Wallet polling frequency (seconds)
- `pricePollInterval`: Price update frequency (seconds)
- `telegramBotToken`: Telegram bot token for notifications
- `telegramChannelIds`: Comma-separated channel IDs

### Environment Variables
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:3001/api)
- `NEXT_PUBLIC_WS_URL`: WebSocket URL (default: ws://localhost:3001)
- `PORT`: Backend server port (default: 3001)

## 🔧 API Endpoints

- `GET /api/dashboard` - Dashboard data
- `GET /api/signals` - Trading signals
- `GET /api/settings` - Configuration settings
- `POST /api/settings` - Update settings
- `GET /api/health` - Service health check
- `WS /` - WebSocket connection for real-time updates

## 📁 Project Structure

```
├── backend/                 # Backend service
│   ├── server.js           # Main server with WebSocket support
│   ├── signal-worker.js    # Signal detection logic
│   ├── dashboard-data.js   # Dashboard data aggregation
│   ├── settings-manager.js # Settings management
│   └── logger.js          # Logging utilities
├── src/                    # Frontend application
│   ├── app/               # Next.js app directory
│   ├── components/        # React components
│   ├── hooks/             # Custom React hooks
│   └── lib/               # Utilities and API services
├── ecosystem.config.js     # PM2 configuration
└── package.json           # Dependencies and scripts
```

## 🚀 Deployment

The application is designed for production deployment with:

1. **Process Management**: PM2 ensures automatic restarts and 24/7 operation
2. **Error Handling**: Comprehensive error handling and logging
3. **Real-time Updates**: WebSocket connections with fallback mechanisms
4. **Scalability**: Modular architecture for easy scaling

## 📝 License

This project is private and proprietary.

## 🤝 Support

For support and questions, please contact the development team.
