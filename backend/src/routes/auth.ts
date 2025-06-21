import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { getDatabase } from '../database/connection'
import { authenticateToken, AuthRequest, generateToken, requireAdmin } from '../middleware/auth'
import { 
  loginRateLimit, 
  userCreationRateLimit,
  validateAndSanitize,
  loginValidation,
  userCreationValidation,
  idValidation
} from '../middleware/security'

const router = Router()

// Configurar multer para upload de fotos de usuário
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/user-photos')
    // Criar diretório se não existir
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Usar o ID do usuário como nome do arquivo
    const userId = (req as AuthRequest).user?.id
    const extension = path.extname(file.originalname).toLowerCase()
    cb(null, `user-${userId}${extension}`)
  }
})

const uploadPhoto = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (mimetype && extname) {
      return cb(null, true)
    } else {
      cb(new Error('Apenas imagens são permitidas (jpeg, jpg, png, gif)'))
    }
  }
})

// Middleware para verificar se é admin ou gerente
const requireAdminOrManager = (req: AuthRequest, res: any, next: any) => {
  if (req.user?.role === 'admin' || req.user?.role === 'gerente') {
    next()
  } else {
    res.status(403).json({ error: 'Acesso negado. Apenas administradores e gerentes.' })
  }
}

// Login com rate limiting e validação
router.post('/login', 
  loginRateLimit,
  validateAndSanitize(loginValidation),
  async (req, res) => {
    try {
      const { username, password } = req.body

      console.log(`🔐 [LOGIN ATTEMPT] Username: ${username} IP: ${req.ip}`)

      const db = getDatabase()
      const [userRows] = await db.execute(
        'SELECT id, username, password, role, permissions FROM users WHERE username = ?',
        [username]
      )

      const users = userRows as any[]
      const user = users[0]

      if (!user) {
        console.log(`❌ [LOGIN FAILED] User not found: ${username}`)
        return res.status(401).json({ error: 'Credenciais inválidas' })
      }

      const validPassword = await bcrypt.compare(password, user.password)

      if (!validPassword) {
        console.log(`❌ [LOGIN FAILED] Invalid password for: ${username}`)
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
            dashboard: true, // Dashboard obrigatório para todos
            reports: false,
            estoque: false,
            funcionarios: false,
            financeiro: false
          }
        }
        
        // Garantir que Dashboard sempre seja true
        permissions.dashboard = true
      } catch (e) {
        console.error('Erro ao parsear permissões:', e)
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

      console.log(`✅ [LOGIN SUCCESS] User: ${username} Role: ${user.role}`)

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
      console.error('❌ [LOGIN ERROR]:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }
)

// Verificar token
router.get('/verify', authenticateToken, (req: AuthRequest, res) => {
  res.json({ 
    valid: true, 
    user: req.user 
  })
})

// Criar usuário (admin e gerente) com validação simplificada
router.post('/users', 
  authenticateToken, 
  requireAdminOrManager,
  async (req: AuthRequest, res) => {
    try {
      console.log('📝 [USER CREATION START] Dados recebidos:', req.body)
      
      const { username, password, role = 'funcionario', permissions } = req.body

      // Validação básica manual
      if (!username || !password) {
        console.log('❌ [USER CREATION] Dados obrigatórios ausentes')
        return res.status(400).json({ error: 'Username e senha são obrigatórios' })
      }

      console.log(`📝 [USER CREATION] Creator: ${req.user?.username} Target: ${username} Role: ${role}`)

      // Gerentes só podem criar funcionários
      if (req.user?.role === 'gerente' && role !== 'funcionario') {
        console.log(`❌ [USER CREATION DENIED] Manager ${req.user.username} tried to create ${role}`)
        return res.status(403).json({ error: 'Gerentes só podem criar funcionários' })
      }

      const db = getDatabase()
      
      // Verificar se usuário já existe
      const [existingRows] = await db.execute(
        'SELECT id FROM users WHERE username = ?',
        [username]
      )

      const existingUsers = existingRows as any[]
      if (existingUsers.length > 0) {
        console.log(`❌ [USER CREATION FAILED] Username already exists: ${username}`)
        return res.status(409).json({ error: 'Usuário já existe' })
      }

      // Preparar permissões
      const userPermissions = permissions || {
        pdv: false,
        products: false,
        dashboard: true, // Dashboard obrigatório para todos
        reports: false,
        estoque: false,
        funcionarios: false,
        financeiro: false
      }

      // Garantir que Dashboard sempre seja true
      userPermissions.dashboard = true

      // Criar usuário
      const hashedPassword = await bcrypt.hash(password, 8) // Reduzido para performance
      const [result] = await db.execute(
        'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
        [username, hashedPassword, role, JSON.stringify(userPermissions)]
      )

      const insertResult = result as any
      const userId = insertResult.insertId

      console.log(`✅ [USER CREATED] ID: ${userId} Username: ${username} Role: ${role} By: ${req.user?.username}`)

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
      console.error('❌ [USER CREATION ERROR]:', error)
      res.status(500).json({ error: 'Erro interno do servidor' })
    }
  }
)

// Listar usuários (admin e gerente)
router.get('/users', authenticateToken, requireAdminOrManager, async (req: AuthRequest, res) => {
  try {
    console.log('📋 Solicitação de listagem de usuários recebida')
    
    const db = getDatabase()
    const [userRows] = await db.execute(
      'SELECT id, username, role, permissions, created_at FROM users ORDER BY created_at DESC'
    )

    const users = userRows as any[]
    console.log('📊 Usuários brutos do banco:', users.map(u => ({ id: u.id, username: u.username, role: u.role })))
    
    const formattedUsers = users.map((user: any) => {
      let permissions = {
        pdv: false,
        products: false,
        dashboard: true, // Dashboard obrigatório para todos
        reports: false,
        estoque: false,
        funcionarios: false,
        financeiro: false
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

      // Garantir que Dashboard sempre seja true
      permissions.dashboard = true

      const formattedUser = {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions,
        created_at: user.created_at
      }
      
      console.log(`👤 Usuário formatado - ${user.username}:`, { role: formattedUser.role, permissions: formattedUser.permissions })
      
      return formattedUser
    })

    console.log('✅ Enviando lista de usuários formatada')
    res.json(formattedUsers)
  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Atualizar usuário (admin e gerente)
router.put('/users/:id', authenticateToken, requireAdminOrManager, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const { username, password, role, permissions } = req.body

    console.log('📝 Dados recebidos para atualização de usuário:', { id, username, role, permissions })

    const db = getDatabase()
    
    // Verificar se usuário existe
    const [existingRows] = await db.execute(
      'SELECT id, role FROM users WHERE id = ?',
      [id]
    )

    const existingUsers = existingRows as any[]
    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    console.log('👤 Usuário antes da atualização:', existingUsers[0])

    // Gerentes só podem editar funcionários
    if (req.user?.role === 'gerente') {
      if (existingUsers[0].role !== 'funcionario') {
        return res.status(403).json({ error: 'Gerentes só podem editar funcionários' })
      }
      if (role && role !== 'funcionario') {
        return res.status(403).json({ error: 'Gerentes só podem definir função como funcionário' })
      }
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
      console.log('🔄 Atualizando role para:', role)
      updates.push('role = ?')
      values.push(role)
    }

    if (permissions) {
      console.log('🔄 Atualizando permissões para:', permissions)
      // Garantir que Dashboard sempre seja true
      permissions.dashboard = true
      updates.push('permissions = ?')
      values.push(JSON.stringify(permissions))
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' })
    }

    values.push(id)

    console.log('💾 Query SQL:', `UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
    console.log('💾 Valores:', values)

    await db.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    // Verificar se a atualização funcionou
    const [updatedRows] = await db.execute(
      'SELECT id, username, role, permissions FROM users WHERE id = ?',
      [id]
    )
    
    const updatedUser = (updatedRows as any[])[0]
    console.log('✅ Usuário após atualização:', updatedUser)

    if (role && updatedUser.role !== role) {
      console.error('❌ ERRO: Role não foi salvo corretamente!')
      console.error('Esperado:', role, 'Atual:', updatedUser.role)
      
      // Tentar uma atualização direta forçada
      console.log('🔧 Tentando atualização forçada do role...')
      await db.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, id]
      )
      
      // Verificar novamente
      const [recheck] = await db.execute(
        'SELECT role FROM users WHERE id = ?',
        [id]
      )
      console.log('🔍 Role após atualização forçada:', (recheck as any[])[0])
    }

    console.log('✅ Usuário atualizado com sucesso para ID:', id)

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

// Rota de teste para criação simples de usuário (temporária)
router.post('/users/test', authenticateToken, requireAdminOrManager, async (req: AuthRequest, res) => {
  try {
    console.log('🧪 [TEST USER CREATION] Dados recebidos:', req.body)
    
    const { username, password, role = 'funcionario' } = req.body
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username e senha obrigatórios' })
    }
    
    const db = getDatabase()
    
    // Verificar se usuário já existe
    const [existingRows] = await db.execute(
      'SELECT id FROM users WHERE username = ?',
      [username]
    )
    
    if ((existingRows as any[]).length > 0) {
      return res.status(409).json({ error: 'Usuário já existe' })
    }
    
    // Criar usuário com configurações mínimas
    const hashedPassword = await bcrypt.hash(password, 8)
    const basicPermissions = {
      pdv: true,
      products: false,
      dashboard: true,
      reports: false,
      estoque: false,
      funcionarios: false,
      financeiro: false
    }
    
    const [result] = await db.execute(
      'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
      [username, hashedPassword, role, JSON.stringify(basicPermissions)]
    )
    
    console.log('✅ [TEST USER CREATED] ID:', (result as any).insertId)
    
    res.status(201).json({
      message: 'Usuário de teste criado com sucesso',
      user: {
        id: (result as any).insertId,
        username,
        role,
        permissions: basicPermissions
      }
    })
  } catch (error) {
    console.error('❌ [TEST USER CREATION ERROR]:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Deletar usuário (admin e gerente)
router.delete('/users/:id', authenticateToken, requireAdminOrManager, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    // Impedir que o admin delete a si mesmo
    if (req.user?.id === parseInt(id)) {
      return res.status(400).json({ error: 'Não é possível deletar seu próprio usuário' })
    }

    const db = getDatabase()
    
    // Verificar se usuário existe
    const [existingRows] = await db.execute(
      'SELECT id, role FROM users WHERE id = ?',
      [id]
    )

    const existingUsers = existingRows as any[]
    if (existingUsers.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    // Gerentes só podem deletar funcionários
    if (req.user?.role === 'gerente' && existingUsers[0].role !== 'funcionario') {
      return res.status(403).json({ error: 'Gerentes só podem deletar funcionários' })
    }

    await db.execute('DELETE FROM users WHERE id = ?', [id])

    res.json({ message: 'Usuário deletado com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar usuário:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Upload de foto do usuário
router.post('/upload-photo', authenticateToken, uploadPhoto.single('photo'), async (req: AuthRequest, res) => {
  try {
    console.log('📸 [UPLOAD PHOTO] Iniciando upload de foto...')
    console.log('📸 [UPLOAD PHOTO] User info:', req.user)
    
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma foto enviada' })
    }

    const userId = req.user?.id
    console.log(`📸 [UPLOAD PHOTO] Foto salva para usuário ${userId}: ${req.file.filename}`)

    // Atualizar o banco de dados com o caminho da foto
    const db = getDatabase()
    await db.execute(
      'UPDATE users SET photo_path = ? WHERE id = ?',
      [req.file.filename, userId]
    )

    res.json({
      message: 'Foto enviada com sucesso',
      filename: req.file.filename,
      path: `/api/auth/photo/${userId}`
    })
  } catch (error) {
    console.error('❌ [UPLOAD PHOTO] Erro:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Obter foto do usuário
router.get('/photo/:userId', async (req, res) => {
  try {
    const userId = req.params.userId
    const db = getDatabase()
    
    // Buscar o caminho da foto no banco
    const [rows] = await db.execute(
      'SELECT photo_path FROM users WHERE id = ?',
      [userId]
    ) as any[]

    if (rows.length === 0 || !rows[0].photo_path) {
      return res.status(404).json({ error: 'Foto não encontrada' })
    }

    const photoPath = path.join(__dirname, '../../uploads/user-photos', rows[0].photo_path)
    
    if (!fs.existsSync(photoPath)) {
      return res.status(404).json({ error: 'Arquivo de foto não encontrado' })
    }

    res.sendFile(photoPath)
  } catch (error) {
    console.error('❌ [GET PHOTO] Erro:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Deletar foto do usuário
router.delete('/photo', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id
    const db = getDatabase()
    
    // Buscar o caminho da foto atual
    const [rows] = await db.execute(
      'SELECT photo_path FROM users WHERE id = ?',
      [userId]
    ) as any[]

    if (rows.length > 0 && rows[0].photo_path) {
      const photoPath = path.join(__dirname, '../../uploads/user-photos', rows[0].photo_path)
      
      // Deletar arquivo físico se existir
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath)
      }
    }

    // Remover referência do banco
    await db.execute(
      'UPDATE users SET photo_path = NULL WHERE id = ?',
      [userId]
    )

    console.log(`📸 [DELETE PHOTO] Foto removida para usuário ${userId}`)
    res.json({ message: 'Foto removida com sucesso' })
  } catch (error) {
    console.error('❌ [DELETE PHOTO] Erro:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router 