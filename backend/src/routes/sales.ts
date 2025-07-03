import { Router } from 'express'
import { getDatabase } from '../database/connection'
import { authenticateToken, AuthRequest, checkPermission } from '../middleware/auth'
import { saleValidation, validateAndSanitize } from '../middleware/security'
import { format } from 'date-fns'
import { zonedTimeToUtc } from 'date-fns-tz'

const router = Router()

// Criar nova venda
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { produtos, total, discount = 0, payment_method = 'dinheiro', cliente_id = null } = req.body

    if (!produtos || produtos.length === 0) {
      return res.status(400).json({ error: 'Lista de produtos é obrigatória' })
    }

    const db = getDatabase()

    // Verificar se cliente está ativo (caso tenha sido selecionado)
    let clienteAtivo = null
    if (cliente_id) {
      const [clienteRows] = await db.execute(
        'SELECT id, nome_completo, data_inscricao FROM clientes WHERE id = ?',
        [cliente_id]
      )
      
      const clientes = clienteRows as any[]
      if (clientes.length > 0) {
        const cliente = clientes[0]
        const hoje = new Date()
        const inscricao = new Date(cliente.data_inscricao)
        const umAnoEmMs = 365 * 24 * 60 * 60 * 1000
        const isAtivo = (hoje.getTime() - inscricao.getTime()) < umAnoEmMs
        
        if (isAtivo) {
          clienteAtivo = cliente
        } else {
          return res.status(400).json({ error: 'Cliente selecionado não está mais ativo' })
        }
      } else {
        return res.status(404).json({ error: 'Cliente não encontrado' })
      }
    }

    // Formatar a data atual para o fuso horário de São Paulo
    const nowInSaoPaulo = new Date()
    const utcDate = zonedTimeToUtc(nowInSaoPaulo, 'America/Sao_Paulo')
    const formattedDate = format(utcDate, 'yyyy-MM-dd HH:mm:ss')

    // Iniciar transação
    await db.query('START TRANSACTION')

    try {
      // Criar a venda
      const [saleResult] = await db.execute(
        'INSERT INTO sales (total, discount, payment_method, user_id, cliente_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [total, discount, payment_method, req.user?.id, cliente_id, formattedDate]
      )

      const insertResult = saleResult as any
      const saleId = insertResult.insertId

      // Adicionar itens da venda e atualizar controle de vendas
      for (const produto of produtos) {
        // Verificar estoque disponível (conferidos - perdas - vendidos)
        const [stockRows] = await db.execute(`
          SELECT 
            p.id,
            p.descricao,
            p.valor_venda,
            COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) as conferidos,
            COALESCE(SUM(CASE WHEN e.tipo = 'perda' THEN e.quantidade ELSE 0 END), 0) as perdas,
            COALESCE(pv.quantidade_vendida, 0) as vendidos,
            (COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) -
             COALESCE(pv.quantidade_vendida, 0)) as disponivel
          FROM products p
          LEFT JOIN estoque e ON p.id = e.produto_id
          LEFT JOIN produto_vendas pv ON p.id = pv.produto_id
          WHERE p.id = ?
          GROUP BY p.id, p.descricao, p.valor_venda, pv.quantidade_vendida
        `, [produto.produto_id])

        const stockData = stockRows as any[]
        if (stockData.length === 0) {
          throw new Error(`Produto ID ${produto.produto_id} não encontrado`)
        }

        const stockInfo = stockData[0]
        const stockAvailable = stockInfo.disponivel

        if (stockAvailable < produto.quantidade) {
          throw new Error(`Estoque insuficiente para produto "${stockInfo.descricao}". Disponível: ${stockAvailable}, Solicitado: ${produto.quantidade}`)
        }

        // Inserir item da venda
        await db.execute(
          'INSERT INTO sale_items (sale_id, produto_id, quantidade, valor_unitario, subtotal) VALUES (?, ?, ?, ?, ?)',
          [saleId, produto.produto_id, produto.quantidade, produto.valor_unitario, produto.subtotal]
        )

        // Atualizar ou inserir na tabela produto_vendas
        await db.execute(`
          INSERT INTO produto_vendas (produto_id, quantidade_vendida) 
          VALUES (?, ?) 
          ON DUPLICATE KEY UPDATE 
          quantidade_vendida = quantidade_vendida + VALUES(quantidade_vendida)
        `, [produto.produto_id, produto.quantidade])
      }

      await db.query('COMMIT')

      res.json({ 
        message: 'Venda criada com sucesso',
        saleId 
      })
    } catch (error) {
      await db.query('ROLLBACK')
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

    // Ajustar data para timezone brasileiro (UTC-3)
    // Converter a data para incluir o timezone correto
    const startDate = `${date} 00:00:00`
    const endDate = `${date} 23:59:59`

    console.log(`🕒 Filtrando vendas entre: ${startDate} e ${endDate}`)

    // Contar total de vendas para a data
    const [countRows] = await db.execute(
      `SELECT COUNT(*) as total, 
              COALESCE(SUM(total), 0) as totalRevenue
       FROM sales 
       WHERE created_at >= ? AND created_at <= ?`,
      [startDate, endDate]
    )

    const countData = countRows as any[]
    const totalSales = countData[0].total
    const totalRevenue = countData[0].totalRevenue

    // Buscar vendas com paginação
    const [salesRows] = await db.execute(
      `SELECT s.id, s.total, s.discount, s.payment_method, s.user_id, s.cliente_id,
              DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
              u.username as vendedor_nome,
              c.nome_completo as cliente_nome
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN clientes c ON s.cliente_id = c.id
       WHERE s.created_at >= ? AND s.created_at <= ?
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [startDate, endDate, limitNumber, offset]
    )

    const salesData = salesRows as any[]

    // Buscar itens de cada venda separadamente
    const sales = []
    for (const sale of salesData) {
      const [itemRows] = await db.execute(
        `SELECT si.*, p.descricao as produto_nome
         FROM sale_items si
         JOIN products p ON si.produto_id = p.id
         WHERE si.sale_id = ?`,
        [sale.id]
      )

      const items = itemRows as any[]
      sales.push({
        id: sale.id,
        total: sale.total,
        discount: sale.discount || 0,
        payment_method: sale.payment_method || 'dinheiro',
        created_at: sale.created_at,
        vendedor_nome: sale.vendedor_nome || 'Sistema',
        cliente_nome: sale.cliente_nome || null,
        items
      })
    }

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

    // Buscar venda com data formatada
    const [saleRows] = await db.execute(
      `SELECT s.id, s.total, s.discount, s.payment_method, s.user_id, s.cliente_id,
              DATE_FORMAT(s.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
              u.username as vendedor_nome,
              c.nome_completo as cliente_nome
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       LEFT JOIN clientes c ON s.cliente_id = c.id
       WHERE s.id = ?`,
      [id]
    )

    const sales = saleRows as any[]
    if (sales.length === 0) {
      return res.status(404).json({ error: 'Venda não encontrada' })
    }

    const sale = sales[0]

    // Buscar itens da venda
    const [itemRows] = await db.execute(
      `SELECT si.*, p.descricao as produto_nome
       FROM sale_items si
       JOIN products p ON si.produto_id = p.id
       WHERE si.sale_id = ?
       ORDER BY si.id`,
      [id]
    )

    sale.items = itemRows

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

    // Ajustar datas para incluir horário completo
    const startDateTime = `${startDate} 00:00:00`
    const endDateTime = `${endDate} 23:59:59`

    console.log(`📊 Gerando relatório entre: ${startDateTime} e ${endDateTime}`)

    // Total geral do período
    const [totalGeralRows] = await db.execute(
      `SELECT SUM(total) as total_periodo, COUNT(*) as total_vendas
       FROM sales 
       WHERE created_at >= ? AND created_at <= ?`,
      [startDateTime, endDateTime]
    )

    // Vendas por dia no período
    const [vendasPorDiaRows] = await db.execute(
      `SELECT 
        DATE_FORMAT(DATE(s.created_at), '%Y-%m-%d') as data,
        COUNT(*) as total_vendas_dia,
        SUM(s.total) as faturamento_dia,
        AVG(s.total) as ticket_medio_dia
       FROM sales s
       WHERE s.created_at >= ? AND s.created_at <= ?
       GROUP BY DATE(s.created_at)
       ORDER BY data ASC`,
      [startDateTime, endDateTime]
    )

    // Produtos vendidos no período com vendedor e hora
    const [produtosVendidosRows] = await db.execute(
      `SELECT 
        p.descricao as produto_nome,
        p.categoria,
        si.quantidade,
        si.valor_unitario,
        si.subtotal,
        s.id as venda_id,
        DATE_FORMAT(s.created_at, '%Y-%m-%d') as data_venda,
        DATE_FORMAT(s.created_at, '%H:%i:%s') as hora_venda,
        COALESCE(u.username, 'Sistema') as vendedor_nome
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       JOIN products p ON si.produto_id = p.id
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.created_at >= ? AND s.created_at <= ?
       ORDER BY s.created_at DESC`,
      [startDateTime, endDateTime]
    )

    // Verificar se há vendas no período
    const totalVendas = (totalGeralRows as any[])[0]?.total_vendas || 0

    // Se não há vendas, retornar estrutura vazia
    if (totalVendas === 0) {
      console.log(`⚠️ Nenhuma venda encontrada no período`)
      return res.json({
        periodo: { startDate, endDate },
        resumo: { total_periodo: 0, total_vendas: 0 },
        vendas_por_dia: [],
        produtos_vendidos: []
      })
    }

    const totalGeral = totalGeralRows as any[]

    res.json({
      periodo: { startDate, endDate },
      resumo: totalGeral[0],
      vendas_por_dia: vendasPorDiaRows,
      produtos_vendidos: produtosVendidosRows
    })
  } catch (error) {
    console.error('Erro ao gerar relatório:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router 