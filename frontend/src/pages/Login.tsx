import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, ShoppingCart, Star, CheckCircle, Heart } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const { login, getDefaultRoute } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!username || !password) {
      toast.error('Por favor, preencha todos os campos')
      return
    }

    setLoading(true)
    
    try {
      const success = await login(username, password)
      if (success) {
        toast.success('Login realizado com sucesso!')
        const defaultRoute = getDefaultRoute()
        navigate(defaultRoute)
      } else {
        toast.error('Usuário ou senha incorretos')
      }
    } catch (error) {
      toast.error('Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-mixjovim-red-dark via-gray-950 to-black opacity-80" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(249,168,37,0.1),transparent_50%)]" />
      
      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="card-mixjovim">
          {/* Logo and Brand */}
          <div className="text-center mb-8">
            {/* Icons similar to the brand image */}
            <div className="flex justify-center space-x-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center shadow-lg">
                <ShoppingCart className="w-6 h-6 text-gray-900" />
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center shadow-lg">
                <Star className="w-6 h-6 text-gray-900" />
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center shadow-lg">
                <CheckCircle className="w-6 h-6 text-gray-900" />
              </div>
              <div className="w-12 h-12 rounded-full bg-gradient-gold flex items-center justify-center shadow-lg">
                <Heart className="w-6 h-6 text-gray-900" />
              </div>
            </div>
            
            {/* Logo MixJovim */}
            <div className="logo-mixjovim w-20 h-20 mx-auto mb-4">
              <span className="text-2xl font-bold">MJ</span>
            </div>
            
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-mixjovim-gold bg-clip-text text-transparent mb-2">
              MixJovim
            </h1>
            <p className="text-mixjovim-gold font-medium">ATACADO E VAREJO</p>
            <p className="text-gray-400 text-sm mt-2">Sistema de Gestão de Estoque</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Usuário
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field w-full"
                placeholder="Digite seu usuário"
                disabled={loading}
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field w-full pr-12"
                  placeholder="Digite sua senha"
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-mixjovim-gold transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <LogIn className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
      
      {/* Brand footer */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
        <p className="text-gray-500 text-sm">
          © 2024 MixJovim - Sistema de Gestão
        </p>
      </div>
    </div>
  )
} 