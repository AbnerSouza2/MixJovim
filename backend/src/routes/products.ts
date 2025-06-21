import { Router } from 'express'
import multer from 'multer'
import XLSX from 'xlsx'
import { getDatabase } from '../database/connection'
import { authenticateToken, AuthRequest } from '../middleware/auth'

interface Product {
  id: number
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_venda: number
  categoria: string
  codigo_barras_1?: string
  codigo_barras_2?: string
  created_at?: Date
  updated_at?: Date
}

const router = Router()

// Configurar multer para upload de arquivos grandes (planilhas com 25k+ produtos)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 100 * 1024 * 1024, // 100MB
    fieldSize: 100 * 1024 * 1024, // 100MB
    fields: 10,
    files: 1
  },
  fileFilter: (req, file, cb) => {
    console.log('📁 [MULTER] Arquivo recebido:', file.originalname, file.mimetype)
    
    // Permitir apenas arquivos Excel
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream'
    ]
    
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      cb(null, true)
    } else {
      console.log('❌ [MULTER] Tipo de arquivo rejeitado:', file.mimetype)
      cb(new Error('Tipo de arquivo não suportado'))
    }
  }
})

// Rota específica para relatórios - retorna todos os produtos com dados de estoque real
router.get('/all', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = getDatabase()
    const [productRows] = await db.execute(`
      SELECT 
        p.*,
        COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) as total_conferido,
        COALESCE(SUM(CASE WHEN e.tipo = 'perda' THEN e.quantidade ELSE 0 END), 0) as total_perdas,
        COALESCE(pv.quantidade_vendida, 0) as total_vendido,
        (p.quantidade - 
         COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) - 
         COALESCE(SUM(CASE WHEN e.tipo = 'perda' THEN e.quantidade ELSE 0 END), 0) - 
         COALESCE(pv.quantidade_vendida, 0)) as quantidade_real_estoque,
        (COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) -
         COALESCE(pv.quantidade_vendida, 0)) as quantidade_disponivel
      FROM products p
      LEFT JOIN estoque e ON p.id = e.produto_id
      LEFT JOIN produto_vendas pv ON p.id = pv.produto_id
      GROUP BY p.id, p.descricao, p.quantidade, p.valor_unitario, p.valor_venda, p.categoria, p.codigo_barras_1, p.codigo_barras_2, p.created_at, p.updated_at, pv.quantidade_vendida
      ORDER BY p.descricao ASC
    `)
    
    res.json(productRows)
  } catch (error) {
    console.error('Erro ao listar todos os produtos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Listar produtos com paginação
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10
    const search = req.query.search as string || ''
    const offset = (page - 1) * limit
    
    const db = getDatabase()
    
    let whereClause = ''
    let params: any[] = []
    
    // Construir cláusula WHERE para busca
    if (search) {
      whereClause = `WHERE (p.descricao LIKE ? OR p.codigo_barras_1 LIKE ? OR p.codigo_barras_2 LIKE ?)`
      params = [`%${search}%`, `%${search}%`, `%${search}%`]
    }
    
    // Consulta principal que exclui produtos totalmente conferidos/perdidos
    const mainQuery = `
      SELECT p.*, 
             COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) as total_conferido,
             COALESCE(SUM(CASE WHEN e.tipo = 'perda' THEN e.quantidade ELSE 0 END), 0) as total_perdas,
             GROUP_CONCAT(DISTINCT CASE WHEN e.tipo = 'conferido' THEN u.username END SEPARATOR ', ') as conferentes,
             MAX(CASE WHEN e.tipo = 'conferido' THEN e.created_at END) as ultima_conferencia
      FROM products p
      LEFT JOIN estoque e ON p.id = e.produto_id
      LEFT JOIN users u ON e.usuario_id = u.id
      ${whereClause}
      GROUP BY p.id, p.descricao, p.quantidade, p.valor_unitario, p.valor_venda, p.categoria, p.codigo_barras_1, p.codigo_barras_2, p.created_at, p.updated_at
      HAVING (total_conferido + total_perdas) < p.quantidade OR (total_conferido = 0 AND total_perdas = 0)
      ORDER BY p.descricao ASC
      LIMIT ? OFFSET ?
    `
    
    // Consulta para contar total (com mesmo filtro) - CORRIGIDA
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (
        SELECT p.id, p.quantidade,
               COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) as total_conferido,
               COALESCE(SUM(CASE WHEN e.tipo = 'perda' THEN e.quantidade ELSE 0 END), 0) as total_perdas
        FROM products p
        LEFT JOIN estoque e ON p.id = e.produto_id
        ${whereClause}
        GROUP BY p.id, p.quantidade
        HAVING (total_conferido + total_perdas) < p.quantidade 
               OR (total_conferido = 0 AND total_perdas = 0)
      ) as filtered_products
    `
    
    const queryParams = [...params, limit, offset]
    const countParams = [...params]
    
    const [productRows] = await db.execute(mainQuery, queryParams)
    const [countRows] = await db.execute(countQuery, countParams)
    
    const products = productRows as Product[]
    const totalCount = (countRows as any[])[0].total
    
    res.json({
      products,
      total: totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit)
    })
  } catch (error) {
    console.error('Erro ao buscar produtos:', error)
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
    
    const [productRows] = await db.execute(
      `SELECT * FROM products 
       WHERE descricao LIKE ? 
       OR codigo_barras_1 = ? 
       OR codigo_barras_2 = ?
       ORDER BY descricao ASC 
       LIMIT 10`,
      [searchTerm, query, query]
    )

    res.json(productRows)
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
    const [result] = await db.execute(
      `INSERT INTO products (descricao, quantidade, valor_unitario, valor_venda, categoria, codigo_barras_1, codigo_barras_2)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [descricao, quantidade, valor_unitario, valor_venda, categoria, codigo_barras_1 || null, codigo_barras_2 || null]
    )

    const insertResult = result as any
    const productId = insertResult.insertId

    // Buscar produto criado
    const [newProductRows] = await db.execute('SELECT * FROM products WHERE id = ?', [productId])
    const newProducts = newProductRows as any[]
    const newProduct = newProducts[0]

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
    const [existingRows] = await db.execute('SELECT id FROM products WHERE id = ?', [id])
    const existingProducts = existingRows as any[]
    if (existingProducts.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' })
    }

    await db.execute(
      `UPDATE products SET 
       descricao = ?, quantidade = ?, valor_unitario = ?, valor_venda = ?, 
       categoria = ?, codigo_barras_1 = ?, codigo_barras_2 = ?
       WHERE id = ?`,
      [descricao, quantidade, valor_unitario, valor_venda, categoria, codigo_barras_1 || null, codigo_barras_2 || null, id]
    )

    // Buscar produto atualizado
    const [updatedRows] = await db.execute('SELECT * FROM products WHERE id = ?', [id])
    const updatedProducts = updatedRows as any[]
    const updatedProduct = updatedProducts[0]

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
    const [existingRows] = await db.execute('SELECT id FROM products WHERE id = ?', [id])
    const existingProducts = existingRows as any[]
    if (existingProducts.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' })
    }

    await db.execute('DELETE FROM products WHERE id = ?', [id])

    res.json({ message: 'Produto deletado com sucesso' })
  } catch (error) {
    console.error('Erro ao deletar produto:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Importar produtos do Excel - OTIMIZADO PARA GRANDES VOLUMES
router.post('/import', authenticateToken, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    console.log('📂 [IMPORT] Iniciando importação de planilha...')
    console.log('📂 [IMPORT] Headers:', JSON.stringify(req.headers, null, 2))
    
    if (!req.file) {
      console.log('❌ [IMPORT] Nenhum arquivo enviado')
      return res.status(400).json({ error: 'Nenhum arquivo enviado' })
    }

    console.log('📁 [IMPORT] Arquivo recebido:', req.file.originalname, req.file.size, 'bytes')
    console.log('📁 [IMPORT] MIME type:', req.file.mimetype)

    // Verificar se é um arquivo Excel válido
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/octet-stream' // Fallback
    ]
    
    if (!validMimeTypes.includes(req.file.mimetype)) {
      console.log('❌ [IMPORT] Tipo de arquivo inválido:', req.file.mimetype)
      return res.status(400).json({ 
        error: 'Tipo de arquivo inválido. Envie um arquivo Excel (.xlsx ou .xls)' 
      })
    }

    console.log('📊 [IMPORT] Processando arquivo Excel...')
    const workbook = XLSX.read(req.file.buffer, { 
      type: 'buffer',
      cellDates: false,
      cellNF: false,
      cellStyles: false
    })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Converter para array de arrays para acessar por posição de coluna
    const dataArray = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      raw: false,
      defval: ''
    })
    
    console.log('📊 [IMPORT] Dados extraídos do Excel:', dataArray.length, 'linhas')
    
    if (dataArray.length === 0) {
      console.log('❌ [IMPORT] Arquivo vazio')
      return res.status(400).json({ error: 'Arquivo vazio ou formato inválido' })
    }

    // Log da primeira linha para debug
    if (dataArray.length > 0) {
      console.log('🔍 [IMPORT] Primeira linha (cabeçalho):', dataArray[0])
    }
    if (dataArray.length > 1) {
      console.log('🔍 [IMPORT] Segunda linha (primeiro produto):', dataArray[1])
    }

    const db = getDatabase()
    let success = 0
    let errors = 0
    let created = 0
    let updated = 0
    const errorMessages: string[] = []

    // Começar da linha 1 se houver cabeçalho
    const startRow = 1
    const totalRows = dataArray.length - startRow
    
    console.log(`📝 [IMPORT] Processando ${totalRows} produtos em lotes...`)
    
    // Configurações para processamento em lotes
    const BATCH_SIZE = 100 // Processar 100 produtos por vez
    const totalBatches = Math.ceil(totalRows / BATCH_SIZE)
    
    // Cache para produtos existentes (otimização)
    const existingProductsCache = new Map()
    
    // Pré-carregar todos os produtos existentes para cache
    console.log('🗄️ [IMPORT] Carregando cache de produtos existentes...')
    const [allProducts] = await db.execute(`
      SELECT id, LOWER(TRIM(descricao)) as descricao_lower, codigo_barras_1, codigo_barras_2, quantidade
      FROM products
    `)
    
    const products = allProducts as any[]
    products.forEach(product => {
      // Cache por nome
      existingProductsCache.set(`name_${product.descricao_lower}`, product)
      
      // Cache por códigos de barras
      if (product.codigo_barras_1) {
        existingProductsCache.set(`code1_${product.codigo_barras_1}`, product)
      }
      if (product.codigo_barras_2) {
        existingProductsCache.set(`code2_${product.codigo_barras_2}`, product)
      }
    })
    
    console.log(`🗄️ [IMPORT] Cache carregado com ${products.length} produtos existentes`)
    
    // Processar em lotes para evitar travamento
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = startRow + (batchIndex * BATCH_SIZE)
      const batchEnd = Math.min(batchStart + BATCH_SIZE, dataArray.length)
      
      console.log(`📦 [IMPORT] Processando lote ${batchIndex + 1}/${totalBatches} (linhas ${batchStart + 1}-${batchEnd})`)
      
      // Iniciar transação para o lote
      await db.query('START TRANSACTION')
      
      try {
        const batchInserts = []
        const batchUpdates = []
        
        for (let i = batchStart; i < batchEnd; i++) {
          try {
            const row = dataArray[i] as any[]
            
            // Pular linhas vazias
            if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
              continue
            }
            
            // Mapeamento específico baseado nas posições das colunas
            const normalizedRow = {
              descricao: (row[6]?.toString()?.trim() || '').substring(0, 255), // Limitar tamanho
              quantidade: Math.max(Number(row[4]) || 1, 1), // Garantir positivo
              valor_unitario: 0,
              valor_venda: 0,
              categoria: 'Selecione a categoria',
              codigo_barras_1: (row[2]?.toString()?.trim() && row[2].toString().trim() !== '') ? row[2].toString().trim().substring(0, 50) : null,
              codigo_barras_2: (row[3]?.toString()?.trim() && row[3].toString().trim() !== '') ? row[3].toString().trim().substring(0, 50) : null
            }

            // Validar campos obrigatórios
            if (!normalizedRow.descricao || normalizedRow.descricao.length < 3) {
              const errorMsg = `Linha ${i + 1}: Descrição inválida (${normalizedRow.descricao})`
              errorMessages.push(errorMsg)
              errors++
              continue
            }

            // Filtrar códigos inválidos
            if (normalizedRow.codigo_barras_1 && (normalizedRow.codigo_barras_1.includes('#') || normalizedRow.codigo_barras_1.length < 3)) {
              normalizedRow.codigo_barras_1 = null
            }
            if (normalizedRow.codigo_barras_2 && (normalizedRow.codigo_barras_2.includes('#') || normalizedRow.codigo_barras_2.length < 3)) {
              normalizedRow.codigo_barras_2 = null
            }

            // Verificar produto existente usando cache
            let existingProduct = null
            const descricaoLower = normalizedRow.descricao.toLowerCase().trim()
            
            // 1º - Verificar pelo nome
            existingProduct = existingProductsCache.get(`name_${descricaoLower}`)
            
            // 2º - Verificar pelos códigos se não encontrou pelo nome
            if (!existingProduct && normalizedRow.codigo_barras_1) {
              existingProduct = existingProductsCache.get(`code1_${normalizedRow.codigo_barras_1}`)
            }
            if (!existingProduct && normalizedRow.codigo_barras_2) {
              existingProduct = existingProductsCache.get(`code2_${normalizedRow.codigo_barras_2}`)
            }

            if (existingProduct) {
              // Produto existe - preparar update
              const novaQuantidade = Number(existingProduct.quantidade || 0) + Number(normalizedRow.quantidade || 0)
              batchUpdates.push({
                id: existingProduct.id || 0,
                quantidade: novaQuantidade || 0,
                descricao: existingProduct.descricao || normalizedRow.descricao || ''
              })
              
              console.log(`🔍 [DEBUG BATCH UPDATE] ID: ${existingProduct.id}, Nova Qtd: ${novaQuantidade}`)
              
              // Atualizar cache
              existingProduct.quantidade = novaQuantidade
              updated++
            } else {
              // Produto novo - preparar insert
              batchInserts.push(normalizedRow)
              
              // Adicionar ao cache para evitar duplicatas no mesmo lote
              existingProductsCache.set(`name_${descricaoLower}`, {
                descricao: normalizedRow.descricao,
                quantidade: normalizedRow.quantidade,
                codigo_barras_1: normalizedRow.codigo_barras_1,
                codigo_barras_2: normalizedRow.codigo_barras_2
              })
              
              created++
            }
            
            success++
          } catch (error) {
            const errorMsg = `Linha ${i + 1}: ${error}`
            errorMessages.push(errorMsg)
            errors++
          }
        }
        
        // Executar INSERTs em lote
        if (batchInserts.length > 0) {
          const insertValues = batchInserts.map(item => [
            item.descricao || '',
            item.quantidade || 1,
            item.valor_unitario || 0,
            item.valor_venda || 0,
            item.categoria || 'Selecione a categoria',
            item.codigo_barras_1 === undefined ? null : item.codigo_barras_1,
            item.codigo_barras_2 === undefined ? null : item.codigo_barras_2
          ])
          
          const placeholders = batchInserts.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')
          const flatValues = insertValues.flat()
          
          // Log para debug
          console.log('🔍 [DEBUG] Valores para INSERT:', flatValues.slice(0, 14)) // Primeiros 2 produtos
          console.log('🔍 [DEBUG] Verificando undefined:', flatValues.some(val => val === undefined))
          
          await db.execute(
            `INSERT INTO products (descricao, quantidade, valor_unitario, valor_venda, categoria, codigo_barras_1, codigo_barras_2) VALUES ${placeholders}`,
            flatValues
          )
          
          console.log(`✅ [IMPORT] Lote ${batchIndex + 1}: ${batchInserts.length} produtos inseridos`)
        }
        
        // Executar UPDATEs em lote
        if (batchUpdates.length > 0) {
          for (const update of batchUpdates) {
            // Garantir que não há undefined nos valores de UPDATE
            const quantidade = update.quantidade || 0
            const id = update.id
            
            console.log(`🔍 [DEBUG UPDATE] ID: ${id}, Quantidade: ${quantidade}`)
            
            await db.execute(
              'UPDATE products SET quantidade = ? WHERE id = ?',
              [quantidade, id]
            )
          }
          
          console.log(`🔄 [IMPORT] Lote ${batchIndex + 1}: ${batchUpdates.length} produtos atualizados`)
        }
        
        // Commit da transação
        await db.query('COMMIT')
        
        // Log de progresso
        const progressPercent = Math.round(((batchIndex + 1) / totalBatches) * 100)
        console.log(`📈 [IMPORT] Progresso: ${progressPercent}% (${success} sucessos, ${errors} erros)`)
        
      } catch (batchError) {
        // Rollback em caso de erro
        await db.query('ROLLBACK')
        console.error(`❌ [IMPORT] Erro no lote ${batchIndex + 1}:`, batchError)
        throw batchError
      }
    }

    console.log(`📈 [IMPORT] Resultado final: ${success} sucessos, ${errors} erros`)
    console.log(`📈 [IMPORT] Detalhes: ${created} criados, ${updated} atualizados`)

    res.json({
      message: 'Importação concluída com sucesso',
      success,
      errors,
      created,
      updated,
      totalProcessed: success + errors,
      details: errorMessages.length > 0 ? errorMessages.slice(0, 20) : [] // Máximo 20 erros
    })
  } catch (error) {
    console.error('❌ [IMPORT] Erro na importação:', error)
    res.status(500).json({ 
      error: 'Erro interno do servidor durante importação',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    })
  }
})

// Exportar template Excel
router.get('/template', authenticateToken, (req: AuthRequest, res) => {
  try {
    const template = [
      {
        descricao: 'Exemplo Produto',
        quantidade: 10,
        valor_unitario: 0,
        valor_venda: 0,
        categoria: 'Informática',
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

// Nova rota para listar produtos totalmente conferidos/perdidos (para controle de estoque)
router.get('/conferidos', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = getDatabase()
    
    const [productRows] = await db.execute(`
      SELECT p.*, 
             COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) as total_conferido,
             COALESCE(SUM(CASE WHEN e.tipo = 'perda' THEN e.quantidade ELSE 0 END), 0) as total_perdas
      FROM products p
      LEFT JOIN estoque e ON p.id = e.produto_id
      GROUP BY p.id, p.descricao, p.quantidade, p.valor_unitario, p.valor_venda, p.categoria, p.codigo_barras_1, p.codigo_barras_2, p.created_at, p.updated_at
      HAVING (total_conferido + total_perdas) >= p.quantidade AND p.quantidade > 0
      ORDER BY p.descricao ASC
    `)
    
    res.json(productRows)
  } catch (error) {
    console.error('Erro ao buscar produtos conferidos:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router 