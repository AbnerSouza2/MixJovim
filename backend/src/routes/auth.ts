import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDatabase } from '../database/connection'
import { authenticateToken, AuthRequest, generateToken, requireAdmin } from '../middleware/auth'

const router = Router()

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' })
    }

    const db = getDatabase()
    const [userRows] = await db.execute(
      'SELECT id, username, password, role, permissions FROM users WHERE username = ?',
      [username]
    )

    const users = userRows as any[]
    const user = users[0]

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    const token = generateToken(user.id)

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
          dashboard: false,
          reports: false
        }
      }
    } catch (e) {
      console.error('Erro ao parsear permissões:', e)
      permissions = {
        pdv: false,
        products: false,
        dashboard: false,
        reports: false
      }
    }

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions
      }
    })
  } catch (error) {
    console.error('Erro no login:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Verificar token
router.get('/verify', authenticateToken, (req: AuthRequest, res) => {
  res.json({ 
    valid: true, 
    user: req.user 
  })
})

// Criar usuário (apenas admin)
router.post('/users', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { username, password, role = 'funcionario', permissions } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' })
    }

    if (role !== 'admin' && role !== 'funcionario') {
      return res.status(400).json({ error: 'Função inválida' })
    }

    const db = getDatabase()
    
    // Verificar se usuário já existe
    const [existingRows] = await db.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    )

    const existingUsers = existingRows as any[]
    if (existingUsers.length > 0) {
      return res.status(409).json({ error: 'Usuário já existe' })
    }

    // Preparar permissões
    const userPermissions = permissions || {
      pdv: false,
      products: false,
      dashboard: false,
      reports: false
    }

    // Criar usuário
    const hashedPassword = await bcrypt.hash(password, 10)
    const [result] = await db.execute(
      'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, role, JSON.stringify(userPermissions)]
    )

    const insertResult = result as any
    const userId = insertResult.insertId

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: {
        id: userId,
        username,
        role,
        permissions: userPermissions
      }
    })
  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Listar usuários (apenas admin)
router.get('/users', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const db = getDatabase()
    const [userRows] = await db.execute(
      'SELECT id, username, role, permissions, created_at FROM users ORDER BY created_at DESC'
    )

    const users = userRows as any[]
    const formattedUsers = users.map((user: any) => {
      let permissions = {}
      try {
        permissions = user.permissions || {
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

      return {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions,
        created_at: user.created_at
      }
    })

    res.json(formattedUsers)
  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Atualizar usuário (apenas admin)
router.put('/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { username, password, role, permissions } = req.body

    const db = getDatabase()
    
    // Verificar se usuário existe
    const [existingRows] = await db.execute(
      'SELECT id FROM users WHERE id = ?',
      [id]
    )

    const existingUsers = existingRows as any[]
    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    // Preparar dados para atualização
    const updates = []
    const values = []

    if (username) {
      updates.push('username = ?')
      values.push(username)
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10)
      updates.push('password = ?')
      values.push(hashedPassword)
    }

    if (role) {
      updates.push('role = ?')
      values.push(role)
    }

    if (permissions) {
      updates.push('permissions = ?')
      values.push(JSON.stringify(permissions))
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    }

    values.push(id)

    await db.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    res.json({ message: 'Usuário atualizado com sucesso' })
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Deletar usuário (apenas admin)
router.delete('/users/:id', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    // Impedir que o admin delete a si mesmo
    if (req.user?.id === parseInt(id)) {
      return res.status(400).json({ error: 'Não é possível deletar seu próprio usuário' })
    }

    const db = getDatabase()
    
    // Verificar se usuário existe
    const [existingRows] = await db.execute(
      'SELECT id FROM users WHERE id = ?',
      [id]
    )

    const existingUsers = existingRows as any[]
    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    await db.execute('DELETE FROM users WHERE id = ?', [id])

    res.json({ message: 'Usuário deletado com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar usuário:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router 