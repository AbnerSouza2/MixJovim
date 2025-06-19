import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LogIn, Star } from 'lucide-react'
import toast from 'react-hot-toast'

// Componente para partículas animadas
const FloatingParticle = ({ delay, color }: { delay: number; color: string }) => {
  return (
    <div
      className={`absolute animate-float-soft opacity-60`}
      style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${4 + Math.random() * 4}s`
      }}
    >
      <Star className={`w-2 h-2 ${color}`} />
    </div>
  )
}

// Componente para estrelas animadas maiores
const FloatingStar = ({ delay, size, color }: { delay: number; size: number; color: string }) => {
  return (
    <div
      className={`absolute animate-drift opacity-40`}
      style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${delay}s`,
        animationDuration: `${6 + Math.random() * 4}s`
      }}
    >
      <div className={`${size === 1 ? 'w-1 h-1' : size === 2 ? 'w-2 h-2' : 'w-3 h-3'} ${color} rounded-full animate-shimmer`} />
    </div>
  )
}

// Componente para feixes de luz dourados
const LightBeam = ({ delay, direction }: { delay: number; direction: 'left' | 'right' }) => {
  return (
    <div
      className={`absolute top-1/2 ${direction === 'left' ? 'left-1/2' : 'right-1/2'} transform -translate-y-1/2 ${direction === 'left' ? '-translate-x-1/2' : 'translate-x-1/2'}`}
      style={{ animationDelay: `${delay}s` }}
    >
      <div 
        className={`bg-gradient-to-${direction === 'left' ? 'l' : 'r'} from-transparent via-mixjovim-gold to-transparent h-1 opacity-0 animate-light-beam`}
        style={{ 
          width: '200px',
          transformOrigin: direction === 'left' ? 'right center' : 'left center'
        }}
      />
    </div>
  )
}

// Componente de Loading Screen
const LoadingScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [loadingStage, setLoadingStage] = useState(0)
  // 0: início, 1: logo crescendo, 2: efeitos de luz, 3: feixes dourados, 4: completo

  useEffect(() => {
    const timers = [
      setTimeout(() => setLoadingStage(1), 500),      // Inicia crescimento da logo
      setTimeout(() => setLoadingStage(2), 2000),     // Adiciona efeitos de luz
      setTimeout(() => setLoadingStage(3), 3500),     // Feixes dourados
      setTimeout(() => setLoadingStage(4), 4500),     // Preparar para sair
      setTimeout(() => onComplete(), 5000),           // Chamar onComplete
    ]

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-black overflow-hidden">
      {/* Background com efeitos de luz */}
      <div className="absolute inset-0 bg-gradient-to-tr from-mixjovim-red/5 via-transparent to-mixjovim-gold/5" />
      
      {/* Partículas de fundo durante loading */}
      {loadingStage >= 2 && (
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => (
            <FloatingParticle key={`loading-particle-${i}`} delay={i * 0.2} color="text-mixjovim-gold" />
          ))}
        </div>
      )}

      {/* Logo container */}
      <div className="relative">
        {/* Feixes de luz dourados */}
        {loadingStage >= 3 && (
          <>
            <LightBeam delay={0} direction="left" />
            <LightBeam delay={0.3} direction="right" />
            <LightBeam delay={0.6} direction="left" />
            <LightBeam delay={0.9} direction="right" />
          </>
        )}

        {/* Logo principal */}
        <div className={`relative transition-all duration-1000 ease-out ${
          loadingStage === 0 ? 'w-8 h-8' : 
          loadingStage === 1 ? 'w-32 h-32' : 
          loadingStage >= 2 ? 'w-40 h-40' : 'w-8 h-8'
        } rounded-full bg-gradient-to-br from-mixjovim-gold/20 to-mixjovim-red/20 p-1 shadow-2xl`}>
          
          <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
            <img 
              src="/MixJovim.jpg" 
              alt="MixJovim Logo" 
              className={`object-cover rounded-full shadow-inner transition-all duration-1000 ease-out ${
                loadingStage === 0 ? 'w-6 h-6' : 
                loadingStage === 1 ? 'w-28 h-28' : 
                loadingStage >= 2 ? 'w-36 h-36' : 'w-6 h-6'
              }`}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.classList.remove('hidden')
              }}
            />
            {/* Fallback */}
            <div className={`hidden bg-gradient-mixjovim rounded-full flex items-center justify-center transition-all duration-1000 ease-out ${
              loadingStage === 0 ? 'w-6 h-6' : 
              loadingStage === 1 ? 'w-28 h-28' : 
              loadingStage >= 2 ? 'w-36 h-36' : 'w-6 h-6'
            }`}>
              <span className={`text-white font-bold transition-all duration-1000 ease-out ${
                loadingStage === 0 ? 'text-xs' : 
                loadingStage === 1 ? 'text-2xl' : 
                loadingStage >= 2 ? 'text-4xl' : 'text-xs'
              }`}>MJ</span>
            </div>
          </div>
          
          {/* Brilho ao redor da logo */}
          {loadingStage >= 1 && (
            <div className={`absolute -inset-1 bg-gradient-to-r from-mixjovim-gold/30 via-mixjovim-red/30 to-mixjovim-gold/30 rounded-full blur-sm transition-opacity duration-1000 ${
              loadingStage >= 3 ? 'opacity-60 animate-pulse' : 'opacity-20'
            }`} />
          )}
          
          {/* Anel de luz pulsante */}
          {loadingStage >= 2 && (
            <div className="absolute -inset-3 rounded-full border-2 border-mixjovim-gold/50 animate-ping" />
          )}
        </div>

        {/* Texto de loading */}
        {loadingStage >= 1 && loadingStage < 4 && (
          <div className={`absolute -bottom-16 left-1/2 transform -translate-x-1/2 transition-all duration-1000 ${
            loadingStage >= 2 ? 'opacity-100' : 'opacity-0'
          }`}>
            <div className="text-center">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-mixjovim-gold via-white to-mixjovim-gold bg-clip-text text-transparent mb-2">
                MixJovim
              </h2>
              <p className="text-mixjovim-gold text-sm">Carregando sistema...</p>
              
              {/* Barra de progresso animada */}
              <div className="w-32 h-1 bg-gray-700 rounded-full mt-3 mx-auto overflow-hidden">
                <div className="h-full bg-gradient-to-r from-mixjovim-gold to-mixjovim-red rounded-full animate-loading-bar" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Efeitos de luz ambiente */}
      {loadingStage >= 2 && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(249,168,37,0.1),transparent_50%)] animate-pulse" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(198,40,40,0.1),transparent_50%)] animate-pulse" style={{ animationDelay: '1s' }} />
        </>
      )}
    </div>
  )
}

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showLoading, setShowLoading] = useState(true)
  
  const { login, getDefaultRoute } = useAuth()
  const navigate = useNavigate()

  const handleLoadingComplete = () => {
    setShowLoading(false)
  }

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

  // Mostrar tela de loading
  if (showLoading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background gradiente animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-black" />
      <div className="absolute inset-0 bg-gradient-to-tr from-mixjovim-red/10 via-transparent to-mixjovim-gold/10" />
      
      {/* Partículas e estrelas animadas de fundo */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Estrelas douradas pequenas */}
        {Array.from({ length: 20 }).map((_, i) => (
          <FloatingParticle 
            key={`gold-particle-${i}`}
            delay={i * 0.3} 
            color="text-mixjovim-gold" 
          />
        ))}
        
        {/* Estrelas vermelhas pequenas */}
        {Array.from({ length: 15 }).map((_, i) => (
          <FloatingParticle 
            key={`red-particle-${i}`}
            delay={i * 0.4} 
            color="text-mixjovim-red" 
          />
        ))}
        
        {/* Pontos dourados flutuantes */}
        {Array.from({ length: 25 }).map((_, i) => (
          <FloatingStar 
            key={`gold-star-${i}`}
            delay={i * 0.2} 
            size={Math.floor(Math.random() * 3) + 1}
            color="bg-mixjovim-gold" 
          />
        ))}
        
        {/* Pontos vermelhos flutuantes */}
        {Array.from({ length: 20 }).map((_, i) => (
          <FloatingStar 
            key={`red-star-${i}`}
            delay={i * 0.25} 
            size={Math.floor(Math.random() * 3) + 1}
            color="bg-mixjovim-red" 
          />
        ))}
      </div>

      {/* Efeito de brilho sutil */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(249,168,37,0.15),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(198,40,40,0.15),transparent_50%)]" />
      
      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in-up">
        <div className="bg-gradient-to-br from-gray-900/95 to-gray-800/95 backdrop-blur-lg border border-mixjovim-gold/20 rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:border-mixjovim-gold/40">
          {/* Logo da Loja */}
          <div className="text-center mb-8">
            <div className="relative mb-6">
              {/* Container da logo com efeito de brilho */}
              <div className="relative mx-auto w-40 h-40 rounded-full bg-gradient-to-br from-mixjovim-gold/15 to-mixjovim-red/15 p-1 shadow-2xl logo-hover-effect">
                <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center overflow-hidden">
                  <img 
                    src="/MixJovim.jpg" 
                    alt="MixJovim Logo" 
                    className="w-36 h-36 object-cover rounded-full shadow-inner transition-transform duration-300"
                    onError={(e) => {
                      // Fallback caso a imagem não carregue
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                  {/* Fallback para quando a imagem não carregar */}
                  <div className="hidden w-36 h-36 bg-gradient-mixjovim rounded-full flex items-center justify-center">
                    <span className="text-white text-4xl font-bold">MJ</span>
                  </div>
                </div>
                
                {/* Efeito de brilho ao redor da logo - mais sutil */}
                <div className="absolute -inset-1 bg-gradient-to-r from-mixjovim-gold/20 via-mixjovim-red/20 to-mixjovim-gold/20 rounded-full opacity-20 blur-sm animate-shimmer" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold bg-gradient-to-r from-mixjovim-gold via-white to-mixjovim-gold bg-clip-text text-transparent mb-2">
              MixJovim
            </h1>
            <p className="text-mixjovim-gold font-medium tracking-wider">ATACADO E VAREJO</p>
            <p className="text-gray-400 text-sm mt-2">Sistema de Gestão Completa</p>
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
                className="w-full bg-gray-800/50 border border-gray-600 text-white px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-mixjovim-gold focus:border-mixjovim-gold focus:bg-gray-800/70 transition-all duration-300 backdrop-blur-sm hover:border-gray-500"
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
                  className="w-full bg-gray-800/50 border border-gray-600 text-white px-4 py-3 pr-12 rounded-lg focus:outline-none focus:ring-2 focus:ring-mixjovim-gold focus:border-mixjovim-gold focus:bg-gray-800/70 transition-all duration-300 backdrop-blur-sm hover:border-gray-500"
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
              className="w-full bg-gradient-to-r from-mixjovim-red to-mixjovim-red-dark hover:from-mixjovim-red-dark hover:to-mixjovim-red text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 shadow-lg hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <LogIn className="w-5 h-5 mr-2" />
              )}
              {loading ? 'Entrando...' : 'Entrar no Sistema'}
            </button>
          </form>

          {/* Indicador de segurança */}
          <div className="mt-6 text-center">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span>Conexão Segura</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Brand footer com efeito glassmorphism */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
        <div className="bg-gray-900/30 backdrop-blur-sm border border-gray-700/50 rounded-full px-6 py-2">
          <p className="text-gray-400 text-sm">
            © 2024 <span className="text-mixjovim-gold font-medium">MixJovim</span> - Sistema de Gestão
          </p>
        </div>
      </div>
    </div>
  )
} 