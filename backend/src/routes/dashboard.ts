import { Router } from 'express'
import { getDatabase } from '../database/connection'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()

// Obter estatísticas do dashboard
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = getDatabase()

    // Data atual para filtros
    const today = new Date()
    const todayString = today.toISOString().split('T')[0]
    const startToday = `${todayString} 00:00:00`
    const endToday = `${todayString} 23:59:59`

    // Primeiro dia do mês atual
    const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const firstDayString = firstDayMonth.toISOString().split('T')[0]
    const startMonth = `${firstDayString} 00:00:00`
    const endMonth = `${todayString} 23:59:59`

    console.log(`📊 Dashboard - Hoje: ${startToday} - ${endToday}`)
    console.log(`📊 Dashboard - Mês: ${startMonth} - ${endMonth}`)

    // Vendas do mês atual
    const [vendasMesRows] = await db.execute(`
      SELECT IFNULL(SUM(total), 0) as total 
      FROM sales 
      WHERE created_at >= ? AND created_at <= ?
    `, [startMonth, endMonth])
    const vendasMes = vendasMesRows as any[]

    // Vendas do dia atual
    const [vendasDiaRows] = await db.execute(`
      SELECT IFNULL(SUM(total), 0) as total 
      FROM sales 
      WHERE created_at >= ? AND created_at <= ?
    `, [startToday, endToday])
    const vendasDia = vendasDiaRows as any[]

    // Total de produtos
    const [totalProdutosRows] = await db.execute(`
      SELECT COUNT(*) as total 
      FROM products
    `)
    const totalProdutos = totalProdutosRows as any[]

    // Vendas por dia (últimos 7 dias)
    const [vendasPorDiaRows] = await db.execute(`
      SELECT 
        DATE(created_at) as data,
        IFNULL(SUM(total), 0) as total
      FROM sales 
      WHERE created_at >= DATE_SUB(?, INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY data ASC
    `, [endToday])

    // Vendas por categoria (últimos 30 dias)
    const [vendasPorCategoriaRows] = await db.execute(`
      SELECT 
        p.categoria,
        IFNULL(SUM(si.subtotal), 0) as total
      FROM sale_items si
      JOIN products p ON si.produto_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= DATE_SUB(?, INTERVAL 30 DAY)
      GROUP BY p.categoria
      ORDER BY total DESC
      LIMIT 5
    `, [endToday])

    // Status do estoque
    const [statusEstoqueRows] = await db.execute(`
      SELECT 
        SUM(CASE WHEN quantidade <= 10 THEN 1 ELSE 0 END) as baixo,
        SUM(CASE WHEN quantidade > 10 AND quantidade <= 50 THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN quantidade > 50 THEN 1 ELSE 0 END) as alto
      FROM products
    `)

    // Produtos com baixo estoque
    const [produtosBaixoEstoqueRows] = await db.execute(`
      SELECT descricao, quantidade 
      FROM products 
      WHERE quantidade <= 10 
      ORDER BY quantidade ASC
      LIMIT 5
    `)

    res.json({
      vendas_mes: vendasMes[0].total,
      vendas_dia: vendasDia[0].total,
      total_produtos: totalProdutos[0].total,
      vendas_por_dia: vendasPorDiaRows,
      vendas_por_categoria: vendasPorCategoriaRows,
      status_estoque: statusEstoqueRows[0] || { baixo: 0, normal: 0, alto: 0 },
      produtos_baixo_estoque: produtosBaixoEstoqueRows
    })
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router 