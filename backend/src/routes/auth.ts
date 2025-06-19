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
      let permissions = {
        pdv: false,
        products: false,
        dashboard: false,
        reports: false,
        estoque: false,
        funcionarios: false
      }

      try {
        if (typeof user.permissions === 'string') {
          // Primeiro, vamos tentar corrigir strings malformadas
          let permissionsString = user.permissions
          
          // Se a string tem índices numéricos, extrair apenas a parte JSON válida
          if (permissionsString.includes('"0":')) {
            console.log('Detectada string malformada para usuário:', user.username)
            
            // Extrair as permissões reais do final da string
            // Procurar por padrão: "pdv":true/false,"products":true/false, etc.
            const permissionPattern = /"pdv":(true|false),"products":(true|false),"dashboard":(true|false),"reports":(true|false),"estoque":(true|false)/
            const validMatch = permissionsString.match(permissionPattern)
            
            if (validMatch) {
              // Extrair toda a parte das permissões válidas até o final
              const startIndex = permissionsString.indexOf('"pdv":')
              if (startIndex > -1) {
                const endPart = permissionsString.substring(startIndex)
                // Procurar pelo fechamento do JSON
                const endIndex = endPart.lastIndexOf('}')
                if (endIndex > -1) {
                  permissionsString = '{' + endPart.substring(0, endIndex + 1)
                  console.log('JSON corrigido:', permissionsString)
                }
              }
            } else {
              console.log('Não foi possível extrair permissões válidas, usando padrão')
              // Usar permissões padrão
              permissionsString = JSON.stringify(permissions)
            }
          }
          
          const parsedPermissions = JSON.parse(permissionsString)
          permissions = { ...permissions, ...parsedPermissions }
        } else if (typeof user.permissions === 'object' && user.permissions !== null) {
          permissions = { ...permissions, ...user.permissions }
        }
      } catch (e) {
        console.error('Erro ao parsear permissões do usuário:', user.username, 'Error:', e)
        console.error('Permissions raw:', user.permissions)
        // Mantém as permissões padrão
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

// Corrigir permissões corrompidas (apenas admin)
router.post('/fix-permissions', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const db = getDatabase()
    
    // Buscar todos os usuários
    const [userRows] = await db.execute('SELECT id, username, permissions FROM users')
    const users = userRows as any[]
    
    let fixedCount = 0
    
    for (const user of users) {
      if (typeof user.permissions === 'string' && user.permissions.includes('"0":')) {
        console.log(`Corrigindo permissões do usuário: ${user.username}`)
        
        // Extrair permissões válidas ou usar padrão
        let cleanPermissions = {
          pdv: false,
          products: false,
          dashboard: false,
          reports: false,
          estoque: false,
          funcionarios: false
        }
        
        // Tentar extrair valores reais se possível
        try {
          if (user.permissions.includes('"pdv":true')) cleanPermissions.pdv = true
          if (user.permissions.includes('"products":true')) cleanPermissions.products = true
          if (user.permissions.includes('"dashboard":true')) cleanPermissions.dashboard = true
          if (user.permissions.includes('"reports":true')) cleanPermissions.reports = true
          if (user.permissions.includes('"estoque":true')) cleanPermissions.estoque = true
          if (user.permissions.includes('"funcionarios":true')) cleanPermissions.funcionarios = true
        } catch (e) {
          console.log('Usando permissões padrão para:', user.username)
        }
        
        // Atualizar no banco
        await db.execute(
          'UPDATE users SET permissions = ? WHERE id = ?',
          [JSON.stringify(cleanPermissions), user.id]
        )
        
        fixedCount++
      }
    }
    
    res.json({ 
      message: `Permissões corrigidas para ${fixedCount} usuários`,
      fixedCount 
    })
  } catch (error) {
    console.error('Erro ao corrigir permissões:', error)
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