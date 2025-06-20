import React, { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../services/api'

interface User {
  id: number
  username: string
  role: 'admin' | 'gerente' | 'funcionario'
  permissions?: {
    pdv: boolean
    products: boolean
    dashboard: boolean
    reports: boolean
    estoque: boolean
    funcionarios: boolean
    financeiro: boolean
  }
}

interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  loading: boolean
  getDefaultRoute: () => string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Função para determinar a rota padrão baseada nas permissões
  const getDefaultRoute = (): string => {
    if (!user) return '/login'
    
    // Se é admin, sempre vai para dashboard
    if (user.role === 'admin') {
      return '/dashboard'
    }
    
    // Se é gerente, vai para dashboard se tiver permissão, senão para a primeira permissão disponível
    if (user.role === 'gerente') {
      if (user.permissions?.dashboard) return '/dashboard'
    }
    
    // Para funcionários e gerentes, verificar permissões em ordem de prioridade
    const permissions = user.permissions
    if (!permissions) return '/login'
    
    // Prioridade: Dashboard -> PDV -> Products -> Financeiro -> Estoque -> Reports
    if (permissions.dashboard) return '/dashboard'
    if (permissions.pdv) return '/pdv'
    if (permissions.products) return '/adicionar-produto'
    if (permissions.financeiro) return '/financeiro'
    if (permissions.estoque) return '/estoque'
    if (permissions.reports) return '/financeiro'
    
    // Se não tem nenhuma permissão, voltar para login
    return '/login'
  }

  useEffect(() => {
    // Verificar se há um token armazenado
    const token = localStorage.getItem('token')
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      // Verificar se o token é válido
      api.get('/auth/verify')
        .then(response => {
          console.log('Usuário verificado:', response.data.user)
          setUser(response.data.user)
          setIsAuthenticated(true)
        })
        .catch(() => {
          localStorage.removeItem('token')
          delete api.defaults.headers.common['Authorization']
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await api.post('/auth/login', { username, password })
      const { token, user } = response.data
      
      console.log('Login bem-sucedido:', user)
      
      localStorage.setItem('token', token)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      
      setUser(user)
      setIsAuthenticated(true)
      return true
    } catch (error: any) {
      console.error('Erro no login:', error)
      return false
    }
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      login,
      logout,
      loading,
      getDefaultRoute
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return context
} 