import { Router } from 'express'
import { getDatabase } from '../database/connection'

const router = Router()

// Listar todos os registros de estoque
router.get('/', async (req, res) => {
  try {
    const db = getDatabase()
    
    const [rows] = await db.execute(`
      SELECT 
        e.*,
        p.descricao as produto_descricao,
        p.categoria,
        p.valor_venda,
        u.username as usuario_nome
      FROM estoque e
      JOIN products p ON e.produto_id = p.id
      LEFT JOIN users u ON e.usuario_id = u.id
      ORDER BY e.created_at DESC
    `)
    
    res.json(rows)
  } catch (error) {
    console.error('Erro ao buscar estoque:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Buscar produtos disponíveis para PDV (baseado no estoque conferido - vendidos)
router.get('/produtos-disponiveis', async (req, res) => {
  try {
    const db = getDatabase()
    
    const [rows] = await db.execute(`
      SELECT 
        p.id,
        p.descricao,
        p.categoria,
        p.valor_unitario,
        p.valor_venda,
        p.codigo_barras_1,
        p.codigo_barras_2,
        COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) as estoque_conferido,
        COALESCE(SUM(CASE WHEN e.tipo = 'perda' THEN e.quantidade ELSE 0 END), 0) as perdas,
        COALESCE(pv.quantidade_vendida, 0) as quantidade_vendida,
        (COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) -
         COALESCE(pv.quantidade_vendida, 0)) as quantidade_disponivel
      FROM products p
      LEFT JOIN estoque e ON p.id = e.produto_id
      LEFT JOIN produto_vendas pv ON p.id = pv.produto_id
      GROUP BY p.id, p.descricao, p.categoria, p.valor_unitario, p.valor_venda, p.codigo_barras_1, p.codigo_barras_2, pv.quantidade_vendida
      HAVING quantidade_disponivel > 0
      ORDER BY p.descricao
    `)
    
    res.json(rows)
  } catch (error) {
    console.error('Erro ao buscar produtos disponíveis:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Obter resumo de conferidos, perdas e vendidos
router.get('/resumo', async (req, res) => {
  try {
    const db = getDatabase()
    
    // Buscar conferidos e perdas
    const [estoqueRows] = await db.execute(`
      SELECT 
        tipo,
        SUM(quantidade) as total_quantidade,
        SUM(valor_total) as total_valor
      FROM estoque
      WHERE tipo IN ('conferido', 'perda')
      GROUP BY tipo
    `)
    
    // Buscar vendidos
    const [vendasRows] = await db.execute(`
      SELECT 
        SUM(pv.quantidade_vendida) as total_vendidos,
        SUM(pv.quantidade_vendida * p.valor_venda) as valor_vendidos
      FROM produto_vendas pv
      JOIN products p ON pv.produto_id = p.id
      WHERE pv.quantidade_vendida > 0
    `)
    
    const resumo = {
      conferidos: { quantidade: 0, valor: 0 },
      perdas: { quantidade: 0, valor: 0 },
      vendidos: { quantidade: 0, valor: 0 }
    }
    
    ;(estoqueRows as any[]).forEach(row => {
      if (row.tipo === 'conferido') {
        resumo.conferidos.quantidade = row.total_quantidade
        resumo.conferidos.valor = parseFloat(row.total_valor)
      } else if (row.tipo === 'perda') {
        resumo.perdas.quantidade = row.total_quantidade
        resumo.perdas.valor = parseFloat(row.total_valor)
      }
    })
    
    const vendasData = vendasRows as any[]
    if (vendasData.length > 0 && vendasData[0].total_vendidos) {
      resumo.vendidos.quantidade = vendasData[0].total_vendidos
      resumo.vendidos.valor = parseFloat(vendasData[0].valor_vendidos || 0)
    }
    
    res.json(resumo)
  } catch (error) {
    console.error('Erro ao buscar resumo de estoque:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Nova rota para buscar detalhes de estoque por produto
router.get('/detalhes', async (req, res) => {
  try {
    const db = getDatabase()
    
    const [rows] = await db.execute(`
      SELECT 
        p.id,
        p.descricao,
        p.categoria,
        p.valor_venda,
        COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) as estoque_conferido,
        COALESCE(SUM(CASE WHEN e.tipo = 'perda' THEN e.quantidade ELSE 0 END), 0) as perdas,
        COALESCE(pv.quantidade_vendida, 0) as quantidade_vendida,
        (COALESCE(SUM(CASE WHEN e.tipo = 'conferido' THEN e.quantidade ELSE 0 END), 0) -
         COALESCE(pv.quantidade_vendida, 0)) as quantidade_disponivel,
        GROUP_CONCAT(DISTINCT CASE WHEN e.tipo = 'conferido' THEN u.username END SEPARATOR ', ') as conferentes,
        MAX(CASE WHEN e.tipo = 'conferido' THEN e.created_at END) as ultima_conferencia
      FROM products p
      LEFT JOIN estoque e ON p.id = e.produto_id
      LEFT JOIN users u ON e.usuario_id = u.id
      LEFT JOIN produto_vendas pv ON p.id = pv.produto_id
      GROUP BY p.id, p.descricao, p.categoria, p.valor_venda, pv.quantidade_vendida
      HAVING estoque_conferido > 0 OR quantidade_vendida > 0
      ORDER BY p.descricao
    `)
    
    res.json(rows)
  } catch (error) {
    console.error('Erro ao buscar detalhes de estoque:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Registrar conferência ou perda (rota direta para compatibilidade)
router.post('/', async (req, res) => {
  try {
    const { produto_id, tipo, quantidade, valor_unitario, observacoes, usuario_id } = req.body
    
    if (!produto_id || !tipo || !quantidade) {
      return res.status(400).json({ error: 'Dados obrigatórios: produto_id, tipo, quantidade' })
    }
    
    const db = getDatabase()
    
    // Se valor_unitario não foi fornecido, buscar do produto
    let valorUnitario = valor_unitario
    let valorVenda = valor_unitario
    
    if (!valorUnitario) {
      const [productRows] = await db.execute(
        'SELECT valor_unitario, valor_venda FROM products WHERE id = ?',
        [produto_id]
      )
      
      if (!Array.isArray(productRows) || productRows.length === 0) {
        return res.status(404).json({ error: 'Produto não encontrado' })
      }
      
      const produto = productRows[0] as any
      valorUnitario = parseFloat(produto.valor_unitario)
      valorVenda = parseFloat(produto.valor_venda)
    }
    
    const valor_total = valorVenda * quantidade
    
    // Inserir registro no estoque
    const [result] = await db.execute(
      `INSERT INTO estoque (produto_id, tipo, quantidade, valor_unitario, valor_total, observacoes, usuario_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [produto_id, tipo, quantidade, valorUnitario, valor_total, observacoes || null, usuario_id || null]
    )
    
    res.json({ 
      message: `${tipo === 'conferido' ? 'Conferência' : 'Perda'} registrada com sucesso!`,
      id: (result as any).insertId
    })
  } catch (error) {
    console.error('Erro ao registrar no estoque:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Registrar conferência ou perda
router.post('/registrar', async (req, res) => {
  try {
    const { produto_id, tipo, quantidade, observacoes, usuario_id } = req.body
    
    if (!produto_id || !tipo || !quantidade) {
      return res.status(400).json({ error: 'Dados obrigatórios: produto_id, tipo, quantidade' })
    }
    
    const db = getDatabase()
    
    // Buscar dados do produto
    const [productRows] = await db.execute(
      'SELECT valor_unitario, valor_venda FROM products WHERE id = ?',
      [produto_id]
    )
    
    if (!Array.isArray(productRows) || productRows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' })
    }
    
    const produto = productRows[0] as any
    const valor_unitario = parseFloat(produto.valor_unitario)
    const valor_venda = parseFloat(produto.valor_venda)
    const valor_total = valor_venda * quantidade // Usar valor de venda para calcular o total
    
    // Inserir registro no estoque
    const [result] = await db.execute(
      `INSERT INTO estoque (produto_id, tipo, quantidade, valor_unitario, valor_total, observacoes, usuario_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [produto_id, tipo, quantidade, valor_unitario, valor_total, observacoes || null, usuario_id || null]
    )
    
    res.json({ 
      message: `${tipo === 'conferido' ? 'Conferência' : 'Perda'} registrada com sucesso!`,
      id: (result as any).insertId
    })
  } catch (error) {
    console.error('Erro ao registrar no estoque:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Excluir registro de estoque
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    await db.execute('DELETE FROM estoque WHERE id = ?', [id])
    
    res.json({ message: 'Registro removido com sucesso!' })
  } catch (error) {
    console.error('Erro ao remover registro:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// Nova rota para buscar detalhes de conferência por produto
router.get('/produto/:id/conferencias', async (req, res) => {
  try {
    const { id } = req.params
    const db = getDatabase()
    
    const [rows] = await db.execute(`
      SELECT 
        e.*,
        u.username as usuario_nome,
        p.descricao as produto_descricao
      FROM estoque e
      LEFT JOIN users u ON e.usuario_id = u.id
      JOIN products p ON e.produto_id = p.id
      WHERE e.produto_id = ? AND e.tipo = 'conferido'
      ORDER BY e.created_at DESC
    `, [id])
    
    res.json(rows)
  } catch (error) {
    console.error('Erro ao buscar conferências do produto:', error)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router 