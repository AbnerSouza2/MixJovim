import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import hpp from 'hpp'
import { initializeDatabase } from './database/connection'
import authRoutes from './routes/auth'
import productRoutes from './routes/products'
import salesRoutes from './routes/sales'
import dashboardRoutes from './routes/dashboard'
import estoqueRoutes from './routes/estoque'
import { 
  generalRateLimit, 
  securityLogger, 
  payloadSizeLimit, 
  requireSecurityHeaders,
  constantTimeResponse
} from './middleware/security'

const app = express()
const PORT = 5001

// Configurar proxy trust para rate limiting funcionar corretamente atrás de proxies
app.set('trust proxy', 1)

// Middleware de Segurança - ORDEM IMPORTANTE
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false // Desabilitar para permitir imagens externas
}))

// Proteção contra HTTP Parameter Pollution
app.use(hpp())

// Rate Limiting geral
app.use(generalRateLimit)

// Logger de segurança
app.use(securityLogger)

// Timing attack protection
app.use(constantTimeResponse)

// Verificação de headers de segurança (removido para uploads funcionarem)
// app.use(requireSecurityHeaders)

// Limite de tamanho do payload - MUITO MAIOR para planilhas com 25k+ produtos
app.use(payloadSizeLimit(100 * 1024 * 1024)) // 100MB max para planilhas grandes

// CORS configurado de forma restritiva
app.use(cors({
  origin: function (origin, callback) {
    // Lista de origens permitidas
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3004',
      'http://localhost:3005'
    ]
    
    // Permitir requests sem origin (mobile apps, Postman, etc.) em desenvolvimento
    // ou quando NODE_ENV não está definido (desenvolvimento local)
    if (!origin && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV)) {
      return callback(null, true)
    }
    
    if (allowedOrigins.indexOf(origin!) !== -1) {
      callback(null, true)
    } else {
      console.log(`🚨 [CORS BLOCKED] Origin não permitida: ${origin}`)
      callback(new Error('Origem não permitida pelo CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']
}))

// Parser JSON com limite de tamanho aumentado para grandes importações
app.use(express.json({ 
  limit: '100mb',
  strict: true, // Apenas aceitar arrays e objects
  type: 'application/json'
}))

// Parser URL encoded (desabilitado por não ser necessário)
// app.use(express.urlencoded({ extended: false, limit: '1mb' }))

// Middleware para remover headers que expõem informações do servidor
app.use((req, res, next) => {
  res.removeHeader('X-Powered-By')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  next()
})

// Rotas
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/estoque', estoqueRoutes)

// Rota de teste - health check
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'API MixJovim funcionando!', 
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  })
})

// Middleware de erro com tratamento seguro
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log do erro (sem expor dados sensíveis)
  console.error(`🚨 [ERROR] ${new Date().toISOString()}`)
  console.error(`📍 URL: ${req.method} ${req.originalUrl}`)
  console.error(`🔍 Error: ${err.message}`)
  
  // Não expor stack trace em produção
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      timestamp: new Date().toISOString(),
      requestId: Math.random().toString(36).substr(2, 9)
    })
  } else {
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    })
  }
})

// Rota 404 - Sempre por último
app.use('*', (req, res) => {
  console.log(`🚨 [404] Rota não encontrada: ${req.method} ${req.originalUrl}`)
  res.status(404).json({ 
    error: 'Rota não encontrada',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  })
})

// Inicializar banco de dados e servidor
async function startServer() {
  try {
    await initializeDatabase()
    console.log('✅ Banco de dados conectado')
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`)
      console.log(`📊 API disponível em: http://localhost:${PORT}/api`)
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`)
      console.log(`🔒 Segurança ativada: Rate Limiting, Helmet, CORS, XSS Protection`)
    })

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🔄 SIGTERM recebido, finalizando servidor...')
      server.close(() => {
        console.log('✅ Servidor finalizado com sucesso')
        process.exit(0)
      })
    })

    process.on('SIGINT', () => {
      console.log('🔄 SIGINT recebido, finalizando servidor...')
      server.close(() => {
        console.log('✅ Servidor finalizado com sucesso')
        process.exit(0)
      })
    })

  } catch (error) {
    console.error('❌ Erro ao inicializar servidor:', error)
    process.exit(1)
  }
}

startServer() 