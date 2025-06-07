import { Router } from 'express'
import multer from 'multer'
import XLSX from 'xlsx'
import { getDatabase } from '../database/connection'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()

// Configurar multer para upload de arquivos
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
})

// Rota específica para PDV - retorna todos os produtos em array simples
router.get('/all', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = getDatabase()
    const products = await db.all(
      'SELECT * FROM products ORDER BY descricao ASC'
    )
    
    res.json(products)
  } catch (error) {
    console.error('Erro ao listar todos os produtos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Listar produtos com paginação e busca
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 20
    const search = req.query.search as string || ''
    const offset = (page - 1) * limit

    const db = getDatabase()

    let whereClause = ''
    let params: any[] = []

    if (search) {
      whereClause = `WHERE descricao LIKE ? OR codigo_barras_1 LIKE ? OR codigo_barras_2 LIKE ?`
      const searchTerm = `%${search}%`
      params = [searchTerm, searchTerm, searchTerm]
    }

    // Contar total de produtos
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM products ${whereClause}`,
      params
    )
    const total = countResult.total

    // Buscar produtos
    const products = await db.all(
      `SELECT * FROM products ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const totalPages = Math.ceil(total / limit)

    res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('Erro ao listar produtos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Buscar produtos (para PDV)
router.get('/search', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const query = req.query.q as string
    
    if (!query || query.length < 2) {
      return res.json([])
    }

    const db = getDatabase()
    const searchTerm = `%${query}%`
    
    const products = await db.all(
      `SELECT * FROM products 
       WHERE descricao LIKE ? 
       OR codigo_barras_1 = ? 
       OR codigo_barras_2 = ?
       ORDER BY descricao ASC 
       LIMIT 10`,
      [searchTerm, query, query]
    )

    res.json(products)
  } catch (error) {
    console.error('Erro na busca de produtos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Criar produto
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const {
      descricao,
      quantidade,
      valor_unitario,
      valor_venda,
      categoria,
      codigo_barras_1,
      codigo_barras_2
    } = req.body

    if (!descricao || quantidade === undefined || valor_unitario === undefined || valor_venda === undefined || !categoria) {
      return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' })
    }

    const db = getDatabase()
    const result = await db.run(
      `INSERT INTO products (descricao, quantidade, valor_unitario, valor_venda, categoria, codigo_barras_1, codigo_barras_2)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [descricao, quantidade, valor_unitario, valor_venda, categoria, codigo_barras_1 || null, codigo_barras_2 || null]
    )

    const productId = result.lastID

    // Buscar produto criado
    const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [productId])

    res.status(201).json({
      message: 'Produto criado com sucesso',
      product: newProduct
    })
  } catch (error) {
    console.error('Erro ao criar produto:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Atualizar produto
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const {
      descricao,
      quantidade,
      valor_unitario,
      valor_venda,
      categoria,
      codigo_barras_1,
      codigo_barras_2
    } = req.body

    const db = getDatabase()
    
    // Verificar se produto existe
    const existingProduct = await db.get('SELECT id FROM products WHERE id = ?', [id])
    if (!existingProduct) {
      return res.status(404).json({ error: 'Produto não encontrado' })
    }

    await db.run(
      `UPDATE products SET 
       descricao = ?, quantidade = ?, valor_unitario = ?, valor_venda = ?, 
       categoria = ?, codigo_barras_1 = ?, codigo_barras_2 = ?
       WHERE id = ?`,
      [descricao, quantidade, valor_unitario, valor_venda, categoria, codigo_barras_1 || null, codigo_barras_2 || null, id]
    )

    // Buscar produto atualizado
    const updatedProduct = await db.get('SELECT * FROM products WHERE id = ?', [id])

    res.json({
      message: 'Produto atualizado com sucesso',
      product: updatedProduct
    })
  } catch (error) {
    console.error('Erro ao atualizar produto:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Deletar produto
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params

    const db = getDatabase()
    
    // Verificar se produto existe
    const existingProduct = await db.get('SELECT id FROM products WHERE id = ?', [id])
    if (!existingProduct) {
      return res.status(404).json({ error: 'Produto não encontrado' })
    }

    await db.run('DELETE FROM products WHERE id = ?', [id])

    res.json({ message: 'Produto deletado com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar produto:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Importar produtos do Excel
router.post('/import', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' })
    }

    console.log('📁 Arquivo recebido:', req.file.originalname, req.file.size, 'bytes')

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet)

    console.log('📊 Dados extraídos do Excel:', data.length, 'linhas')
    
    if (data.length === 0) {
      return res.status(400).json({ error: 'Arquivo vazio ou formato inválido' })
    }

    // Log para ver as chaves do primeiro item
    if (data.length > 0) {
      console.log('🔑 Colunas encontradas:', Object.keys(data[0]))
    }

    const db = getDatabase()
    let success = 0
    let errors = 0
    const errorMessages: string[] = []

    for (const row of data as any[]) {
      try {
        // Normalizar nomes das colunas - aceitar tanto português quanto inglês
        const normalizedRow = {
          descricao: row.descricao || row['Descrição'] || row.description || '',
          quantidade: Number(row.quantidade || row['Quantidade'] || row.quantity || 0),
          valor_unitario: Number(row.valor_unitario || row['Valor Unitário'] || row['valor_unitario'] || row.unit_price || 0),
          valor_venda: Number(row.valor_venda || row['Valor Venda'] || row['valor_venda'] || row.sale_price || 0),
          categoria: row.categoria || row['Categoria'] || row.category || 'Geral',
          codigo_barras_1: row.codigo_barras_1 || row['Código Barras 1'] || row['codigo_barras_1'] || row.barcode_1 || null,
          codigo_barras_2: row.codigo_barras_2 || row['Código Barras 2'] || row['codigo_barras_2'] || row.barcode_2 || null
        }

        console.log(`📝 Processando linha ${data.indexOf(row) + 1}:`, normalizedRow)

        // Validar campos obrigatórios
        if (!normalizedRow.descricao || !normalizedRow.categoria) {
          const errorMsg = `Linha ${data.indexOf(row) + 1}: Descrição e categoria são obrigatórias`
          console.log('❌', errorMsg)
          errorMessages.push(errorMsg)
          errors++
          continue
        }

        const result = await db.run(
          `INSERT INTO products (descricao, quantidade, valor_unitario, valor_venda, categoria, codigo_barras_1, codigo_barras_2)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            normalizedRow.descricao,
            normalizedRow.quantidade,
            normalizedRow.valor_unitario,
            normalizedRow.valor_venda,
            normalizedRow.categoria,
            normalizedRow.codigo_barras_1,
            normalizedRow.codigo_barras_2
          ]
        )
        
        console.log(`✅ Produto inserido com ID: ${result.lastID}`)
        success++
      } catch (error) {
        const errorMsg = `Linha ${data.indexOf(row) + 1}: ${error instanceof Error ? error.message : 'Erro ao importar'}`
        console.error('❌ Erro na linha:', errorMsg, error)
        errorMessages.push(errorMsg)
        errors++
      }
    }

    console.log(`📈 Importação finalizada: ${success} sucessos, ${errors} erros`)

    res.json({
      message: `Importação concluída. Sucessos: ${success}, Erros: ${errors}`,
      success,
      errors,
      errorMessages: errorMessages.slice(0, 10) // Limitar mensagens de erro
    })
  } catch (error) {
    console.error('💥 Erro geral na importação:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Exportar template Excel
router.get('/template', authenticateToken, (req: AuthRequest, res) => {
  try {
    const template = [
      {
        descricao: 'Exemplo Produto',
        quantidade: 10,
        valor_unitario: 5.00,
        valor_venda: 8.50,
        categoria: 'Categoria Exemplo',
        codigo_barras_1: '1234567890123',
        codigo_barras_2: '0987654321'
      }
    ]

    const worksheet = XLSX.utils.json_to_sheet(template)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Produtos')

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Disposition', 'attachment; filename=template_produtos.xlsx')
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.send(buffer)
  } catch (error) {
    console.error('Erro ao gerar template:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router 