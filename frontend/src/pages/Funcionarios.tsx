import React, { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { Users, UserPlus, Edit2, Trash2, Eye, EyeOff, Shield, X } from 'lucide-react'

interface User {
  id: number
  username: string
  role: string
  permissions?: {
    pdv: boolean
    products: boolean
    dashboard: boolean
    reports: boolean
  }
}

interface NewUser {
  username: string
  password: string
  role: string
  permissions: {
    pdv: boolean
    products: boolean
    dashboard: boolean
    reports: boolean
  }
}

export default function Funcionarios() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [newUser, setNewUser] = useState<NewUser>({
    username: '',
    password: '',
    role: 'funcionario',
    permissions: {
      pdv: false,
      products: false,
      dashboard: false,
      reports: false
    }
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const response = await api.get('/auth/users')
      setUsers(response.data)
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newUser.username.trim()) {
      toast.error('Nome de usuário é obrigatório')
      return
    }

    if (!newUser.password.trim() && !editingUser) {
      toast.error('Senha é obrigatória')
      return
    }

    try {
      setLoading(true)
      
      if (editingUser) {
        // Editar usuário existente
        const updateData = {
          username: newUser.username,
          role: newUser.role,
          permissions: newUser.permissions,
          ...(newUser.password.trim() && { password: newUser.password })
        }
        
        await api.put(`/auth/users/${editingUser.id}`, updateData)
        toast.success('Usuário atualizado com sucesso!')
      } else {
        // Criar novo usuário
        await api.post('/auth/users', newUser)
        toast.success('Usuário criado com sucesso!')
      }
      
      setShowModal(false)
      setEditingUser(null)
      resetForm()
      loadUsers()
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error)
      toast.error(error.response?.data?.message || 'Erro ao salvar usuário')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setNewUser({
      username: user.username,
      password: '',
      role: user.role,
      permissions: user.permissions || {
        pdv: false,
        products: false,
        dashboard: false,
        reports: false
      }
    })
    setShowModal(true)
  }

  const handleDelete = async (userId: number) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) {
      return
    }

    try {
      setLoading(true)
      await api.delete(`/auth/users/${userId}`)
      toast.success('Usuário excluído com sucesso!')
      loadUsers()
    } catch (error: any) {
      console.error('Erro ao excluir usuário:', error)
      toast.error(error.response?.data?.message || 'Erro ao excluir usuário')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setNewUser({
      username: '',
      password: '',
      role: 'funcionario',
      permissions: {
        pdv: false,
        products: false,
        dashboard: false,
        reports: false
      }
    })
    setShowPassword(false)
  }

  const openModal = () => {
    resetForm()
    setEditingUser(null)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditingUser(null)
    resetForm()
  }

  const handlePermissionChange = (permission: keyof typeof newUser.permissions) => {
    setNewUser(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permission]: !prev.permissions[permission]
      }
    }))
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-600 text-white'
      case 'funcionario':
        return 'bg-blue-600 text-white'
      default:
        return 'bg-gray-600 text-white'
    }
  }

  const getPermissionsBadges = (permissions?: User['permissions']) => {
    if (!permissions) return []
    
    const badges = []
    if (permissions.pdv) badges.push('PDV')
    if (permissions.products) badges.push('Produtos')
    if (permissions.dashboard) badges.push('Dashboard')
    if (permissions.reports) badges.push('Relatórios')
    
    return badges
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <Users className="w-8 h-8 mr-3 text-mixjovim-gold" />
            Gerenciar Funcionários
          </h1>
          <p className="text-gray-400 mt-1">
            Gerencie usuários e suas permissões no sistema
          </p>
        </div>
        <button
          onClick={openModal}
          className="btn-gold flex items-center"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Novo Funcionário
        </button>
      </div>

      {/* Lista de usuários */}
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Função
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Permissões
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-900 divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                    Carregando usuários...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-400">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-mixjovim-gold rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-gray-900">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-white">
                            {user.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                        {user.role === 'admin' ? 'Administrador' : 'Funcionário'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {getPermissionsBadges(user.permissions).map((badge) => (
                          <span
                            key={badge}
                            className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded"
                          >
                            {badge}
                          </span>
                        ))}
                        {getPermissionsBadges(user.permissions).length === 0 && (
                          <span className="text-gray-500 text-xs">Sem permissões</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-400 hover:text-blue-300"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {user.role !== 'admin' && (
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="text-red-400 hover:text-red-300"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">
                {editingUser ? 'Editar Funcionário' : 'Novo Funcionário'}
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
                  Nome de Usuário
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
                  placeholder="Digite o nome de usuário"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Senha {editingUser && '(deixe em branco para manter a atual)'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newUser.password}
                    onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold pr-10"
                    placeholder="Digite a senha"
                    required={!editingUser}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Função
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
                >
                  <option value="funcionario">Funcionário</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  <Shield className="w-4 h-4 inline mr-1" />
                  Permissões
                </label>
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newUser.permissions.pdv}
                      onChange={() => handlePermissionChange('pdv')}
                      className="mr-3 text-mixjovim-gold focus:ring-mixjovim-gold"
                    />
                    <span className="text-white">Acesso ao PDV</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newUser.permissions.products}
                      onChange={() => handlePermissionChange('products')}
                      className="mr-3 text-mixjovim-gold focus:ring-mixjovim-gold"
                    />
                    <span className="text-white">Gerenciar Produtos</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newUser.permissions.dashboard}
                      onChange={() => handlePermissionChange('dashboard')}
                      className="mr-3 text-mixjovim-gold focus:ring-mixjovim-gold"
                    />
                    <span className="text-white">Acesso ao Dashboard</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newUser.permissions.reports}
                      onChange={() => handlePermissionChange('reports')}
                      className="mr-3 text-mixjovim-gold focus:ring-mixjovim-gold"
                    />
                    <span className="text-white">Visualizar Relatórios</span>
                  </label>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 btn-gold disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : editingUser ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
} 