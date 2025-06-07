import express from 'express'
import cors from 'cors'
import { initializeDatabase } from './database/connection'
import authRoutes from './routes/auth'
import productRoutes from './routes/products'
import salesRoutes from './routes/sales'
import dashboardRoutes from './routes/dashboard'

const app = express()
const PORT = process.env.PORT || 5001

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003', 'http://localhost:3004'],
  credentials: true
}))
app.use(express.json())

// Rotas
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/dashboard', dashboardRoutes)

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ message: 'API MixJovim funcionando!', timestamp: new Date() })
})

// Middleware de erro
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Erro:', err)
  res.status(500).json({ 
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado'
  })
})

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' })
})

// Inicializar banco de dados e servidor
async function startServer() {
  try {
    await initializeDatabase()
    console.log('✅ Banco de dados conectado')
    
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`)
      console.log(`📊 API disponível em: http://localhost:${PORT}/api`)
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`)
    })
  } catch (error) {
    console.error('❌ Erro ao inicializar servidor:', error)
    process.exit(1)
  }
}

startServer() 