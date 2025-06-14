import React, { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { 
  DollarSign, 
  Search, 
  Eye, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Package,
  CreditCard,
  TrendingUp,
  TrendingDown
} from 'lucide-react'

interface Sale {
  id: number
  total: number
  discount: number
  payment_method: string
  created_at: string
  items: SaleItem[]
}

interface SaleItem {
  id: number
  produto_id: number
  quantidade: number
  valor_unitario: number
  subtotal: number
  produto_nome: string
}

export default function Financeiro() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalSales, setTotalSales] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState(0)

  useEffect(() => {
    loadSales()
  }, [selectedDate, currentPage])

  const loadSales = async () => {
    setLoading(true)
    try {
      const response = await api.get('/sales', {
        params: {
          date: selectedDate,
          page: currentPage,
          limit: itemsPerPage
        }
      })
      
      setSales(response.data.sales || [])
      setTotalPages(Math.ceil((response.data.total || 0) / itemsPerPage))
      setTotalSales(response.data.total || 0)
      setTotalRevenue(response.data.totalRevenue || 0)
    } catch (error: any) {
      console.error('Erro ao carregar vendas:', error)
      toast.error('Erro ao carregar vendas')
      setSales([])
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = async (saleId: number) => {
    try {
      const response = await api.get(`/sales/${saleId}`)
      setSelectedSale(response.data)
      setShowDetailModal(true)
    } catch (error) {
      console.error('Erro ao carregar detalhes da venda:', error)
      toast.error('Erro ao carregar detalhes da venda')
    }
  }

  const formatPaymentMethod = (method: string) => {
    const methods: { [key: string]: string } = {
      'dinheiro': 'Dinheiro',
      'cartao_credito': 'Cartão de Crédito',
      'cartao_debito': 'Cartão de Débito',
      'pix': 'PIX',
      'transferencia': 'Transferência Bancária'
    }
    return methods[method] || method
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const formatDisplayDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <DollarSign className="w-8 h-8 mr-3 text-mixjovim-gold" />
          Financeiro
        </h1>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Total de Vendas</p>
              <p className="text-2xl font-bold text-white">{totalSales}</p>
            </div>
            <div className="p-3 bg-blue-600 rounded-full">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Receita Total</p>
              <p className="text-2xl font-bold text-green-400">
                R$ {Number(totalRevenue || 0).toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-green-600 rounded-full">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Ticket Médio</p>
              <p className="text-2xl font-bold text-mixjovim-gold">
                R$ {totalSales > 0 ? (Number(totalRevenue || 0) / totalSales).toFixed(2) : '0.00'}
              </p>
            </div>
            <div className="p-3 bg-orange-600 rounded-full">
              <TrendingDown className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <label className="text-sm font-medium text-gray-300">
              Filtrar por Data:
            </label>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value)
              setCurrentPage(1)
            }}
            className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
          />
          <button
            onClick={() => {
              const today = new Date().toISOString().split('T')[0]
              setSelectedDate(today)
              setCurrentPage(1)
            }}
            className="btn-gold text-sm"
          >
            Hoje
          </button>
        </div>
      </div>

      {/* Tabela de Vendas */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            Vendas do dia {formatDisplayDate(selectedDate)}
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-mixjovim-gold"></div>
            <p className="mt-2 text-gray-400">Carregando vendas...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-8 text-center">
            <DollarSign className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">Nenhuma venda encontrada para esta data</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Data/Hora
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Desconto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Pagamento
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                        #{sale.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatDateTime(sale.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-400">
                        R$ {Number(sale.total || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        R$ {Number(sale.discount || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {formatPaymentMethod(sale.payment_method)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <button
                          onClick={() => handleViewDetails(sale.id)}
                          className="inline-flex items-center px-3 py-1 border border-gray-600 rounded-md text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 focus:outline-none focus:border-mixjovim-gold transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Detalhes
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between">
                <div className="text-sm text-gray-400">
                  Página {currentPage} de {totalPages} ({totalSales} vendas no total)
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Detalhes da Venda */}
      {showDetailModal && selectedSale && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white flex items-center">
                <Eye className="w-6 h-6 mr-2" />
                Detalhes da Venda #{selectedSale.id}
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Informações da Venda */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <CreditCard className="w-5 h-5 mr-2" />
                    Informações da Venda
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Data/Hora:</span>
                      <span className="text-white">{formatDateTime(selectedSale.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Forma de Pagamento:</span>
                      <span className="text-white">{formatPaymentMethod(selectedSale.payment_method)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Subtotal:</span>
                      <span className="text-white">R$ {(Number(selectedSale.total || 0) + Number(selectedSale.discount || 0)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Desconto:</span>
                      <span className="text-red-400">- R$ {Number(selectedSale.discount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-700 pt-3">
                      <span className="text-gray-400 font-semibold">Total:</span>
                      <span className="text-green-400 font-bold text-lg">R$ {Number(selectedSale.total || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Resumo dos Itens */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                    <Package className="w-5 h-5 mr-2" />
                    Resumo dos Itens
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total de Itens:</span>
                      <span className="text-white">{selectedSale.items.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Quantidade Total:</span>
                      <span className="text-white">
                        {selectedSale.items.reduce((sum, item) => sum + item.quantidade, 0)} unidades
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lista de Produtos */}
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-700">
                  <h4 className="text-lg font-semibold text-white">Produtos Vendidos</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                          Produto
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                          Qtd
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                          Valor Unit.
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {selectedSale.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-700">
                          <td className="px-4 py-3 text-sm text-white">
                            {item.produto_nome}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            {item.quantidade}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">
                            R$ {Number(item.valor_unitario || 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-400">
                            R$ {Number(item.subtotal || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 