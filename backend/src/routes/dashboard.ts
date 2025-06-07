import { Router } from 'express'
import { getDatabase } from '../database/connection'
import { authenticateToken, AuthRequest } from '../middleware/auth'

const router = Router()

// Obter estatísticas do dashboard
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const db = getDatabase()

    // Vendas do mês atual
    const vendasMes = await db.get(`
      SELECT IFNULL(SUM(total), 0) as total 
      FROM sales 
      WHERE strftime('%m', created_at) = strftime('%m', 'now') 
      AND strftime('%Y', created_at) = strftime('%Y', 'now')
    `)

    // Vendas do dia atual
    const vendasDia = await db.get(`
      SELECT IFNULL(SUM(total), 0) as total 
      FROM sales 
      WHERE date(created_at) = date('now')
    `)

    // Total de produtos
    const totalProdutos = await db.get(`
      SELECT COUNT(*) as total 
      FROM products
    `)

    // Vendas por dia (últimos 7 dias)
    const vendasPorDia = await db.all(`
      SELECT 
        date(created_at) as data,
        IFNULL(SUM(total), 0) as total
      FROM sales 
      WHERE created_at >= date('now', '-7 days')
      GROUP BY date(created_at)
      ORDER BY data ASC
    `)

    // Vendas por categoria (últimos 30 dias)
    const vendasPorCategoria = await db.all(`
      SELECT 
        p.categoria,
        IFNULL(SUM(si.subtotal), 0) as total
      FROM sale_items si
      JOIN products p ON si.produto_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= date('now', '-30 days')
      GROUP BY p.categoria
      ORDER BY total DESC
      LIMIT 5
    `)

    // Status do estoque
    const statusEstoque = await db.get(`
      SELECT 
        SUM(CASE WHEN quantidade <= 10 THEN 1 ELSE 0 END) as baixo,
        SUM(CASE WHEN quantidade > 10 AND quantidade <= 50 THEN 1 ELSE 0 END) as normal,
        SUM(CASE WHEN quantidade > 50 THEN 1 ELSE 0 END) as alto
      FROM products
    `)

    const stats = {
      vendas_mes: vendasMes?.total || 0,
      vendas_dia: vendasDia?.total || 0,
      total_produtos: totalProdutos?.total || 0,
      vendas_por_dia: vendasPorDia || [],
      vendas_por_categoria: vendasPorCategoria || [],
      status_estoque: statusEstoque || { baixo: 0, normal: 0, alto: 0 }
    }

    res.json(stats)
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router 