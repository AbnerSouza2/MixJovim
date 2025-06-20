import React from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ShieldX, LogOut } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: string
  adminOnly?: boolean
}

export default function ProtectedRoute({ 
  children, 
  requiredPermission, 
  adminOnly = false 
}: ProtectedRouteProps) {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const handleBackToLogin = () => {
    logout()
    navigate('/login')
  }

  // Se é apenas para admin
  if (adminOnly && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gray-900 rounded-lg p-8 text-center">
          <ShieldX className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Acesso Negado</h2>
          <p className="text-gray-400 mb-6">
            Você não tem permissão para acessar esta página. 
            Esta funcionalidade é restrita a administradores.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => window.history.back()}
              className="btn-secondary"
            >
              Voltar
            </button>
            <button
              onClick={handleBackToLogin}
              className="btn-primary flex items-center"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Fazer Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Se requer permissão específica
  if (requiredPermission) {
    let hasPermission = false
    
    // Admin sempre tem acesso
    if (user?.role === 'admin') {
      hasPermission = true
    }
    // Gerente tem acesso automático a funcionários e financeiro
    else if (user?.role === 'gerente' && (requiredPermission === 'funcionarios' || requiredPermission === 'financeiro')) {
      hasPermission = true
    }
    // Para outras permissões, verificar se o usuário tem a permissão específica
    else if (user?.permissions && user.permissions[requiredPermission as keyof typeof user.permissions]) {
      hasPermission = true
    }

    if (!hasPermission) {
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-gray-900 rounded-lg p-8 text-center">
            <ShieldX className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Acesso Negado</h2>
            <p className="text-gray-400 mb-6">
              Você não tem permissão para acessar esta funcionalidade. 
              Entre em contato com um administrador para solicitar acesso.
            </p>
            <div className="mb-6 p-3 bg-gray-800 rounded">
              <p className="text-sm text-gray-300 mb-2">Suas permissões atuais:</p>
              <div className="flex flex-wrap gap-1 justify-center">
                {user?.permissions && Object.entries(user.permissions).map(([key, value]) => (
                  <span 
                    key={key} 
                    className={`px-2 py-1 text-xs rounded ${
                      value ? 'bg-mixjovim-gold text-gray-900' : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {key.toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.history.back()}
                className="btn-secondary"
              >
                Voltar
              </button>
              <button
                onClick={handleBackToLogin}
                className="btn-primary flex items-center"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Fazer Login
              </button>
            </div>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
} 