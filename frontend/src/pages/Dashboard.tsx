import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  Calendar,
  BarChart3,
  PieChart
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { dashboardApi, DashboardStats } from '../services/api'
import toast from 'react-hot-toast'

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const response = await dashboardApi.getStats()
      setStats(response.data)
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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-gray-400">Visão geral do seu negócio</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-400">Vendas do Mês</p>
              <p className="text-2xl font-bold text-white mt-1">
                {formatCurrency(stats?.vendas_mes || 0)}
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
                {formatCurrency(stats?.vendas_dia || 0)}
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="card">
          <div className="flex items-center mb-6">
            <BarChart3 className="w-5 h-5 text-primary-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">Vendas por Dia</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats?.vendas_por_dia || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="data" 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={formatCurrency}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [formatCurrency(value), 'Vendas']}
              />
              <Line 
                type="monotone" 
                dataKey="total" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Category Chart */}
        <div className="card">
          <div className="flex items-center mb-6">
            <BarChart3 className="w-5 h-5 text-green-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">Vendas por Categoria</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.vendas_por_categoria || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="categoria" 
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis 
                stroke="#9CA3AF"
                fontSize={12}
                tickFormatter={formatCurrency}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [formatCurrency(value), 'Vendas']}
              />
              <Bar 
                dataKey="total" 
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Stock Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center mb-6">
            <PieChart className="w-5 h-5 text-yellow-400 mr-2" />
            <h3 className="text-lg font-semibold text-white">Status do Estoque</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPie
              data={[
                { name: 'Estoque Baixo', value: stats?.status_estoque.baixo || 0 },
                { name: 'Estoque Normal', value: stats?.status_estoque.normal || 0 },
                { name: 'Estoque Alto', value: stats?.status_estoque.alto || 0 }
              ]}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {[].map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Legend />
            </RechartsPie>
          </ResponsiveContainer>
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h3 className="text-lg font-semibold text-white mb-6">Ações Rápidas</h3>
          <div className="space-y-4">
            <button className="btn-primary w-full justify-start">
              <Package className="w-5 h-5 mr-2" />
              Adicionar Produto
            </button>
            <button className="btn-secondary w-full justify-start">
              <DollarSign className="w-5 h-5 mr-2" />
              Nova Venda
            </button>
            <button className="btn-secondary w-full justify-start">
              <BarChart3 className="w-5 h-5 mr-2" />
              Relatórios
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 