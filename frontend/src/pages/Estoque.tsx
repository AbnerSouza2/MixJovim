import { useState, useEffect } from 'react'
import { Trash2, ClipboardCheck, AlertTriangle, Package, User, Search, X, Printer } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../services/api'

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
  valor_unitario: number
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
  
  // Estados para o modal de impressão de etiquetas
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [selectedProductForLabel, setSelectedProductForLabel] = useState<DetalheProduto | null>(null)
  const [labelQuantity, setLabelQuantity] = useState(1)
  
  // Estados para modal de detalhes das perdas
  const [showLossDetailsModal, setShowLossDetailsModal] = useState(false)
  const [lossDetails, setLossDetails] = useState<any[]>([])
  const [selectedProductForLossDetails, setSelectedProductForLossDetails] = useState<DetalheProduto | null>(null)
  
  const { user } = useAuth()

  // Verificar se pode ver valores financeiros
  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'gerente'
  const canViewValues = isAdmin || isManager

  // Função para formatar valores sensíveis (apenas totais, não valores individuais)
  const formatSensitiveValue = (value: number, type: 'currency' | 'number' = 'currency') => {
    if (!canViewValues) {
      return type === 'currency' ? 'R$ ***' : '***'
    }
    return type === 'currency' ? formatCurrency(value) : value.toString()
  }

  const fetchEstoque = async () => {
    try {
      const response = await api.get('/estoque')
      setRegistros(response.data)
      setFilteredRegistros(response.data)
    } catch (error) {
      console.error('Erro ao carregar estoque:', error)
    }
  }

  const fetchDetalhes = async () => {
    try {
      const response = await api.get('/estoque/detalhes')
      setDetalhes(response.data)
      setFilteredDetalhes(response.data)
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error)
    }
  }

  const fetchResumo = async () => {
    try {
      const response = await api.get('/estoque/resumo')
      setResumo(response.data)
    } catch (error) {
      console.error('Erro ao carregar resumo:', error)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este registro?')) return

    try {
      await api.delete(`/estoque/${id}`)
      fetchEstoque()
      fetchResumo()
      fetchDetalhes()
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
      const response = await api.get(`/estoque/produto/${produto.id}/perdas`)
      setLossDetails(response.data)
      setSelectedProductForLossDetails(produto)
      setShowLossDetailsModal(true)
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
      valor_unitario: registro.valor_unitario,
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

  // Função para imprimir etiqueta do produto
  const handlePrintLabel = (produto: DetalheProduto, quantity: number) => {
    if (quantity <= 0) return;

    const productName = produto.descricao;
    const fromPrice = `DE R$ ${Number(produto.valor_unitario).toFixed(2).replace('.', ',')}`;
    const mainPrice = `R$ ${Number(produto.valor_venda).toFixed(2).replace('.', ',')}`;
    const barcodeValue = `${produto.id}`.padStart(13, '0');
    
    let labelsHtml = '';
    for (let i = 0; i < quantity; i++) {
      labelsHtml += `
        <div class="label">
          <div class="product-name">${productName.toUpperCase()}</div>
          <div class="from-price">${fromPrice}</div>
          <div class="main-price">${mainPrice}</div>
          <div class="barcode-container">
            <svg id="barcode-${i}" class="barcode"></svg>
          </div>
        </div>
      `;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Etiqueta - ${productName}</title>
            <style>
              @page {
                size: 6cm 3cm;
                margin: 0;
              }
              body {
                margin: 0;
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
              }
              .label {
                width: 6cm;
                height: 3cm;
                padding: 1mm;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
                overflow: hidden;
              }
              .product-name {
                font-size: 7pt;
                font-weight: bold;
                line-height: 1;
                margin: 0;
                word-break: break-word;
              }
              .from-price {
                font-size: 7pt;
                color: #000000;
                margin: 0.5mm 0;
              }
              .main-price {
                font-size: 14pt;
                font-weight: 900;
                margin: 0.5mm 0;
              }
              .barcode-container {
                display: flex;
                justify-content: center;
                align-items: center;
                width: 100%;
                height: 14mm;
              }
              .barcode {
                width: 100%;
                height: 100%;
              }
            </style>
          </head>
          <body>
            ${labelsHtml}
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
            <script>
              window.onload = function() {
                try {
                  for (let i = 0; i < ${quantity}; i++) {
                    JsBarcode("#barcode-" + i, "${barcodeValue}", {
                      format: "CODE128",
                      width: 2,
                      height: 40,
                      displayValue: false,
                      background: "transparent"
                    });
                  }
                  window.print();
                } catch (e) {
                  console.error('Erro ao gerar código de barras:', e);
                }
              };
            <\/script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const openLabelModal = (produto: DetalheProduto) => {
    setSelectedProductForLabel(produto);
    setLabelQuantity(1);
    setShowLabelModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Controle de Estoque</h1>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        {/* Conferidos */}
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
                              <p className="text-xs sm:text-sm text-gray-400">Total Conferido</p>
                <p className="text-lg sm:text-2xl font-bold text-green-400">
                  {formatSensitiveValue(resumo.conferidos.valor)}
                </p>
                <p className="text-xs sm:text-sm text-gray-300">
                  {resumo.conferidos.quantidade} itens
                </p>
            </div>
                          <div className="p-2 sm:p-3 bg-green-600/20 rounded-full">
                <ClipboardCheck className="w-6 h-6 sm:w-8 sm:h-8 text-green-400" />
              </div>
          </div>
        </div>

        {/* Perdas */}
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm text-gray-400">Total em Perdas</p>
              <p className="text-lg sm:text-2xl font-bold text-red-400">
                {formatSensitiveValue(resumo.perdas.valor)}
              </p>
              <p className="text-xs sm:text-sm text-gray-300">
                {resumo.perdas.quantidade} itens
              </p>
            </div>
            <div className="p-2 sm:p-3 bg-red-600/20 rounded-full">
              <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="border-b border-gray-700">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center px-3 sm:px-6 space-y-3 lg:space-y-0">
            <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto">
              <button
                onClick={() => setActiveTab('detalhes')}
                className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'detalhes'
                    ? 'border-mixjovim-gold text-mixjovim-gold'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                Detalhes por Produto
              </button>
              <button
                onClick={() => setActiveTab('historico')}
                className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === 'historico'
                    ? 'border-mixjovim-gold text-mixjovim-gold'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                Histórico de Registros
              </button>
            </nav>
            
            {/* Filtro de Busca */}
            <div className="relative w-full lg:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-mixjovim-gold focus:border-mixjovim-gold w-full lg:w-64 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-6">
          {activeTab === 'detalhes' ? (
            <>
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4">Controle Vendidos/Estoque</h2>
              
              {filteredDetalhes.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">
                    {searchTerm ? 'Nenhum produto encontrado com este filtro' : 'Nenhum produto com estoque ou vendas'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto scrollbar-custom">
                  <table className="w-full min-w-[800px]">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Produto</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden sm:table-cell">Categoria</th>
                        <th className="text-center py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Vend./Est.</th>
                        <th className="text-center py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Disp.</th>
                        <th className="text-center py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Perdas</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden lg:table-cell">Conferente(s)</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Valor</th>
                        <th className="text-center py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDetalhes.map((produto) => (
                        <tr key={produto.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-white font-medium text-xs sm:text-sm">
                            <div className="max-w-[150px] sm:max-w-none truncate" title={produto.descricao}>
                              {produto.descricao}
                            </div>
                            <div className="sm:hidden text-xs text-gray-400 mt-1">
                              {produto.categoria}
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden sm:table-cell">
                            {produto.categoria}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-center text-xs sm:text-sm">
                            <span className="text-blue-400 font-bold">
                              {produto.quantidade_vendida}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span className="text-green-400 font-bold">
                              {produto.estoque_conferido}
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-center text-xs sm:text-sm">
                            <span className={`font-bold ${
                              produto.quantidade_disponivel > 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {produto.quantidade_disponivel}
                            </span>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-center text-xs sm:text-sm">
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
                          <td className="py-2 sm:py-3 px-2 sm:px-4 hidden lg:table-cell">
                            <div className="flex items-center gap-2">
                              {produto.conferentes ? (
                                <>
                                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-mixjovim-gold" />
                                  <div className="flex flex-col">
                                    <span className="text-mixjovim-gold font-medium text-xs sm:text-sm">
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
                                <span className="text-gray-500 italic text-xs sm:text-sm">Não conferido</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-white text-xs sm:text-sm">
                            {formatCurrency(produto.valor_venda)} {/* Valor sempre visível para todos */}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-center">
                            <button
                              onClick={() => openLabelModal(produto)}
                              className="inline-flex items-center px-2 py-1 border border-blue-600 rounded-md text-xs font-medium text-blue-300 bg-blue-800/20 hover:bg-blue-700/30 focus:outline-none focus:border-blue-500 transition-colors"
                              title="Imprimir etiqueta do produto"
                            >
                              <Printer className="w-3 h-3 mr-1" />
                              Etiqueta
                            </button>
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
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-3 sm:mb-4">Histórico de Registros</h2>
              
              {filteredRegistros.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">
                    {searchTerm ? 'Nenhum registro encontrado com este filtro' : 'Nenhum registro encontrado'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto scrollbar-custom">
                  <table className="w-full min-w-[1000px]">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Produto</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden sm:table-cell">Categoria</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Tipo</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Qtd</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden md:table-cell">V. Unit.</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">V. Venda</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden lg:table-cell">Conferente</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden xl:table-cell">Observações</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden md:table-cell">Data</th>
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegistros.map((registro) => (
                        <tr key={registro.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-white font-medium text-xs sm:text-sm">
                            <div className="max-w-[120px] sm:max-w-none truncate" title={registro.produto_descricao}>
                              {registro.produto_descricao}
                            </div>
                            <div className="sm:hidden text-xs text-gray-400 mt-1">
                              {registro.categoria}
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden sm:table-cell">
                            {registro.categoria}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm">
                            {registro.tipo === 'conferido' ? (
                              <span className="px-1 sm:px-2 py-1 rounded-full text-xs font-medium bg-green-600/20 text-green-400">
                                Conf.
                              </span>
                            ) : (
                              <button
                                onClick={() => showSingleLossDetail(registro)}
                                className="px-1 sm:px-2 py-1 rounded-full text-xs font-medium bg-red-600/20 text-red-400 hover:bg-red-600/30 transition-colors cursor-pointer"
                                title="Ver motivo da perda"
                              >
                                Perda
                              </button>
                            )}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-white text-xs sm:text-sm">
                            {registro.quantidade}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-white text-xs sm:text-sm hidden md:table-cell">
                            {formatCurrency(registro.valor_unitario)} {/* Valor unitário sempre visível */}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-white font-medium text-xs sm:text-sm">
                            {formatCurrency(registro.valor_venda)} {/* Valor de venda sempre visível */}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 hidden lg:table-cell">
                            <div className="flex items-center gap-1 sm:gap-2">
                              {registro.usuario_nome ? (
                                <>
                                  <User className="w-3 h-3 sm:w-4 sm:h-4 text-mixjovim-gold" />
                                  <span className="text-mixjovim-gold font-medium text-xs sm:text-sm">{registro.usuario_nome}</span>
                                </>
                              ) : (
                                <span className="text-gray-500 italic text-xs sm:text-sm">Sistema</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm max-w-xs hidden xl:table-cell">
                            {registro.observacoes ? (
                              <div className={`p-1 sm:p-2 rounded ${
                                registro.tipo === 'perda' 
                                  ? 'bg-red-900/20 border-l-2 sm:border-l-4 border-red-500' 
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
                          <td className="py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden md:table-cell">
                            {formatDate(registro.created_at)}
                          </td>
                          <td className="py-2 sm:py-3 px-2 sm:px-4">
                            {user?.role === 'admin' && (
                              <button
                                onClick={() => handleDelete(registro.id)}
                                className="text-red-400 hover:text-red-300 p-1"
                                title="Excluir registro"
                              >
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
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

      {/* Modal de Impressão de Etiqueta */}
      {showLabelModal && selectedProductForLabel && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Imprimir Etiquetas</h2>
              <button onClick={() => setShowLabelModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <p className="text-gray-300 mb-2">Produto: <span className="font-bold text-white">{selectedProductForLabel.descricao}</span></p>
              <label htmlFor="label-quantity" className="block text-sm font-medium text-gray-300 mb-2">
                Quantidade de Etiquetas
              </label>
              <input
                type="number"
                id="label-quantity"
                value={labelQuantity}
                onChange={(e) => setLabelQuantity(Number(e.target.value))}
                min="1"
                className="w-full bg-gray-800 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-2 focus:ring-mixjovim-gold focus:outline-none"
              />
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={() => setShowLabelModal(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  handlePrintLabel(selectedProductForLabel, labelQuantity);
                  setShowLabelModal(false);
                }}
                className="px-4 py-2 bg-mixjovim-gold text-gray-900 font-bold rounded-lg hover:bg-yellow-400 transition-colors"
              >
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}

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
                            {formatSensitiveValue(perda.valor_total || (perda.valor_venda * perda.quantidade))} {/* Mantém mascaramento dos totais */}
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