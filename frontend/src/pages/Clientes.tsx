import React, { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Trash2, 
  Eye, 
  Search,
  Calendar,
  Phone,
  FileText,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

interface Cliente {
  id: number
  nome_completo: string
  cpf: string
  whatsapp: string
  data_inscricao: string
  ativo: boolean
  dias_para_vencer: number
  created_at: string
  updated_at: string
}

interface NovoCliente {
  nome_completo: string
  cpf: string
  whatsapp: string
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [itemsPerPage] = useState(15)

  const [novoCliente, setNovoCliente] = useState<NovoCliente>({
    nome_completo: '',
    cpf: '',
    whatsapp: ''
  })

  useEffect(() => {
    loadClientes()
  }, [currentPage, searchTerm])

  const loadClientes = async () => {
    try {
      setLoading(true)
      const response = await api.get('/clientes', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm
        }
      })
      
      setClientes(response.data.clientes || [])
      setTotalPages(response.data.totalPages || 1)
      setTotal(response.data.total || 0)
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
      toast.error('Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  const formatWhatsApp = (value: string) => {
    const numbers = value.replace(/\D/g, '')
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
    }
  }

  const handleCPFChange = (value: string) => {
    const formatted = formatCPF(value)
    if (formatted.replace(/\D/g, '').length <= 11) {
      setNovoCliente(prev => ({ ...prev, cpf: formatted }))
    }
  }

  const handleWhatsAppChange = (value: string) => {
    const formatted = formatWhatsApp(value)
    if (formatted.replace(/\D/g, '').length <= 11) {
      setNovoCliente(prev => ({ ...prev, whatsapp: formatted }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!novoCliente.nome_completo.trim()) {
      toast.error('Nome completo é obrigatório')
      return
    }

    if (novoCliente.cpf.replace(/\D/g, '').length !== 11) {
      toast.error('CPF deve ter 11 dígitos')
      return
    }

    if (novoCliente.whatsapp.replace(/\D/g, '').length < 10) {
      toast.error('WhatsApp deve ter pelo menos 10 dígitos')
      return
    }

    try {
      setLoading(true)
      
      if (editingCliente) {
        await api.put(`/clientes/${editingCliente.id}`, novoCliente)
        toast.success('Cliente atualizado com sucesso!')
      } else {
        await api.post('/clientes', novoCliente)
        toast.success('Cliente criado com sucesso!')
      }
      
      setShowModal(false)
      setEditingCliente(null)
      resetForm()
      await loadClientes()
    } catch (error: any) {
      console.error('Erro ao salvar cliente:', error)
      toast.error(error.response?.data?.error || 'Erro ao salvar cliente')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente)
    setNovoCliente({
      nome_completo: cliente.nome_completo,
      cpf: cliente.cpf,
      whatsapp: cliente.whatsapp
    })
    setShowModal(true)
  }

  const handleDelete = async (clienteId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este cliente?')) {
      return
    }

    try {
      setLoading(true)
      await api.delete(`/clientes/${clienteId}`)
      toast.success('Cliente excluído com sucesso!')
      await loadClientes()
    } catch (error: any) {
      console.error('Erro ao excluir cliente:', error)
      toast.error(error.response?.data?.error || 'Erro ao excluir cliente')
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = async (clienteId: number) => {
    try {
      const response = await api.get(`/clientes/${clienteId}`)
      setSelectedCliente(response.data)
      setShowDetailModal(true)
    } catch (error) {
      console.error('Erro ao carregar detalhes do cliente:', error)
      toast.error('Erro ao carregar detalhes do cliente')
    }
  }

  const resetForm = () => {
    setNovoCliente({
      nome_completo: '',
      cpf: '',
      whatsapp: ''
    })
  }

  const openModal = () => {
    resetForm()
    setEditingCliente(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingCliente(null)
    resetForm()
  }

  const closeDetailModal = () => {
    setShowDetailModal(false)
    setSelectedCliente(null)
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (ativo: boolean, diasParaVencer: number) => {
    if (!ativo) return 'bg-red-600 text-white'
    if (diasParaVencer <= 30) return 'bg-yellow-600 text-white'
    return 'bg-green-600 text-white'
  }

  const getStatusText = (ativo: boolean, diasParaVencer: number) => {
    if (!ativo) return 'Inativo'
    if (diasParaVencer <= 30) return `Expira em ${diasParaVencer} dias`
    return 'Ativo'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Users className="w-8 h-8 mr-3 text-mixjovim-gold" />
            Clientes
          </h1>
          <p className="text-gray-400 mt-1">
            Gerencie seus clientes e aproveite os descontos especiais
          </p>
        </div>
        <button
          onClick={openModal}
          className="btn-gold flex items-center"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Novo Cliente
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex items-center space-x-2 flex-1">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou WhatsApp..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
            />
          </div>
          
          <div className="text-sm text-gray-400">
            {total} cliente{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Tabela de Clientes */}
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-mixjovim-gold"></div>
            <p className="mt-2 text-gray-400">Carregando clientes...</p>
          </div>
        ) : clientes.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-gray-600 mb-4" />
            <p className="text-gray-400">Nenhum cliente encontrado</p>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setCurrentPage(1)
                }}
                className="mt-2 text-mixjovim-gold hover:text-yellow-400"
              >
                Limpar busca
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto scrollbar-custom">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      CPF
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      WhatsApp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Data Inscrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {clientes.map((cliente) => (
                    <tr key={cliente.id} className="hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-mixjovim-gold rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-gray-900">
                              {cliente.nome_completo.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">
                              {cliente.nome_completo}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {cliente.cpf}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <div className="flex items-center">
                          <Phone className="w-4 h-4 mr-2 text-green-400" />
                          {cliente.whatsapp}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2 text-blue-400" />
                          {formatDateTime(cliente.data_inscricao)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(cliente.ativo, cliente.dias_para_vencer)}`}>
                          {getStatusText(cliente.ativo, cliente.dias_para_vencer)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewDetails(cliente.id)}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleEdit(cliente)}
                            className="text-mixjovim-gold hover:text-yellow-400 transition-colors"
                            title="Editar cliente"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDelete(cliente.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Deletar cliente"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
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
                  Página {currentPage} de {totalPages} • {total} clientes
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1
                    if (totalPages <= 5) {
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 text-sm rounded border ${
                            page === currentPage
                              ? 'bg-mixjovim-gold text-black border-mixjovim-gold font-medium'
                              : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    }
                    return null
                  })}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 bg-gray-800 border border-gray-600 rounded text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal de Novo/Editar Cliente */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">
                {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={novoCliente.nome_completo}
                  onChange={(e) => setNovoCliente(prev => ({ ...prev, nome_completo: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
                  placeholder="Digite o nome completo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  CPF
                </label>
                <input
                  type="text"
                  value={novoCliente.cpf}
                  onChange={(e) => handleCPFChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
                  placeholder="000.000.000-00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  WhatsApp
                </label>
                <input
                  type="text"
                  value={novoCliente.whatsapp}
                  onChange={(e) => handleWhatsAppChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
                  placeholder="(19) 98134-5544"
                  required
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn-gold disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : editingCliente ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Cliente */}
      {showDetailModal && selectedCliente && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white flex items-center">
                <FileText className="w-6 h-6 mr-2" />
                Detalhes do Cliente
              </h3>
              <button
                onClick={closeDetailModal}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações básicas */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-sm text-gray-400">Nome Completo</label>
                  <p className="text-lg font-medium text-white">{selectedCliente.nome_completo}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400">CPF</label>
                    <p className="text-white">{selectedCliente.cpf}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-400">WhatsApp</label>
                    <p className="text-white flex items-center">
                      <Phone className="w-4 h-4 mr-2 text-green-400" />
                      {selectedCliente.whatsapp}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status e datas */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Status da Inscrição</h4>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Status:</span>
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedCliente.ativo, selectedCliente.dias_para_vencer)}`}>
                      {getStatusText(selectedCliente.ativo, selectedCliente.dias_para_vencer)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Data de Inscrição:</span>
                    <span className="text-white">{formatDateTime(selectedCliente.data_inscricao)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Dias para Vencer:</span>
                    <span className={`font-medium ${selectedCliente.dias_para_vencer <= 30 ? 'text-yellow-400' : 'text-green-400'}`}>
                      {selectedCliente.ativo ? `${selectedCliente.dias_para_vencer} dias` : 'Expirado'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Benefícios */}
              <div className="bg-mixjovim-gold/10 border border-mixjovim-gold/30 rounded-lg p-4">
                <h4 className="text-sm font-medium text-mixjovim-gold mb-2">💰 Benefícios do Cliente</h4>
                <ul className="text-sm text-gray-300 space-y-1">
                  <li>• 10% de desconto em todas as compras</li>
                  <li>• Validade de 1 ano a partir da inscrição</li>
                  <li>• Histórico de compras personalizado</li>
                </ul>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    closeDetailModal()
                    handleEdit(selectedCliente)
                  }}
                  className="flex-1 btn-gold flex items-center justify-center"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Editar Cliente
                </button>
                <button
                  onClick={closeDetailModal}
                  className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 