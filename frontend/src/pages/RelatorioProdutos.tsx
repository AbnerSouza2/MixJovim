import React, { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { 
  Package, 
  Search,
  Download,
  Filter
} from 'lucide-react'

interface Product {
  id: number
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_venda: number
  categoria: string
  codigo_barras_1?: string
  codigo_barras_2?: string
}

export default function RelatorioProdutos() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stockFilter, setStockFilter] = useState('all')

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    filterProducts()
  }, [products, searchTerm, categoryFilter, stockFilter])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const response = await api.get('/products/all')
      const productsWithNumbers = response.data.map((product: any) => ({
        ...product,
        valor_unitario: Number(product.valor_unitario) || 0,
        valor_venda: Number(product.valor_venda) || 0,
        quantidade: Number(product.quantidade) || 0
      }))
      setProducts(productsWithNumbers)
    } catch (error: any) {
      console.error('Erro ao carregar produtos:', error)
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }

  const filterProducts = () => {
    let filtered = [...products]

    // Filtro por termo de busca
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.codigo_barras_1?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.codigo_barras_2?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro por categoria
    if (categoryFilter) {
      filtered = filtered.filter(product => product.categoria === categoryFilter)
    }

    // Filtro por estoque
    if (stockFilter === 'low') {
      filtered = filtered.filter(product => product.quantidade <= 5)
    } else if (stockFilter === 'zero') {
      filtered = filtered.filter(product => product.quantidade === 0)
    } else if (stockFilter === 'available') {
      filtered = filtered.filter(product => product.quantidade > 0)
    }

    setFilteredProducts(filtered)
  }

  const getUniqueCategories = () => {
    const categories = products.map(product => product.categoria)
    return Array.from(new Set(categories)).filter(cat => cat && cat !== 'Selecione a categoria')
  }

  const getStockSummary = () => {
    const total = products.length
    const withStock = products.filter(p => p.quantidade > 0).length
    const lowStock = products.filter(p => p.quantidade <= 5 && p.quantidade > 0).length
    const zeroStock = products.filter(p => p.quantidade === 0).length
    const totalValue = products.reduce((sum, p) => sum + (p.quantidade * p.valor_venda), 0)

    return { total, withStock, lowStock, zeroStock, totalValue }
  }

  const generatePDF = () => {
    const summary = getStockSummary()
    
    const formatCurrency = (value: number) => {
      return `R$ ${value.toFixed(2).replace('.', ',')}`
    }

    const pdfContent = `
      <html>
        <head>
          <title>Relatório de Produtos</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 20px; 
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 15px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              color: #d4af37;
              margin-bottom: 5px;
            }
            .report-title {
              font-size: 18px;
              margin-bottom: 10px;
            }
            .date {
              font-size: 14px;
              color: #666;
            }
            .summary {
              background: #f5f5f5;
              padding: 15px;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .summary h3 {
              margin-top: 0;
              color: #333;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
            }
            .summary-item {
              display: flex;
              justify-content: space-between;
              padding: 5px 0;
              border-bottom: 1px dotted #ccc;
            }
            .filters {
              background: #e8f4f8;
              padding: 10px;
              border-radius: 4px;
              margin-bottom: 20px;
              font-size: 12px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background: #f8f9fa;
              font-weight: bold;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .low-stock {
              background: #fff3cd;
            }
            .zero-stock {
              background: #f8d7da;
            }
            .no-data {
              text-align: center;
              color: #666;
              font-style: italic;
              padding: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">MIXJOVIM</div>
            <div class="report-title">RELATÓRIO DE PRODUTOS</div>
            <div class="date">Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</div>
          </div>

          <div class="summary">
            <h3>Resumo do Estoque</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <span>Total de Produtos:</span>
                <span>${summary.total}</span>
              </div>
              <div class="summary-item">
                <span>Com Estoque:</span>
                <span>${summary.withStock}</span>
              </div>
              <div class="summary-item">
                <span>Estoque Baixo (≤5):</span>
                <span>${summary.lowStock}</span>
              </div>
              <div class="summary-item">
                <span>Estoque Zerado:</span>
                <span>${summary.zeroStock}</span>
              </div>
            </div>
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #ccc;">
              <div class="summary-item" style="border: none; font-weight: bold; font-size: 14px;">
                <span>Valor Total do Estoque:</span>
                <span>${formatCurrency(summary.totalValue)}</span>
              </div>
            </div>
          </div>

          ${searchTerm || categoryFilter || stockFilter !== 'all' ? `
            <div class="filters">
              <strong>Filtros Aplicados:</strong>
              ${searchTerm ? `Busca: "${searchTerm}" | ` : ''}
              ${categoryFilter ? `Categoria: "${categoryFilter}" | ` : ''}
              ${stockFilter !== 'all' ? `Estoque: ${stockFilter === 'low' ? 'Baixo' : stockFilter === 'zero' ? 'Zerado' : 'Disponível'}` : ''}
            </div>
          ` : ''}

          <div class="section">
            <h3>Lista de Produtos (${filteredProducts.length} produtos)</h3>
            ${filteredProducts.length > 0 ? `
              <table>
                <thead>
                  <tr>
                    <th style="width: 40%">Produto</th>
                    <th style="width: 15%">Categoria</th>
                    <th class="text-center" style="width: 10%">Estoque</th>
                    <th class="text-right" style="width: 15%">Valor Unitário</th>
                    <th class="text-right" style="width: 15%">Valor Venda</th>
                    <th class="text-right" style="width: 15%">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredProducts.map(produto => `
                    <tr class="${produto.quantidade === 0 ? 'zero-stock' : produto.quantidade <= 5 ? 'low-stock' : ''}">
                      <td>
                        <strong>${produto.descricao}</strong>
                        ${produto.codigo_barras_1 || produto.codigo_barras_2 ? 
                          `<br><small>Códigos: ${produto.codigo_barras_1 || ''} ${produto.codigo_barras_2 || ''}</small>` : 
                          ''
                        }
                      </td>
                      <td>${produto.categoria}</td>
                      <td class="text-center">${produto.quantidade}</td>
                      <td class="text-right">${formatCurrency(produto.valor_unitario)}</td>
                      <td class="text-right">${formatCurrency(produto.valor_venda)}</td>
                      <td class="text-right">${formatCurrency(produto.quantidade * produto.valor_venda)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<div class="no-data">Nenhum produto encontrado com os filtros aplicados</div>'}
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(pdfContent)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  const summary = getStockSummary()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <Package className="w-8 h-8 mr-3 text-mixjovim-gold" />
          Relatório de Produtos
        </h1>
        <button
          onClick={generatePDF}
          className="btn-gold flex items-center"
        >
          <Download className="w-4 h-4 mr-2" />
          Baixar PDF
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="text-sm text-gray-400">Total de Produtos</div>
          <div className="text-2xl font-bold text-white">{summary.total}</div>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="text-sm text-gray-400">Com Estoque</div>
          <div className="text-2xl font-bold text-green-400">{summary.withStock}</div>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="text-sm text-gray-400">Estoque Baixo</div>
          <div className="text-2xl font-bold text-yellow-400">{summary.lowStock}</div>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
          <div className="text-sm text-gray-400">Estoque Zerado</div>
          <div className="text-2xl font-bold text-red-400">{summary.zeroStock}</div>
        </div>
      </div>

      {/* Valor Total do Estoque */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <div className="text-center">
          <div className="text-sm text-gray-400">Valor Total do Estoque</div>
          <div className="text-3xl font-bold text-mixjovim-gold">
            R$ {summary.totalValue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Filter className="w-5 h-5 mr-2" />
          Filtros
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Buscar Produto
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Nome ou código..."
                className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Categoria
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
            >
              <option value="">Todas as categorias</option>
              {getUniqueCategories().map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Situação do Estoque
            </label>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
            >
              <option value="all">Todos</option>
              <option value="available">Com estoque</option>
              <option value="low">Estoque baixo (≤5)</option>
              <option value="zero">Estoque zerado</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('')
                setCategoryFilter('')
                setStockFilter('all')
              }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </div>

      {/* Tabela de Produtos */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">
            Lista de Produtos ({filteredProducts.length} de {products.length})
          </h2>
        </div>
        
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-mixjovim-gold"></div>
            <p className="mt-2 text-gray-400">Carregando produtos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                    Produto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                    Categoria
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                    Estoque
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                    Valor Unitário
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                    Valor Venda
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                    Valor Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredProducts.map((product) => (
                  <tr 
                    key={product.id} 
                    className={`hover:bg-gray-800 transition-colors ${
                      product.quantidade === 0 ? 'bg-red-900/20' : 
                      product.quantidade <= 5 ? 'bg-yellow-900/20' : ''
                    }`}
                  >
                    <td className="px-6 py-4 text-sm">
                      <div className="text-white font-medium">{product.descricao}</div>
                      {(product.codigo_barras_1 || product.codigo_barras_2) && (
                        <div className="text-xs text-gray-400">
                          Códigos: {product.codigo_barras_1} {product.codigo_barras_2}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">
                      {product.categoria}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      <span className={`font-bold ${
                        product.quantidade === 0 ? 'text-red-400' :
                        product.quantidade <= 5 ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        {product.quantidade}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300 text-right">
                      R$ {product.valor_unitario.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-green-400 text-right">
                      R$ {product.valor_venda.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-mixjovim-gold text-right">
                      R$ {(product.quantidade * product.valor_venda).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
} 