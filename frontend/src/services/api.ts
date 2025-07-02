import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000, // Aumentado para 30 segundos
  headers: {
    'Content-Type': 'application/json',
  }
})

// Interceptor para adicionar token automaticamente
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Interceptor para lidar com erros de autenticação - SIMPLIFICADO
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Erro de autenticação
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(error)
    }
    
    // Log de erro para debug sem retry automático
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'NETWORK_ERROR' || 
        error.response?.status === 503 ||
        !error.response) {
      console.warn('🔴 Problema de conectividade:', error.message)
    }
    
    return Promise.reject(error)
  }
)

// Exportar api como default e também como named export
export { api }
export default api

// Tipos e interfaces
export interface Product {
  id?: number
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_venda: number
  categoria: string
  codigo_barras_1?: string
  codigo_barras_2?: string
  created_at?: string
  updated_at?: string
  total_conferido?: number
  total_perdas?: number
  conferentes?: string
  ultima_conferencia?: string
  ultima_perda?: string
}

export interface Sale {
  id?: number
  produtos: Array<{
    produto_id: number
    quantidade: number
    valor_unitario: number
    subtotal: number
  }>
  total: number
  created_at?: string
}

export interface DashboardStats {
  vendas_mes: number
  vendas_dia: number
  total_produtos: number
  vendas_por_dia: Array<{ data: string; total: number }>
  vendas_por_categoria: Array<{ categoria: string; total: number }>
  status_estoque: {
    baixo: number
    normal: number
    alto: number
  }
}

// Funções da API
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  
  verify: () => api.get('/auth/verify'),
}

export const productsApi = {
  getAll: (page = 1, limit = 20, search = '') =>
    api.get(`/products?page=${page}&limit=${limit}&search=${search}`),
  
  create: (product: Product) =>
    api.post('/products', product),
  
  update: (id: number, product: Product) =>
    api.put(`/products/${id}`, product),
  
  delete: (id: number) =>
    api.delete(`/products/${id}`),
  
  search: (query: string) =>
    api.get(`/products/search?q=${query}`),
  
  importExcel: (formData: FormData, timeoutMs = 60000) =>
    api.post('/products/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: timeoutMs
    }),
}

export const salesApi = {
  create: (sale: Sale) =>
    api.post('/sales', sale),
  
  getAll: (page = 1, limit = 20) =>
    api.get(`/sales?page=${page}&limit=${limit}`),
}

export interface RankingVendas {
  vendedor: string
  total_itens: number
  total_vendas: number
  valor_total: number
  user_id: number | null
}

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),
  getRanking: () => api.get<RankingVendas[]>('/dashboard/ranking'),
}

export const userApi = {
  // Funções de fotos de usuário
  uploadPhoto: (formData: FormData) =>
    api.post('/auth/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  getPhoto: async (userId: number) => {
    try {
      const response = await api.get(`/auth/photo/${userId}`, { responseType: 'blob' })
      
      // Verificar se é realmente uma imagem
      if (response.data && response.data.type && response.data.type.startsWith('image/')) {
        return URL.createObjectURL(response.data)
      }
      
      // Se não é uma imagem válida, retornar null
      return null
    } catch (error: any) {
      // Se der erro 404 ou qualquer outro, retornar null
      console.log(`Foto não encontrada para usuário ${userId}`)
      return null
    }
  },
  
  deletePhoto: () =>
    api.delete('/auth/photo'),
}

export const clientesApi = {
  getAll: (page = 1, limit = 20, search = '') =>
    api.get(`/clientes?page=${page}&limit=${limit}&search=${search}`),
  
  getById: (id: number) =>
    api.get(`/clientes/${id}`),
  
  getAtivos: () =>
    api.get('/clientes/ativos/lista'),
  
  create: (cliente: any) =>
    api.post('/clientes', cliente),
  
  update: (id: number, cliente: any) =>
    api.put(`/clientes/${id}`, cliente),
  
  delete: (id: number) =>
    api.delete(`/clientes/${id}`),
} 