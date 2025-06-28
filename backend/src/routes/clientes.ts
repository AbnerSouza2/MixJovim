import { Router, Request, Response } from 'express'
import { getDatabase } from '../database/connection'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()

// Interface para cliente
interface Cliente {
  id?: number
  nome_completo: string
  cpf: string
  whatsapp: string
  data_inscricao?: string
  ativo?: boolean
  dias_para_vencer?: number
}

// Função auxiliar para verificar se cliente está ativo (menos de 1 ano)
function isClienteAtivo(dataInscricao: string): boolean {
  const hoje = new Date()
  const inscricao = new Date(dataInscricao)
  const umAnoEmMs = 365 * 24 * 60 * 60 * 1000
  return (hoje.getTime() - inscricao.getTime()) < umAnoEmMs
}

// Função auxiliar para calcular dias para vencer
function calcularDiasParaVencer(dataInscricao: string): number {
  const hoje = new Date()
  const inscricao = new Date(dataInscricao)
  const umAno = new Date(inscricao.getTime() + (365 * 24 * 60 * 60 * 1000))
  const diffTime = umAno.getTime() - hoje.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

// Função auxiliar para formatar CPF
function formatarCPF(cpf: string): string {
  return cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

// Função auxiliar para validar CPF
function validarCPF(cpf: string): boolean {
  cpf = cpf.replace(/\D/g, '')
  
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
    return false
  }
  
  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(cpf.charAt(i)) * (10 - i)
  }
  let resto = 11 - (soma % 11)
  let digito1 = resto < 2 ? 0 : resto
  
  if (parseInt(cpf.charAt(9)) !== digito1) {
    return false
  }
  
  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(cpf.charAt(i)) * (11 - i)
  }
  resto = 11 - (soma % 11)
  let digito2 = resto < 2 ? 0 : resto
  
  return parseInt(cpf.charAt(10)) === digito2
}

// Listar todos os clientes
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query
    
    const db = getDatabase()
    const offset = (Number(page) - 1) * Number(limit)
    
    let query = `
      SELECT 
        id, nome_completo, cpf, whatsapp, data_inscricao, ativo,
        created_at, updated_at
      FROM clientes
    `
    let params: any[] = []
    
    if (search) {
      query += ` WHERE nome_completo LIKE ? OR cpf LIKE ? OR whatsapp LIKE ?`
      const searchTerm = `%${search}%`
      params = [searchTerm, searchTerm, searchTerm]
    }
    
    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
    params.push(Number(limit), offset)
    
    const [rows] = await db.execute(query, params)
    const clientes = rows as any[]
    
    // Calcular status ativo e dias para vencer para cada cliente
    const clientesComStatus = clientes.map(cliente => ({
      ...cliente,
      cpf: formatarCPF(cliente.cpf),
      ativo: isClienteAtivo(cliente.data_inscricao),
      dias_para_vencer: calcularDiasParaVencer(cliente.data_inscricao)
    }))
    
    // Contar total para paginação
    let countQuery = 'SELECT COUNT(*) as total FROM clientes'
    let countParams: any[] = []
    
    if (search) {
      countQuery += ' WHERE nome_completo LIKE ? OR cpf LIKE ? OR whatsapp LIKE ?'
      const searchTerm = `%${search}%`
      countParams = [searchTerm, searchTerm, searchTerm]
    }
    
    const [countRows] = await db.execute(countQuery, countParams)
    const total = (countRows as any[])[0].total
    
    res.json({
      clientes: clientesComStatus,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit))
    })
  } catch (error) {
    console.error('Erro ao buscar clientes:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Buscar cliente por ID
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const [rows] = await db.execute(
      'SELECT * FROM clientes WHERE id = ?',
      [id]
    )
    
    const clientes = rows as any[]
    if (clientes.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' })
    }
    
    const cliente = clientes[0]
    const clienteComStatus = {
      ...cliente,
      cpf: formatarCPF(cliente.cpf),
      ativo: isClienteAtivo(cliente.data_inscricao),
      dias_para_vencer: calcularDiasParaVencer(cliente.data_inscricao)
    }
    
    res.json(clienteComStatus)
  } catch (error) {
    console.error('Erro ao buscar cliente:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Listar apenas clientes ativos (para o PDV)
router.get('/ativos/lista', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const db = getDatabase()
    
    const [rows] = await db.execute(`
      SELECT id, nome_completo, cpf, data_inscricao
      FROM clientes
      ORDER BY nome_completo ASC
    `)
    
    const clientes = rows as any[]
    
    // Filtrar apenas clientes ativos (menos de 1 ano)
    const clientesAtivos = clientes
      .filter(cliente => isClienteAtivo(cliente.data_inscricao))
      .map(cliente => ({
        id: cliente.id,
        nome_completo: cliente.nome_completo,
        cpf: formatarCPF(cliente.cpf),
        dias_para_vencer: calcularDiasParaVencer(cliente.data_inscricao)
      }))
    
    res.json(clientesAtivos)
  } catch (error) {
    console.error('Erro ao buscar clientes ativos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Criar novo cliente
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { nome_completo, cpf, whatsapp } = req.body
    
    // Validações
    if (!nome_completo || !cpf || !whatsapp) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' })
    }
    
    // Limpar e validar CPF
    const cpfLimpo = cpf.replace(/\D/g, '')
    
    if (!validarCPF(cpfLimpo)) {
      return res.status(400).json({ error: 'CPF inválido' })
    }
    
    // Validar WhatsApp (deve ter pelo menos 10 dígitos)
    const whatsappLimpo = whatsapp.replace(/\D/g, '')
    if (whatsappLimpo.length < 10) {
      return res.status(400).json({ error: 'WhatsApp deve ter pelo menos 10 dígitos' })
    }
    
    const db = getDatabase()
    
    // Verificar se CPF já existe
    const [existingRows] = await db.execute(
      'SELECT id FROM clientes WHERE cpf = ?',
      [cpfLimpo]
    )
    
    if ((existingRows as any[]).length > 0) {
      return res.status(409).json({ error: 'CPF já cadastrado' })
    }
    
    // Inserir cliente
    const [result] = await db.execute(
      'INSERT INTO clientes (nome_completo, cpf, whatsapp) VALUES (?, ?, ?)',
      [nome_completo.trim(), cpfLimpo, whatsappLimpo]
    )
    
    const clienteId = (result as any).insertId
    
    // Buscar cliente criado para retornar
    const [newClienteRows] = await db.execute(
      'SELECT * FROM clientes WHERE id = ?',
      [clienteId]
    )
    
    const novoCliente = (newClienteRows as any[])[0]
    const clienteComStatus = {
      ...novoCliente,
      cpf: formatarCPF(novoCliente.cpf),
      ativo: true,
      dias_para_vencer: 365
    }
    
    res.status(201).json({
      message: 'Cliente criado com sucesso',
      cliente: clienteComStatus
    })
  } catch (error) {
    console.error('Erro ao criar cliente:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Atualizar cliente
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { nome_completo, cpf, whatsapp } = req.body
    
    // Validações
    if (!nome_completo || !cpf || !whatsapp) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' })
    }
    
    // Limpar e validar CPF
    const cpfLimpo = cpf.replace(/\D/g, '')
    
    if (!validarCPF(cpfLimpo)) {
      return res.status(400).json({ error: 'CPF inválido' })
    }
    
    // Validar WhatsApp
    const whatsappLimpo = whatsapp.replace(/\D/g, '')
    if (whatsappLimpo.length < 10) {
      return res.status(400).json({ error: 'WhatsApp deve ter pelo menos 10 dígitos' })
    }
    
    const db = getDatabase()
    
    // Verificar se cliente existe
    const [existingRows] = await db.execute(
      'SELECT id FROM clientes WHERE id = ?',
      [id]
    )
    
    if ((existingRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' })
    }
    
    // Verificar se CPF já existe em outro cliente
    const [cpfRows] = await db.execute(
      'SELECT id FROM clientes WHERE cpf = ? AND id != ?',
      [cpfLimpo, id]
    )
    
    if ((cpfRows as any[]).length > 0) {
      return res.status(409).json({ error: 'CPF já cadastrado para outro cliente' })
    }
    
    // Atualizar cliente
    await db.execute(
      'UPDATE clientes SET nome_completo = ?, cpf = ?, whatsapp = ? WHERE id = ?',
      [nome_completo.trim(), cpfLimpo, whatsappLimpo, id]
    )
    
    res.json({ message: 'Cliente atualizado com sucesso' })
  } catch (error) {
    console.error('Erro ao atualizar cliente:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Deletar cliente
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    // Verificar se cliente existe
    const [existingRows] = await db.execute(
      'SELECT id FROM clientes WHERE id = ?',
      [id]
    )
    
    if ((existingRows as any[]).length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' })
    }
    
    // Verificar se cliente tem vendas associadas
    const [salesRows] = await db.execute(
      'SELECT COUNT(*) as count FROM sales WHERE cliente_id = ?',
      [id]
    )
    
    const salesCount = (salesRows as any[])[0].count
    
    if (salesCount > 0) {
      return res.status(400).json({ 
        error: `Não é possível excluir cliente. Existem ${salesCount} venda(s) associada(s).` 
      })
    }
    
    // Deletar cliente
    await db.execute('DELETE FROM clientes WHERE id = ?', [id])
    
    res.json({ message: 'Cliente excluído com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar cliente:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router 