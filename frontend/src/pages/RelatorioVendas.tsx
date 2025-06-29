import { useState } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { 
  FileText, 
  Calendar,
  Download,
  Eye,
  Lock
} from 'lucide-react'

interface ProdutoVendido {
  produto_nome: string
  categoria: string
  quantidade: number
  valor_unitario: number
  subtotal: number
  venda_id: number
  data_venda: string
  hora_venda: string
  vendedor_nome: string
}

interface VendaPorDia {
  data: string
  total_vendas_dia: number
  faturamento_dia: number
  ticket_medio_dia: number
}

interface ReportData {
  periodo: {
    startDate: string
    endDate: string
  }
  resumo: {
    total_periodo: number
    total_vendas: number
  }
  vendas_por_dia: VendaPorDia[]
  produtos_vendidos: ProdutoVendido[]
}

export default function RelatorioVendas() {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const year = firstDay.getFullYear()
    const month = String(firstDay.getMonth() + 1).padStart(2, '0')
    const day = String(firstDay.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  
  const [endDate, setEndDate] = useState(() => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
  
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  
  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'gerente'
  const canViewValues = isAdmin || isManager

  // Função auxiliar para formatar datas de forma robusta
  const formatDateHelper = (dateString: string) => {
    if (!dateString) return ''
    
    // Lidar com datas ISO completas (ex: 2025-06-10T03:00:00.000Z)
    if (dateString.includes('T')) {
      const dateOnly = dateString.split('T')[0]
      const parts = dateOnly.split('-')
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`
      }
    }
    
    // Lidar com datas simples (ex: 2025-06-10)
    const parts = dateString.split('-')
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    
    return dateString
  }

  const generateReport = async () => {
    if (!startDate || !endDate) {
      toast.error('Selecione o período do relatório')
      return
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Data inicial deve ser anterior à data final')
      return
    }

    setLoading(true)
    try {
      const response = await api.get('/sales/report/period', {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      })
      
      setReportData(response.data)
      toast.success('Relatório gerado com sucesso!')
    } catch (error: any) {
      console.error('Erro ao gerar relatório:', error)
      toast.error('Erro ao gerar relatório')
    } finally {
      setLoading(false)
    }
  }

  const generatePDF = () => {
    if (!reportData) {
      toast.error('Gere o relatório primeiro')
      return
    }

    const formatCurrency = (value: number) => {
      return `R$ ${value.toFixed(2).replace('.', ',')}`
    }

    const pdfContent = `
      <html>
        <head>
          <title>Relatório de Vendas</title>
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
            .period {
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
            .summary-item {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              padding: 5px 0;
              border-bottom: 1px dotted #ccc;
            }
            .summary-item span {
              white-space: nowrap;
            }
            .summary-item:last-child {
              border-bottom: none;
              font-weight: bold;
              font-size: 16px;
            }
            .section {
              margin-bottom: 25px;
            }
            .section h3 {
              background: #333;
              color: white;
              padding: 10px;
              margin: 0 0 15px 0;
              border-radius: 4px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
              font-size: 11px;
              table-layout: fixed;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
              white-space: nowrap;
              vertical-align: top;
            }
            th {
              background: #f8f9fa;
              font-weight: bold;
            }
            .text-right {
              text-align: right;
              white-space: nowrap;
            }
            .text-center {
              text-align: center;
              white-space: nowrap;
            }
            .no-data {
              text-align: center;
              color: #666;
              font-style: italic;
              padding: 20px;
            }
            .categoria-header {
              background: #e8f4f8;
              font-weight: bold;
            }
            .col-produto { 
              width: 30%; 
              white-space: normal !important;
              word-wrap: break-word;
              line-height: 1.2;
              padding: 8px 6px !important;
              vertical-align: top;
            }
            .col-qtd { width: 8%; }
            .col-valor { width: 12%; min-width: 80px; }
            .col-subtotal { width: 12%; min-width: 80px; }
            .col-data { width: 12%; }
            .col-hora { width: 10%; }
            .col-vendedor { width: 16%; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">MIXJOVIM</div>
            <div class="report-title">RELATÓRIO DE VENDAS</div>
            <div class="period">Período: ${formatDateHelper(reportData.periodo.startDate)} a ${formatDateHelper(reportData.periodo.endDate)}</div>
          </div>

          <div class="summary">
            <h3>Resumo Geral do Período</h3>
            <div class="summary-item">
              <span>Total de Vendas:</span>
              <span>${reportData.resumo.total_vendas || 0}</span>
            </div>
            <div class="summary-item">
              <span>Faturamento Total:</span>
              <span>${formatCurrency(Number(reportData.resumo.total_periodo || 0))}</span>
            </div>
            <div class="summary-item">
              <span>Ticket Médio:</span>
              <span>${reportData.resumo.total_vendas ? formatCurrency(Number(reportData.resumo.total_periodo || 0) / reportData.resumo.total_vendas) : 'R$ 0,00'}</span>
            </div>
          </div>

          <div class="summary">
            <h3>Produtos Vendidos no Período</h3>
            <table>
              <thead>
                <tr class="categoria-header">
                  <th class="col-produto">Produto</th>
                  <th class="col-qtd text-center">Qtd</th>
                  <th class="col-valor text-right">Valor Unit.</th>
                  <th class="col-subtotal text-right">Subtotal</th>
                  <th class="col-data text-center">Data</th>
                  <th class="col-hora text-center">Hora</th>
                  <th class="col-vendedor">Vendedor</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.produtos_vendidos.map(produto => `
                  <tr>
                    <td class="col-produto">${produto.produto_nome}</td>
                    <td class="col-qtd text-center">${produto.quantidade}</td>
                    <td class="col-valor text-right">${formatCurrency(Number(produto.valor_unitario || 0))}</td>
                    <td class="col-subtotal text-right">${formatCurrency(Number(produto.subtotal || 0))}</td>
                    <td class="col-data text-center">${formatDateHelper(produto.data_venda)}</td>
                    <td class="col-hora text-center">${produto.hora_venda}</td>
                    <td class="col-vendedor">${produto.vendedor_nome}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="summary">
            <h3>Vendas por Dia</h3>
            <table>
              <thead>
                <tr class="categoria-header">
                  <th>Data</th>
                  <th class="text-center">Vendas</th>
                  <th class="text-right">Faturamento</th>
                  <th class="text-right">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                ${reportData.vendas_por_dia.map(dia => `
                  <tr>
                    <td>${formatDateHelper(dia.data)}</td>
                    <td class="text-center">${dia.total_vendas_dia}</td>
                    <td class="text-right">${formatCurrency(Number(dia.faturamento_dia || 0))}</td>
                    <td class="text-right">${formatCurrency(Number(dia.ticket_medio_dia || 0))}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
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

  // Se não for admin nem gerente, mostrar tela de acesso restrito
  if (!canViewValues) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <Lock className="w-24 h-24 mx-auto text-gray-600 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Acesso Restrito</h2>
            <p className="text-gray-400">
              Este relatório contém informações financeiras sensíveis e está disponível apenas para administradores e gerentes.
            </p>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-300">
              <strong>Motivo:</strong> Proteção de dados comerciais confidenciais
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center">
          <FileText className="w-8 h-8 mr-3 text-mixjovim-gold" />
          Relatório de Vendas
        </h1>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Período do Relatório
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Data Inicial
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Data Final
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
            />
          </div>
          
          <button
            onClick={generateReport}
            disabled={loading}
            className="btn-gold flex items-center justify-center disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                Gerando...
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Gerar Relatório
              </>
            )}
          </button>
        </div>
      </div>

      {/* Resultados */}
      {reportData && (
        <div className="space-y-6">
          {/* Resumo Geral */}
          <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Resumo Geral do Período
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {formatDateHelper(reportData.periodo.startDate)} até {formatDateHelper(reportData.periodo.endDate)}
                </p>
              </div>
              <button
                onClick={generatePDF}
                className="btn-gold flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Baixar PDF
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400">Total de Vendas</div>
                <div className="text-2xl font-bold text-white">
                  {reportData.resumo.total_vendas || 0}
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400">Faturamento Total</div>
                <div className="text-2xl font-bold text-green-400">
                  R$ {Number(reportData.resumo.total_periodo || 0).toFixed(2)}
                </div>
              </div>
              
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400">Ticket Médio</div>
                <div className="text-2xl font-bold text-mixjovim-gold">
                  R$ {reportData.resumo.total_vendas ? 
                    (Number(reportData.resumo.total_periodo || 0) / reportData.resumo.total_vendas).toFixed(2) : 
                    '0.00'
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Produtos Vendidos */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Produtos Vendidos no Período</h2>
            </div>
            
            {reportData.produtos_vendidos.length > 0 ? (
              <div className="overflow-x-auto scrollbar-custom">
                <table className="w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                        Produto
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                        Qtd
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                        Valor Unit.
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                        Subtotal
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                        Data
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                        Hora
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                        Vendedor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {reportData.produtos_vendidos.map((produto, index) => (
                      <tr key={index} className="hover:bg-gray-800">
                        <td className="px-4 py-4 text-sm text-white font-medium">
                          {produto.produto_nome}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300 text-center">
                          {produto.quantidade}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300 text-right">
                          R$ {Number(produto.valor_unitario || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-green-400 text-right">
                          R$ {Number(produto.subtotal || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300 text-center">
                          {formatDateHelper(produto.data_venda)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300 text-center">
                          {produto.hora_venda}
                        </td>
                        <td className="px-6 py-4 text-sm text-white font-medium">
                          {produto.vendedor_nome}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-gray-600 mb-4" />
                <p className="text-gray-400">Nenhum produto vendido encontrado</p>
              </div>
            )}
          </div>

          {/* Vendas por Dia */}
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Vendas por Dia</h2>
            </div>
            
            {reportData.vendas_por_dia.length > 0 ? (
              <div className="overflow-x-auto scrollbar-custom">
                <table className="w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase">
                        Data
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase">
                        Vendas
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                        Faturamento
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase">
                        Ticket Médio
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {reportData.vendas_por_dia.map((dia, index) => (
                      <tr key={index} className="hover:bg-gray-800">
                        <td className="px-6 py-4 text-sm text-white font-medium">
                          {formatDateHelper(dia.data)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300 text-center">
                          {dia.total_vendas_dia}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-green-400 text-right">
                          R$ {Number(dia.faturamento_dia || 0).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-mixjovim-gold text-right">
                          R$ {Number(dia.ticket_medio_dia || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-gray-400">Nenhuma venda encontrada no período selecionado</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 