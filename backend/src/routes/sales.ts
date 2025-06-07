import { Router } from 'express'
import { getDatabase } from '../database/connection'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()

// Criar nova venda
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { produtos, total, discount = 0, payment_method = 'dinheiro' } = req.body

    if (!produtos || produtos.length === 0) {
      return res.status(400).json({ error: 'Lista de produtos é obrigatória' })
    }

    const db = getDatabase()

    // Iniciar transação
    await db.exec('BEGIN TRANSACTION')

    try {
      // Criar a venda
      const saleResult = await db.run(
        'INSERT INTO sales (total, discount, payment_method, created_at) VALUES (?, ?, ?, datetime("now", "localtime"))',
        [total, discount, payment_method]
      )

      const saleId = saleResult.lastID

      // Adicionar itens da venda e atualizar estoque
      for (const produto of produtos) {
        // Verificar se há estoque suficiente
        const stockData = await db.get(
          'SELECT quantidade FROM products WHERE id = ?',
          [produto.produto_id]
        )

        if (!stockData) {
          throw new Error(`Produto ID ${produto.produto_id} não encontrado`)
        }

        const stockAvailable = stockData.quantidade
        if (stockAvailable < produto.quantidade) {
          throw new Error(`Estoque insuficiente para produto ID ${produto.produto_id}`)
        }

        // Inserir item da venda
        await db.run(
          'INSERT INTO sale_items (sale_id, produto_id, quantidade, valor_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
          [saleId, produto.produto_id, produto.quantidade, produto.valor_unitario, produto.subtotal]
        )

        // Atualizar estoque
        await db.run(
          'UPDATE products SET quantidade = quantidade - ? WHERE id = ?',
          [produto.quantidade, produto.produto_id]
        )
      }

      await db.exec('COMMIT')

      res.json({ 
        message: 'Venda criada com sucesso',
        saleId 
      })
    } catch (error) {
      await db.exec('ROLLBACK')
      throw error
    }
  } catch (error: any) {
    console.error('Erro ao criar venda:', error)
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    })
  }
})

// Listar vendas com filtros e paginação
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { 
      date = new Date().toISOString().split('T')[0], 
      page = 1, 
      limit = 10 
    } = req.query

    const pageNumber = parseInt(page as string)
    const limitNumber = parseInt(limit as string)
    const offset = (pageNumber - 1) * limitNumber

    const db = getDatabase()

    // Contar total de vendas para a data
    const countData = await db.get(
      `SELECT COUNT(*) as total, 
              COALESCE(SUM(total), 0) as totalRevenue
       FROM sales 
       WHERE DATE(created_at) = ?`,
      [date]
    )

    const totalSales = countData.total
    const totalRevenue = countData.totalRevenue

    // Buscar vendas com paginação
    const salesData = await db.all(
      `SELECT s.*, 
              GROUP_CONCAT(si.id) as item_ids,
              GROUP_CONCAT(si.produto_id) as produto_ids,
              GROUP_CONCAT(si.quantidade) as quantidades,
              GROUP_CONCAT(si.valor_unitario) as valores_unitarios,
              GROUP_CONCAT(si.subtotal) as subtotais,
              GROUP_CONCAT(p.descricao) as produto_nomes
       FROM sales s
       LEFT JOIN sale_items si ON s.id = si.sale_id
       LEFT JOIN products p ON si.produto_id = p.id
       WHERE DATE(s.created_at) = ?
       GROUP BY s.id
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [date, limitNumber, offset]
    )

    // Formatar dados das vendas
    const sales = salesData.map((sale: any) => ({
      id: sale.id,
      total: sale.total,
      discount: sale.discount || 0,
      payment_method: sale.payment_method || 'dinheiro',
      created_at: sale.created_at,
      items: sale.item_ids && sale.produto_ids && sale.quantidades && sale.valores_unitarios && sale.subtotais && sale.produto_nomes 
        ? sale.item_ids.split(',').map((id: string, index: number) => ({
            id: parseInt(id),
            produto_id: parseInt(sale.produto_ids.split(',')[index]),
            quantidade: parseInt(sale.quantidades.split(',')[index]),
            valor_unitario: parseFloat(sale.valores_unitarios.split(',')[index]),
            subtotal: parseFloat(sale.subtotais.split(',')[index]),
            produto_nome: sale.produto_nomes.split(',')[index]
          })) 
        : []
    }))

    res.json({
      sales,
      total: totalSales,
      totalRevenue: totalRevenue,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(totalSales / limitNumber)
    })
  } catch (error: any) {
    console.error('Erro ao buscar vendas:', error)
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    })
  }
})

// Buscar detalhes de uma venda específica
router.get('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params
    const db = getDatabase()

    // Buscar venda
    const sale = await db.get(
      'SELECT * FROM sales WHERE id = ?',
      [id]
    )

    if (!sale) {
      return res.status(404).json({ error: 'Venda não encontrada' })
    }

    // Buscar itens da venda
    const itemsData = await db.all(
      `SELECT si.*, p.descricao as produto_nome
       FROM sale_items si
       JOIN products p ON si.produto_id = p.id
       WHERE si.sale_id = ?
       ORDER BY si.id`,
      [id]
    )

    sale.items = itemsData

    res.json(sale)
  } catch (error: any) {
    console.error('Erro ao buscar detalhes da venda:', error)
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    })
  }
})

// Relatório de vendas por período
router.get('/report/period', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const startDate = req.query.start_date as string
    const endDate = req.query.end_date as string

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Data de início e fim são obrigatórias' })
    }

    const db = getDatabase()

    // Vendas por dia no período
    const dailySales = await db.all(
      `SELECT DATE(created_at) as data, SUM(total) as total, COUNT(*) as quantidade
       FROM sales 
       WHERE DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY data ASC`,
      [startDate, endDate]
    )

    // Total do período
    const totalResult = await db.get(
      `SELECT SUM(total) as total_periodo, COUNT(*) as total_vendas
       FROM sales 
       WHERE DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    )

    // Produtos mais vendidos no período
    const topProducts = await db.all(
      `SELECT p.descricao, SUM(si.quantidade) as quantidade_vendida, SUM(si.subtotal) as total_vendido
       FROM sale_items si
       JOIN products p ON si.produto_id = p.id
       JOIN sales s ON si.sale_id = s.id
       WHERE DATE(s.created_at) BETWEEN ? AND ?
       GROUP BY p.id, p.descricao
       ORDER BY quantidade_vendida DESC
       LIMIT 10`,
      [startDate, endDate]
    )

    res.json({
      periodo: { startDate, endDate },
      resumo: totalResult,
      vendas_por_dia: dailySales,
      produtos_mais_vendidos: topProducts
    })
  } catch (error) {
    console.error('Erro ao gerar relatório:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router 