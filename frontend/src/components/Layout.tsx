import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  LogOut, 
  Menu,
  X,
  Users,
  DollarSign
} from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Verificar se o usuário tem permissão para acessar uma funcionalidade
  const hasPermission = (permission: string) => {
    if (!user || !user.permissions) return false
    if (user.role === 'admin') return true // Admin tem acesso total
    return user.permissions[permission as keyof typeof user.permissions]
  }

  // Filtrar itens do menu baseado nas permissões
  const getAllMenuItems = () => {
    const allItems = [
      { 
        name: 'Dashboard', 
        icon: LayoutDashboard, 
        path: '/dashboard',
        permission: 'dashboard'
      },
      { 
        name: 'Adicionar Produto', 
        icon: Package, 
        path: '/adicionar-produto',
        permission: 'products'
      },
      { 
        name: 'PDV', 
        icon: ShoppingCart, 
        path: '/pdv',
        permission: 'pdv'
      },
      { 
        name: 'Financeiro', 
        icon: DollarSign, 
        path: '/financeiro',
        permission: 'reports'
      },
      { 
        name: 'Funcionários', 
        icon: Users, 
        path: '/funcionarios',
        permission: 'admin_only' // Apenas admin pode gerenciar funcionários
      },
    ]

    return allItems.filter(item => {
      if (item.permission === 'admin_only') {
        return user?.role === 'admin'
      }
      return hasPermission(item.permission)
    })
  }

  const menuItems = getAllMenuItems()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950">
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
      `}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          <h1 className="text-xl font-bold text-white">MixJovim</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path
            
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setSidebarOpen(false)
                }}
                className={`sidebar-item w-full ${isActive ? 'active' : ''}`}
              >
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold">
                {user?.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{user?.username}</p>
              <p className="text-xs text-gray-400">
                {user?.role === 'admin' ? 'Administrador' : 'Funcionário'}
              </p>
            </div>
          </div>
          
          {/* Mostrar permissões do usuário */}
          {user?.role !== 'admin' && user?.permissions && (
            <div className="mb-4 p-2 bg-gray-800 rounded text-xs">
              <p className="text-gray-300 mb-1">Permissões:</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(user.permissions).map(([key, value]) => (
                  value && (
                    <span key={key} className="px-1 py-0.5 bg-mixjovim-gold text-gray-900 rounded text-xs">
                      {key.toUpperCase()}
                    </span>
                  )
                ))}
              </div>
            </div>
          )}
          
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4 mr-3" />
            Sair
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Top bar */}
        <header className="bg-gray-900 border-b border-gray-800 h-16 flex items-center px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white mr-4"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-semibold text-white">
            {menuItems.find(item => item.path === location.pathname)?.name || 'Sistema de Gestão'}
          </h2>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
} 