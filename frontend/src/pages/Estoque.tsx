import React, { useState, useEffect } from 'react'
import { Plus, Trash2, ClipboardCheck, AlertTriangle, Calendar, Package, User, ShoppingCart } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface EstoqueItem {
  id: number
  produto_id: number
  produto_descricao: string
  categoria: string
  tipo: 'conferido' | 'perda'
  quantidade: number
  valor_unitario: number
  valor_venda: number
  observacoes: string
  usuario_nome: string
  created_at: string
}

interface ResumoEstoque {
  conferidos: { quantidade: number; valor: number }
  perdas: { quantidade: number; valor: number }
  vendidos: { quantidade: number; valor: number }
}

interface DetalheProduto {
  id: number
  descricao: string
  categoria: string
  valor_venda: number
  estoque_conferido: number
  perdas: number
  quantidade_vendida: number
  quantidade_disponivel: number
  conferentes?: string
  ultima_conferencia?: string
}

export default function Estoque() {
  const [registros, setRegistros] = useState<EstoqueItem[]>([])
  const [detalhes, setDetalhes] = useState<DetalheProduto[]>([])
  const [resumo, setResumo] = useState<ResumoEstoque>({
    conferidos: { quantidade: 0, valor: 0 },
    perdas: { quantidade: 0, valor: 0 },
    vendidos: { quantidade: 0, valor: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'historico' | 'detalhes'>('detalhes')
  const { user } = useAuth()

  const fetchEstoque = async () => {
    try {
      const response = await fetch('/api/estoque')
      if (response.ok) {
        const data = await response.json()
        setRegistros(data)
      }
    } catch (error) {
      console.error('Erro ao carregar estoque:', error)
    }
  }

  const fetchDetalhes = async () => {
    try {
      const response = await fetch('/api/estoque/detalhes')
      if (response.ok) {
        const data = await response.json()
        setDetalhes(data)
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error)
    }
  }

  const fetchResumo = async () => {
    try {
      const response = await fetch('/api/estoque/resumo')
      if (response.ok) {
        const data = await response.json()
        setResumo(data)
      }
    } catch (error) {
      console.error('Erro ao carregar resumo:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return

    try {
      const response = await fetch(`/api/estoque/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        fetchEstoque()
        fetchResumo()
        fetchDetalhes()
      }
    } catch (error) {
      console.error('Erro ao excluir registro:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchEstoque(), fetchResumo(), fetchDetalhes()])
      setLoading(false)
    }
    loadData()
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Controle de Estoque</h1>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Conferidos */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Conferido</p>
              <p className="text-2xl font-bold text-green-400">
                {formatCurrency(resumo.conferidos.valor)}
              </p>
              <p className="text-sm text-gray-300">
                {resumo.conferidos.quantidade} itens
              </p>
            </div>
            <div className="p-3 bg-green-600/20 rounded-full">
              <ClipboardCheck className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        {/* Vendidos */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Vendido</p>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrency(resumo.vendidos.valor)}
              </p>
              <p className="text-sm text-gray-300">
                {resumo.vendidos.quantidade} itens
              </p>
            </div>
            <div className="p-3 bg-blue-600/20 rounded-full">
              <ShoppingCart className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Perdas */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total em Perdas</p>
              <p className="text-2xl font-bold text-red-400">
                {formatCurrency(resumo.perdas.valor)}
              </p>
              <p className="text-sm text-gray-300">
                {resumo.perdas.quantidade} itens
              </p>
            </div>
            <div className="p-3 bg-red-600/20 rounded-full">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="border-b border-gray-700">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('detalhes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'detalhes'
                  ? 'border-mixjovim-gold text-mixjovim-gold'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Detalhes por Produto
            </button>
            <button
              onClick={() => setActiveTab('historico')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'historico'
                  ? 'border-mixjovim-gold text-mixjovim-gold'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              Histórico de Registros
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'detalhes' ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-4">Controle Vendidos/Estoque</h2>
              
              {detalhes.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhum produto com estoque ou vendas</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-300">Produto</th>
                        <th className="text-left py-3 px-4 text-gray-300">Categoria</th>
                        <th className="text-center py-3 px-4 text-gray-300">Vendidos/Estoque</th>
                        <th className="text-center py-3 px-4 text-gray-300">Disponível</th>
                        <th className="text-center py-3 px-4 text-gray-300">Perdas</th>
                        <th className="text-left py-3 px-4 text-gray-300">Conferente(s)</th>
                        <th className="text-right py-3 px-4 text-gray-300">Valor Unit.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalhes.map((produto) => (
                        <tr key={produto.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-3 px-4 text-white font-medium">
                            {produto.descricao}
                          </td>
                          <td className="py-3 px-4 text-gray-300">
                            {produto.categoria}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="text-blue-400 font-bold">
                              {produto.quantidade_vendida}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span className="text-green-400 font-bold">
                              {produto.estoque_conferido}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-bold ${
                              produto.quantidade_disponivel > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {produto.quantidade_disponivel}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-red-400">
                            {produto.perdas}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {produto.conferentes ? (
                                <>
                                  <User className="w-4 h-4 text-mixjovim-gold" />
                                  <div className="flex flex-col">
                                    <span className="text-mixjovim-gold font-medium text-sm">
                                      {produto.conferentes}
                                    </span>
                                    {produto.ultima_conferencia && (
                                      <span className="text-gray-400 text-xs">
                                        {formatDate(produto.ultima_conferencia)}
                                      </span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <span className="text-gray-500 italic text-sm">Não conferido</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right text-white">
                            {formatCurrency(produto.valor_venda)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-4">Histórico de Registros</h2>
              
              {registros.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhum registro encontrado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-gray-300">Produto</th>
                        <th className="text-left py-3 px-4 text-gray-300">Categoria</th>
                        <th className="text-left py-3 px-4 text-gray-300">Tipo</th>
                        <th className="text-left py-3 px-4 text-gray-300">Qtd</th>
                        <th className="text-left py-3 px-4 text-gray-300">Valor Unit.</th>
                        <th className="text-left py-3 px-4 text-gray-300">Valor de Venda</th>
                        <th className="text-left py-3 px-4 text-gray-300">Conferente</th>
                        <th className="text-left py-3 px-4 text-gray-300">Data</th>
                        <th className="text-left py-3 px-4 text-gray-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registros.map((registro) => (
                        <tr key={registro.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-3 px-4 text-white font-medium">
                            {registro.produto_descricao}
                          </td>
                          <td className="py-3 px-4 text-gray-300">
                            {registro.categoria}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              registro.tipo === 'conferido' 
                                ? 'bg-green-600/20 text-green-400' 
                                : 'bg-red-600/20 text-red-400'
                            }`}>
                              {registro.tipo === 'conferido' ? 'Conferido' : 'Perda'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-white">
                            {registro.quantidade}
                          </td>
                          <td className="py-3 px-4 text-white">
                            {formatCurrency(registro.valor_unitario)}
                          </td>
                          <td className="py-3 px-4 text-white font-medium">
                            {formatCurrency(registro.valor_venda)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {registro.usuario_nome ? (
                                <>
                                  <User className="w-4 h-4 text-mixjovim-gold" />
                                  <span className="text-mixjovim-gold font-medium">{registro.usuario_nome}</span>
                                </>
                              ) : (
                                <span className="text-gray-500 italic">Sistema</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-300 text-sm">
                            {formatDate(registro.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            {user?.role === 'admin' && (
                              <button
                                onClick={() => handleDelete(registro.id)}
                                className="text-red-400 hover:text-red-300 p-1"
                                title="Excluir registro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
} 