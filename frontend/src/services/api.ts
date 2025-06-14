import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:5001/api',
  timeout: 10000,
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

// Interceptor para lidar com erros de autenticação
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
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
  
  importExcel: (formData: FormData) =>
    api.post('/products/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
}

export const salesApi = {
  create: (sale: Sale) =>
    api.post('/sales', sale),
  
  getAll: (page = 1, limit = 20) =>
    api.get(`/sales?page=${page}&limit=${limit}`),
}

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats'),
} 