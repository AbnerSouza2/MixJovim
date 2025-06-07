import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { getDatabase } from '../database/connection'

export interface AuthRequest extends Request {
  user?: {
    id: number
    username: string
    role: 'admin' | 'funcionario'
    permissions?: {
      pdv: boolean
      products: boolean
      dashboard: boolean
      reports: boolean
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'mixjovim_jwt_secret_key_2024'

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    
    // Buscar usuário no banco de dados
    const db = getDatabase()
    const user = await db.get(
      'SELECT id, username, role, permissions FROM users WHERE id = ?',
      [decoded.userId]
    )
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' })
    }
    
    // Parse permissions
    let permissions = {}
    try {
      permissions = user.permissions ? JSON.parse(user.permissions) : {
        pdv: false,
        products: false,
        dashboard: false,
        reports: false
      }
    } catch (e) {
      permissions = {
        pdv: false,
        products: false,
        dashboard: false,
        reports: false
      }
    }

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role,
      permissions
    }
    
    next()
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido' })
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas administradores.' })
  }
  next()
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' })
} 