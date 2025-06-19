import React, { useState, useEffect } from 'react'
import { Plus, Trash2, ClipboardCheck, AlertTriangle, Calendar, Package, User, ShoppingCart, Search, X, Eye } from 'lucide-react'
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
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredDetalhes, setFilteredDetalhes] = useState<DetalheProduto[]>([])
  const [filteredRegistros, setFilteredRegistros] = useState<EstoqueItem[]>([])
  
  // Estados para modal de detalhes das perdas
  const [showLossDetailsModal, setShowLossDetailsModal] = useState(false)
  const [lossDetails, setLossDetails] = useState<any[]>([])
  const [selectedProductForLossDetails, setSelectedProductForLossDetails] = useState<DetalheProduto | null>(null)
  
  const { user } = useAuth()

  const fetchEstoque = async () => {
    try {
      const response = await fetch('/api/estoque')
      if (response.ok) {
        const data = await response.json()
        setRegistros(data)
        setFilteredRegistros(data)
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
        setFilteredDetalhes(data)
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

  // Função para mostrar detalhes das perdas
  const showLossDetails = async (produto: DetalheProduto) => {
    if (!produto.id || !produto.perdas || produto.perdas === 0) {
      alert('Este produto não tem perdas registradas')
      return
    }

    try {
      const response = await fetch(`/api/estoque/produto/${produto.id}/perdas`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setLossDetails(data)
        setSelectedProductForLossDetails(produto)
        setShowLossDetailsModal(true)
      } else {
        alert('Erro ao buscar detalhes das perdas')
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes das perdas:', error)
      alert('Erro ao buscar detalhes das perdas')
    }
  }

  // Função para mostrar detalhes de uma perda específica
  const showSingleLossDetail = (registro: EstoqueItem) => {
    if (registro.tipo !== 'perda') return
    
    // Criar um objeto de produto fictício para usar o modal existente
    const produtoFicticio: DetalheProduto = {
      id: registro.produto_id,
      descricao: registro.produto_descricao,
      categoria: registro.categoria,
      valor_venda: registro.valor_venda,
      estoque_conferido: 0,
      perdas: registro.quantidade,
      quantidade_vendida: 0,
      quantidade_disponivel: 0
    }
    
    // Criar um array com apenas este registro de perda
    const perdaEspecifica = [{
      id: registro.id,
      produto_id: registro.produto_id,
      tipo: registro.tipo,
      quantidade: registro.quantidade,
      valor_unitario: registro.valor_unitario,
      valor_total: registro.valor_venda * registro.quantidade,
      observacoes: registro.observacoes,
      usuario_nome: registro.usuario_nome,
      created_at: registro.created_at,
      produto_descricao: registro.produto_descricao
    }]
    
    setLossDetails(perdaEspecifica)
    setSelectedProductForLossDetails(produtoFicticio)
    setShowLossDetailsModal(true)
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([fetchEstoque(), fetchResumo(), fetchDetalhes()])
      setLoading(false)
    }
    loadData()
  }, [])

  // Filtrar dados baseado no termo de busca
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredDetalhes(detalhes)
      setFilteredRegistros(registros)
    } else {
      const lowerSearchTerm = searchTerm.toLowerCase()
      
      // Filtrar detalhes
      const filteredDet = detalhes.filter(produto =>
        produto.descricao.toLowerCase().includes(lowerSearchTerm) ||
        produto.categoria.toLowerCase().includes(lowerSearchTerm)
      )
      setFilteredDetalhes(filteredDet)
      
      // Filtrar registros
      const filteredReg = registros.filter(registro =>
        registro.produto_descricao.toLowerCase().includes(lowerSearchTerm) ||
        registro.categoria.toLowerCase().includes(lowerSearchTerm) ||
        (registro.usuario_nome && registro.usuario_nome.toLowerCase().includes(lowerSearchTerm))
      )
      setFilteredRegistros(filteredReg)
    }
  }, [searchTerm, detalhes, registros])

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
          <div className="flex justify-between items-center px-6">
            <nav className="flex space-x-8">
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
            
            {/* Filtro de Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-mixjovim-gold focus:border-mixjovim-gold w-64"
              />
            </div>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'detalhes' ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-4">Controle Vendidos/Estoque</h2>
              
              {filteredDetalhes.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">
                    {searchTerm ? 'Nenhum produto encontrado com este filtro' : 'Nenhum produto com estoque ou vendas'}
                  </p>
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
                      {filteredDetalhes.map((produto) => (
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
                          <td className="py-3 px-4 text-center">
                            {produto.perdas > 0 ? (
                              <button
                                onClick={() => showLossDetails(produto)}
                                className="text-red-400 font-bold hover:text-red-300 cursor-pointer"
                                title="Ver motivos das perdas"
                              >
                                {produto.perdas}
                              </button>
                            ) : (
                              <span className="text-gray-400">0</span>
                            )}
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
              
              {filteredRegistros.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">
                    {searchTerm ? 'Nenhum registro encontrado com este filtro' : 'Nenhum registro encontrado'}
                  </p>
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
                        <th className="text-left py-3 px-4 text-gray-300">Observações</th>
                        <th className="text-left py-3 px-4 text-gray-300">Data</th>
                        <th className="text-left py-3 px-4 text-gray-300">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegistros.map((registro) => (
                        <tr key={registro.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-3 px-4 text-white font-medium">
                            {registro.produto_descricao}
                          </td>
                          <td className="py-3 px-4 text-gray-300">
                            {registro.categoria}
                          </td>
                          <td className="py-3 px-4">
                            {registro.tipo === 'conferido' ? (
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-600/20 text-green-400">
                                Conferido
                              </span>
                            ) : (
                              <button
                                onClick={() => showSingleLossDetail(registro)}
                                className="px-2 py-1 rounded-full text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors cursor-pointer"
                                title="Ver motivo da perda"
                              >
                                Perda
                              </button>
                            )}
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
                          <td className="py-3 px-4 text-sm max-w-xs">
                            {registro.observacoes ? (
                              <div className={`p-2 rounded ${
                                registro.tipo === 'perda' 
                                  ? 'bg-red-900/20 border-l-4 border-red-500' 
                                  : 'bg-gray-800'
                              }`}>
                                <span className={`font-medium ${
                                  registro.tipo === 'perda' ? 'text-red-400' : 'text-gray-300'
                                }`}>
                                  {registro.observacoes}
                                </span>
                              </div>
                            ) : (
                              <span className="text-gray-500 italic">-</span>
                            )}
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

      {/* Modal de Detalhes das Perdas */}
      {showLossDetailsModal && selectedProductForLossDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Detalhes das Perdas</h2>
              <button
                onClick={() => setShowLossDetailsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-2">Produto:</p>
              <p className="text-white font-medium">{selectedProductForLossDetails.descricao}</p>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Categoria: <span className="text-blue-400">{selectedProductForLossDetails.categoria}</span></p>
                <p>Total perdido: <span className="text-red-400 font-medium">{selectedProductForLossDetails.perdas}</span></p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-medium text-white mb-3">Histórico de Perdas e Motivos</h3>
              
              {lossDetails.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhuma perda encontrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lossDetails.map((perda: any) => (
                    <div key={perda.id} className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-red-400" />
                          <span className="text-red-400 font-medium">
                            {perda.usuario_nome || 'Sistema'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {new Date(perda.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-400">Quantidade:</span>
                          <span className="text-red-400 font-medium ml-2">{perda.quantidade}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Valor Perdido:</span>
                          <span className="text-white font-medium ml-2">
                            {formatCurrency(perda.valor_total || (perda.valor_venda * perda.quantidade))}
                          </span>
                        </div>
                      </div>
                      
                      {perda.observacoes && (
                        <div className="bg-gray-800 rounded p-3 border-l-4 border-red-500">
                          <span className="text-red-400 text-sm font-medium">Motivo da Perda:</span>
                          <p className="text-gray-300 text-sm mt-1 font-medium">{perda.observacoes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowLossDetailsModal(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 