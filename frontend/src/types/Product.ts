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