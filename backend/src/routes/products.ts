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
    
    // Converter para array de arrays para acessar por posição de coluna
    const dataArray = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    console.log('📊 Dados extraídos do Excel:', dataArray.length, 'linhas')
    
    if (dataArray.length === 0) {
      return res.status(400).json({ error: 'Arquivo vazio ou formato inválido' })
    }

    // Log da primeira linha para debug
    if (dataArray.length > 0) {
      console.log('🔍 Primeira linha:', dataArray[0])
    }

    const db = getDatabase()
    let success = 0
    let errors = 0
    let created = 0
    let updated = 0
    const errorMessages: string[] = []

    // Começar da linha 1 se houver cabeçalho, ou linha 0 se não houver
    const startRow = 1 // Assumindo que há cabeçalho na linha 0
    
    for (let i = startRow; i < dataArray.length; i++) {
      try {
        const row = dataArray[i] as any[]
        
        // Mapeamento específico baseado nas posições das colunas
        const normalizedRow = {
          // Coluna G (índice 6) - Descrição
          descricao: row[6]?.toString()?.trim() || '',
          
          // Coluna E (índice 4) - Quantidade
          quantidade: Number(row[4]) || 1,
          
          // Coluna J (índice 9) - Valor Unitário - SEMPRE 0 na importação
          valor_unitario: 0,
          
          // Coluna K (índice 10) - Valor Total - SEMPRE 0 na importação
          valor_venda: 0,
          
          // Categoria - SEMPRE vazio para forçar seleção das 3 categorias específicas
          categoria: 'Selecione a categoria',
          
          // Coluna C (índice 2) - Código ML
          codigo_barras_1: row[2]?.toString()?.trim() || null,
          
          // Coluna D (índice 3) - Código RZ
          codigo_barras_2: row[3]?.toString()?.trim() || null
        }

        console.log(`📝 Processando linha ${i + 1}:`, normalizedRow)

        // Validar campos obrigatórios (só descrição é essencial)
        if (!normalizedRow.descricao || normalizedRow.descricao.length < 3) {
          const errorMsg = `Linha ${i + 1}: Descrição inválida ou muito curta (${normalizedRow.descricao})`
          console.log('❌', errorMsg)
          errorMessages.push(errorMsg)
          errors++
          continue
        }

        // Nota: Valores sempre 0 na importação - usuário preenche depois

        // Verificar se os códigos são válidos (não vazios, não #VALOR!, etc.)
        if (normalizedRow.codigo_barras_1 && (normalizedRow.codigo_barras_1.includes('#') || normalizedRow.codigo_barras_1.length < 3)) {
          normalizedRow.codigo_barras_1 = null
        }
        if (normalizedRow.codigo_barras_2 && (normalizedRow.codigo_barras_2.includes('#') || normalizedRow.codigo_barras_2.length < 3)) {
          normalizedRow.codigo_barras_2 = null
        }

        // VERIFICAR SE JÁ EXISTE PRODUTO - PRIORIDADE PELO NOME
        let existingProduct = null
        
        // 1º - VERIFICAR PELO NOME DO PRODUTO (prioridade)
        const [nameRows] = await db.execute(
          `SELECT * FROM products WHERE LOWER(TRIM(descricao)) = LOWER(TRIM(?))`,
          [normalizedRow.descricao]
        )
        
        const existingByName = nameRows as any[]
        if (existingByName.length > 0) {
          existingProduct = existingByName[0]
          console.log(`🎯 Produto encontrado pelo NOME: ${existingProduct.descricao}`)
        }
        
        // 2º - SE NÃO ENCONTROU PELO NOME, VERIFICAR PELOS CÓDIGOS DE BARRAS
        if (!existingProduct && (normalizedRow.codigo_barras_1 || normalizedRow.codigo_barras_2)) {
          const [codeRows] = await db.execute(
            `SELECT * FROM products 
             WHERE (codigo_barras_1 = ? AND codigo_barras_1 IS NOT NULL) 
             OR (codigo_barras_2 = ? AND codigo_barras_2 IS NOT NULL)
             OR (codigo_barras_1 = ? AND codigo_barras_1 IS NOT NULL)
             OR (codigo_barras_2 = ? AND codigo_barras_2 IS NOT NULL)`,
            [
              normalizedRow.codigo_barras_1, 
              normalizedRow.codigo_barras_1,
              normalizedRow.codigo_barras_2, 
              normalizedRow.codigo_barras_2
            ]
          )
          
          const existingByCode = codeRows as any[]
          if (existingByCode.length > 0) {
            existingProduct = existingByCode[0]
            console.log(`🔢 Produto encontrado pelo CÓDIGO: ${existingProduct.descricao}`)
          }
        }

        if (existingProduct) {
          // PRODUTO JÁ EXISTE - SOMAR QUANTIDADE
          const novaQuantidade = Number(existingProduct.quantidade) + Number(normalizedRow.quantidade)
          
          await db.execute(
            `UPDATE products SET quantidade = ? WHERE id = ?`,
            [novaQuantidade, existingProduct.id]
          )
          
          console.log(`🔄 Produto atualizado - ID: ${existingProduct.id} | ${existingProduct.descricao} | Quantidade: ${existingProduct.quantidade} + ${normalizedRow.quantidade} = ${novaQuantidade}`)
          success++
          updated++
        } else {
          // PRODUTO NOVO - CRIAR
          const [result] = await db.execute(
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
          
          const insertResult = result as any
          console.log(`✅ Produto novo criado com ID: ${insertResult.insertId} | ${normalizedRow.descricao} | Quantidade: ${normalizedRow.quantidade}`)
          success++
          created++
        }
      } catch (error) {
        const errorMsg = `Linha ${i + 1}: ${error}`
        console.log('❌', errorMsg)
        errorMessages.push(errorMsg)
        errors++
      }
    }

    console.log(`📈 Resultado da importação: ${success} sucessos, ${errors} erros`)

    res.json({
      message: 'Importação concluída',
      success,
      errors,
      created,
      updated,
      details: errorMessages.length > 0 ? errorMessages.slice(0, 10) : [] // Limitar mensagens de erro
    })
  } catch (error) {
    console.error('Erro na importação:', error)
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