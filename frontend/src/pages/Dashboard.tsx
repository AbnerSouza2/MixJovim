import { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  Calendar,
  BarChart3,
  Trophy,
  Medal,
  Award
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { dashboardApi, DashboardStats, RankingVendas, userApi } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [ranking, setRanking] = useState<RankingVendas[]>([])
  const [loading, setLoading] = useState(true)
  const [userPhotos, setUserPhotos] = useState<Record<number, string>>({})
  
  const isAdmin = user?.role === 'admin'
  const isManager = user?.role === 'gerente'
  const canViewValues = isAdmin || isManager

  useEffect(() => {
    loadStats()
    
    // Cleanup function para revogar URLs das fotos
    return () => {
      Object.values(userPhotos).forEach(photoUrl => {
        if (photoUrl.startsWith('blob:')) {
          URL.revokeObjectURL(photoUrl)
        }
      })
    }
  }, [])
  
  // Cleanup quando userPhotos muda
  useEffect(() => {
    return () => {
      Object.values(userPhotos).forEach(photoUrl => {
        if (photoUrl.startsWith('blob:')) {
          URL.revokeObjectURL(photoUrl)
        }
      })
    }
  }, [userPhotos])

  const loadUserPhoto = async (userId: number) => {
    if (!userId) return null
    
    try {
      const response = await userApi.getPhoto(userId)
      if (response.data && response.data.size > 0) {
        const photoBlob = new Blob([response.data], { type: 'image/jpeg' })
        const photoUrl = URL.createObjectURL(photoBlob)
        return photoUrl
      }
    } catch (error) {
      // Se não encontrar foto, retorna null
      console.log(`Foto não encontrada para usuário ${userId}`)
    }
    return null
  }

  const loadStats = async () => {
    try {
      const [statsResponse, rankingResponse] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getRanking()
      ])
      setStats(statsResponse.data)
      setRanking(rankingResponse.data)
      
      // Carregar fotos dos usuários no ranking
      const photos: Record<number, string> = {}
      for (const vendedor of rankingResponse.data) {
        if (vendedor.user_id) {
          const photoUrl = await loadUserPhoto(vendedor.user_id)
          if (photoUrl) {
            photos[vendedor.user_id] = photoUrl
          }
        }
      }
      setUserPhotos(photos)
      
    } catch (error) {
      toast.error('Erro ao carregar estatísticas')
      console.error('Erro ao carregar stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  // Função para ocultar valores sensíveis de funcionários
  const formatSensitiveValue = (value: number, type: 'currency' | 'number' = 'currency') => {
    if (!canViewValues) {
      return type === 'currency' ? 'R$ ***' : '***'
    }
    return type === 'currency' ? formatCurrency(value) : value.toString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Vendas do Mês</p>
              <p className="text-2xl font-bold text-white mt-1">
                {formatSensitiveValue(stats?.vendas_mes || 0)}
              </p>
              <p className="text-sm text-green-400 mt-1">
                <TrendingUp className="w-4 h-4 inline mr-1" />
                +12% vs mês anterior
              </p>
            </div>
            <div className="p-3 bg-primary-600/10 rounded-lg">
              <DollarSign className="w-6 h-6 text-primary-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Vendas do Dia</p>
              <p className="text-2xl font-bold text-white mt-1">
                {formatSensitiveValue(stats?.vendas_dia || 0)}
              </p>
              <p className="text-sm text-green-400 mt-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Hoje
              </p>
            </div>
            <div className="p-3 bg-green-600/10 rounded-lg">
              <Calendar className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Total de Produtos</p>
              <p className="text-2xl font-bold text-white mt-1">
                {stats?.total_produtos || 0}
              </p>
              <p className="text-sm text-blue-400 mt-1">
                <Package className="w-4 h-4 inline mr-1" />
                Cadastrados
              </p>
            </div>
            <div className="p-3 bg-blue-600/10 rounded-lg">
              <Package className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts - Apenas para Admin e Gerente */}
      {canViewValues && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Sales Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <BarChart3 className="w-5 h-5 text-primary-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">Vendas por Dia</h3>
              </div>
              <span className="text-xs text-gray-400">(Últimos 7 dias)</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.vendas_por_dia || []} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#1e40af" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="data" 
                  stroke="#9CA3AF"
                  fontSize={11}
                  interval={0}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return date.toLocaleDateString('pt-BR', { 
                      day: '2-digit', 
                      month: '2-digit' 
                    })
                  }}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  fontSize={11}
                  domain={[0, 'dataMax + 1000']}
                  ticks={[0, 500, 1000, 2500, 5000]}
                  tickFormatter={(value) => {
                    if (value >= 1000) {
                      return `R$ ${(value / 1000).toFixed(1)}k`
                    }
                    return `R$ ${value}`
                  }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
                  }}
                  labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                  formatter={(value: number) => [
                    formatCurrency(value), 
                    'Faturamento'
                  ]}
                  labelFormatter={(label) => {
                    const date = new Date(label)
                    return date.toLocaleDateString('pt-BR', { 
                      weekday: 'long',
                      day: '2-digit', 
                      month: 'long' 
                    })
                  }}
                />
                <Bar 
                  dataKey="total" 
                  fill="url(#salesGradient)"
                  radius={[6, 6, 0, 0]}
                  stroke="#3b82f6"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Chart */}
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <BarChart3 className="w-5 h-5 text-green-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">Vendas por Categoria</h3>
              </div>
              <span className="text-xs text-gray-400">(Últimos 30 dias)</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.vendas_por_categoria || []} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
                <defs>
                  <linearGradient id="categoryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#047857" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                <XAxis 
                  dataKey="categoria" 
                  stroke="#9CA3AF"
                  fontSize={11}
                  interval={0}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  fontSize={11}
                  domain={[0, 'dataMax + 1000']}
                  ticks={[0, 500, 1000, 2500, 5000]}
                  tickFormatter={(value) => {
                    if (value >= 1000) {
                      return `R$ ${(value / 1000).toFixed(1)}k`
                    }
                    return `R$ ${value}`
                  }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#111827',
                    border: '1px solid #374151',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)'
                  }}
                  labelStyle={{ color: '#f3f4f6', fontWeight: 'bold' }}
                  formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                />
                <Bar 
                  dataKey="total" 
                  fill="url(#categoryGradient)"
                  radius={[6, 6, 0, 0]}
                  stroke="#10b981"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Ranking de Vendas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <div className="card">
                      <div className="flex flex-col sm:flex-row sm:items-center mb-4 sm:mb-6">
              <div className="flex items-center">
                <Trophy className="w-5 h-5 text-yellow-400 mr-2" />
                <h3 className="text-lg font-semibold text-white">Ranking de vendas</h3>
              </div>
              <span className="text-xs text-gray-400 sm:ml-2 mt-1 sm:mt-0">(Mês atual - A competição recomeça todo dia 1º)</span>
            </div>
                      <div className="space-y-2 sm:space-y-3">
            {ranking.length > 0 ? (
              ranking.map((vendedor, index) => {
                const isFirst = index === 0
                const maxItens = ranking[0]?.total_itens || 1
                const percentage = (vendedor.total_itens / maxItens) * 100
                
                return (
                  <div key={vendedor.user_id || vendedor.vendedor} className="space-y-1 sm:space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {index === 0 && <Trophy className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                        {index === 1 && <Medal className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                        {index === 2 && <Award className="w-4 h-4 text-amber-600 flex-shrink-0" />}
                        {index > 2 && <span className="w-4 h-4 flex items-center justify-center text-xs text-gray-500 font-bold flex-shrink-0">#{index + 1}</span>}
                        <span className="text-white font-medium truncate">{vendedor.vendedor}</span>
                      </div>
                      <span className="text-xs sm:text-sm text-gray-400 flex-shrink-0">{vendedor.total_itens} itens</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-4">
                      <div 
                        className={`h-4 rounded-full transition-all duration-500 ${
                          isFirst ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 'bg-blue-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-6 sm:py-8">
                <Trophy className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-600 mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-gray-400">Nenhuma venda registrada</p>
              </div>
            )}
          </div>
        </div>

        {/* Pódio */}
        <div className="card">
          <div className="flex items-center mb-6">
            <Medal className="w-5 h-5 text-yellow-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">Pódio por Itens Vendidos</h3>
          </div>
          <div className="flex items-end justify-center space-x-2 sm:space-x-4 lg:space-x-6 h-64 sm:h-72 lg:h-80">
            {/* 2º Lugar */}
            {ranking[1] && (
              <div className="flex flex-col items-center">
                <div className="mb-2 sm:mb-3">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full bg-gray-400 flex items-center justify-center overflow-hidden border-2 border-gray-300">
                    {ranking[1].user_id && userPhotos[ranking[1].user_id] ? (
                      <img 
                        src={userPhotos[ranking[1].user_id]} 
                        alt={ranking[1].vendedor}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-sm sm:text-base lg:text-lg font-bold text-gray-900">
                        {ranking[1].vendedor.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-gray-400 text-gray-900 px-2 py-1 sm:px-3 sm:py-2 lg:px-4 lg:py-2 rounded-t-lg text-xs sm:text-sm font-bold mb-1">
                  2º
                </div>
                <div className="bg-gray-400 w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 flex items-end justify-center rounded-t-lg">
                  <div className="text-xs sm:text-sm text-center text-gray-900 font-medium pb-2 sm:pb-3">
                    <div className="font-semibold truncate max-w-14 sm:max-w-16">{ranking[1].vendedor}</div>
                    <div className="text-xs">{ranking[1].total_itens}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 1º Lugar */}
            {ranking[0] && (
              <div className="flex flex-col items-center">
                <div className="mb-2 sm:mb-3 lg:mb-4">
                  <div className="w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 rounded-full bg-gradient-to-r from-yellow-400 to-yellow-600 flex items-center justify-center overflow-hidden border-2 sm:border-3 lg:border-4 border-yellow-300">
                    {ranking[0].user_id && userPhotos[ranking[0].user_id] ? (
                      <img 
                        src={userPhotos[ranking[0].user_id]} 
                        alt={ranking[0].vendedor}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                        {ranking[0].vendedor.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <Trophy className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-yellow-400 mx-auto mt-1 sm:mt-2" />
                </div>
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-gray-900 px-3 py-1 sm:px-4 sm:py-2 lg:px-5 lg:py-2 rounded-t-lg text-sm sm:text-base font-bold mb-1">
                  1º
                </div>
                <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 w-20 h-20 sm:w-22 sm:h-24 lg:w-24 lg:h-28 flex items-end justify-center rounded-t-lg">
                  <div className="text-sm sm:text-base text-center text-gray-900 font-medium pb-2 sm:pb-3">
                    <div className="font-bold truncate max-w-16 sm:max-w-20">{ranking[0].vendedor}</div>
                    <div className="text-xs sm:text-sm">{ranking[0].total_itens}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 3º Lugar */}
            {ranking[2] && (
              <div className="flex flex-col items-center">
                <div className="mb-2 sm:mb-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-full bg-amber-600 flex items-center justify-center overflow-hidden border-2 border-amber-500">
                    {ranking[2].user_id && userPhotos[ranking[2].user_id] ? (
                      <img 
                        src={userPhotos[ranking[2].user_id]} 
                        alt={ranking[2].vendedor}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <span className="text-xs sm:text-sm lg:text-base font-bold text-gray-900">
                        {ranking[2].vendedor.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-amber-600 text-gray-900 px-2 py-1 sm:px-3 sm:py-2 rounded-t-lg text-xs sm:text-sm font-bold mb-1">
                  3º
                </div>
                <div className="bg-amber-600 w-14 h-12 sm:w-16 sm:h-14 lg:w-18 lg:h-16 flex items-end justify-center rounded-t-lg">
                  <div className="text-xs sm:text-sm text-center text-gray-900 font-medium pb-1 sm:pb-2">
                    <div className="font-semibold truncate max-w-12 sm:max-w-14">{ranking[2].vendedor}</div>
                    <div className="text-xs">{ranking[2].total_itens}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Caso não tenha vendedores suficientes */}
            {ranking.length === 0 && (
              <div className="text-center py-8 sm:py-10 lg:py-12">
                <Medal className="w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 mx-auto text-gray-600 mb-4 sm:mb-6" />
                <p className="text-base sm:text-lg text-gray-400 mb-2">Nenhuma venda registrada</p>
                <p className="text-sm text-gray-500 px-4">O pódio aparecerá conforme as vendas forem realizadas</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 