import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getDatabase } from '../database/connection'

export interface AuthRequest extends Request {
  user?: {
    id: number
    username: string
    role: 'admin' | 'gerente' | 'funcionario'
    permissions?: {
      pdv: boolean
      products: boolean
      dashboard: boolean
      reports: boolean
      estoque: boolean
      funcionarios: boolean
      financeiro: boolean
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'mixjovim_jwt_secret_key_2024'

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  console.log('🔐 Verificando autenticação para:', req.path)
  console.log('🔑 Token presente:', !!token)

  if (!token) {
    console.log('❌ Token não fornecido')
    return res.status(401).json({ error: 'Token de acesso requerido' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    console.log('✅ Token válido para userId:', decoded.userId)
    
    // Buscar usuário no banco de dados
    const db = getDatabase()
    const [userRows] = await db.execute(
      'SELECT id, username, role, permissions FROM users WHERE id = ?',
      [decoded.userId]
    )
    
    const users = userRows as any[]
    const user = users[0]
    
    if (!user) {
      console.log('❌ Usuário não encontrado no banco:', decoded.userId)
      return res.status(401).json({ error: 'Usuário não encontrado' })
    }
    
    console.log('👤 Usuário encontrado:', user.username, 'Role:', user.role)
    
    // Parse permissions
    let permissions = {}
    try {
      if (typeof user.permissions === 'string') {
        permissions = JSON.parse(user.permissions)
      } else if (typeof user.permissions === 'object' && user.permissions !== null) {
        permissions = user.permissions
      } else {
        permissions = {
          pdv: false,
          products: false,
          dashboard: true, // Dashboard obrigatório para todos
          reports: false,
          estoque: false,
          funcionarios: false,
          financeiro: false
        }
      }
    } catch (e) {
      console.log('⚠️ Erro ao parsear permissões, usando padrão')
      permissions = {
        pdv: false,
        products: false,
        dashboard: true, // Dashboard obrigatório para todos
        reports: false,
        estoque: false,
        funcionarios: false,
        financeiro: false
      }
    }
    
    // Garantir que Dashboard sempre seja true
    permissions.dashboard = true

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions
    }
    
    console.log('✅ Usuário autenticado:', req.user.username, 'Permissões:', req.user.permissions)
    next()
  } catch (error) {
    console.log('❌ Token inválido:', error.message)
    return res.status(403).json({ error: 'Token inválido' })
  }
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' })
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' })
  }
  next()
}

export function checkPermission(permission: keyof AuthRequest['user']['permissions']) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    console.log(`🔍 Verificando permissão '${permission}' para usuário:`, req.user?.username)
    
    if (req.user?.role === 'admin') {
      console.log('✅ Admin tem todas as permissões')
      // Admin tem todas as permissões
      return next()
    }

    if (req.user?.role === 'gerente') {
      // Gerente tem acesso automático a funcionários e financeiro
      if (permission === 'funcionarios' || permission === 'financeiro') {
        console.log('✅ Gerente tem acesso automático a:', permission)
        return next()
      }
      
      // Para outras permissões, verificar se tem a permissão específica
      if (req.user?.permissions?.[permission]) {
        console.log('✅ Gerente tem permissão específica:', permission)
        return next()
      }
    }

    if (req.user?.role === 'funcionario') {
      // Funcionário precisa ter a permissão específica
      if (!req.user?.permissions?.[permission]) {
        console.log('❌ Funcionário não tem permissão:', permission)
        return res.status(403).json({ error: `Acesso negado. Permissão '${permission}' necessária.` })
      }
      console.log('✅ Funcionário tem permissão:', permission)
      return next()
    }

    console.log('❌ Acesso negado para permissão:', permission)
    return res.status(403).json({ error: `Acesso negado. Permissão '${permission}' necessária.` })
  }
}

export function requireAdminOrManager(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin' || req.user?.role === 'gerente') {
    return next()
  }
  return res.status(403).json({ error: 'Acesso negado. Apenas administradores e gerentes.' })
} 