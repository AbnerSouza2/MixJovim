import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Upload, 
  Search, 
  Edit, 
  Trash2, 
  Download,
  FileSpreadsheet,
  Eye,
  AlertCircle
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { productsApi, Product } from '../services/api'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

interface ProductForm {
  descricao: string
  quantidade: number
  valor_unitario: number
  valor_venda: number
  categoria: string
  codigo_barras_1?: string
  codigo_barras_2?: string
}

export default function AddProduct() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [existingProduct, setExistingProduct] = useState<Product | null>(null)
  const [isStockUpdate, setIsStockUpdate] = useState(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductForm>()

  const valorUnitario = watch('valor_unitario')
  const quantidade = watch('quantidade')
  const codigoBarras1 = watch('codigo_barras_1')
  const codigoBarras2 = watch('codigo_barras_2')

  useEffect(() => {
    loadProducts()
  }, [currentPage, search])

  // Verificar código de barras quando digitado
  useEffect(() => {
    const checkBarcodeExists = async () => {
      if ((codigoBarras1 && codigoBarras1.length >= 8) || (codigoBarras2 && codigoBarras2.length >= 8)) {
        try {
          const query = codigoBarras1 || codigoBarras2
          const response = await productsApi.search(query)
          const foundProduct = response.data.find((p: Product) => 
            p.codigo_barras_1 === query || p.codigo_barras_2 === query
          )
          
          if (foundProduct && !editingProduct) {
            setExistingProduct(foundProduct)
            setIsStockUpdate(true)
            // Preencher campos com dados do produto existente
            setValue('descricao', foundProduct.descricao)
            setValue('valor_unitario', foundProduct.valor_unitario)
            setValue('valor_venda', foundProduct.valor_venda)
            setValue('categoria', foundProduct.categoria)
            setValue('codigo_barras_1', foundProduct.codigo_barras_1 || '')
            setValue('codigo_barras_2', foundProduct.codigo_barras_2 || '')
            // Não preencher quantidade para que o usuário digite a quantidade a adicionar
            toast.success(`Produto encontrado! Adicione a quantidade de entrada no estoque.`)
          } else if (!foundProduct && !editingProduct) {
            setExistingProduct(null)
            setIsStockUpdate(false)
          }
        } catch (error) {
          // Ignorar erros de busca
        }
      } else {
        setExistingProduct(null)
        setIsStockUpdate(false)
      }
    }

    const debounceTimer = setTimeout(checkBarcodeExists, 500)
    return () => clearTimeout(debounceTimer)
  }, [codigoBarras1, codigoBarras2, editingProduct, setValue])

  const loadProducts = async () => {
    setLoading(true)
    try {
      const response = await productsApi.getAll(currentPage, 20, search)
      setProducts(response.data.products)
      setTotalPages(response.data.pagination.totalPages)
    } catch (error) {
      toast.error('Erro ao carregar produtos')
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = async (data: ProductForm) => {
    try {
      if (isStockUpdate && existingProduct) {
        // Atualizar estoque do produto existente - garantir conversão para números
        const quantidadeAtual = Number(existingProduct.quantidade) || 0
        const quantidadeAdicionar = Number(data.quantidade) || 0
        const novaQuantidade = quantidadeAtual + quantidadeAdicionar
        
        const productData = {
          ...data,
          quantidade: novaQuantidade,
          valor_unitario: Number(data.valor_unitario),
          valor_venda: Number(data.valor_venda)
        }
        
        await productsApi.update(existingProduct.id!, productData)
        toast.success(`Estoque atualizado! +${quantidadeAdicionar} unidades adicionadas. Total: ${novaQuantidade}`)
      } else if (editingProduct) {
        // Editar produto existente
        const productData = {
          ...data,
          quantidade: Number(data.quantidade),
          valor_unitario: Number(data.valor_unitario),
          valor_venda: Number(data.valor_venda)
        }
        await productsApi.update(editingProduct.id!, productData)
        toast.success('Produto atualizado com sucesso!')
      } else {
        // Criar novo produto
        const productData = {
          ...data,
          quantidade: Number(data.quantidade),
          valor_unitario: Number(data.valor_unitario),
          valor_venda: Number(data.valor_venda)
        }
        await productsApi.create(productData)
        toast.success('Produto adicionado com sucesso!')
      }

      reset()
      setShowAddForm(false)
      setEditingProduct(null)
      setExistingProduct(null)
      setIsStockUpdate(false)
      loadProducts()
    } catch (error) {
      toast.error('Erro ao salvar produto')
    }
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setExistingProduct(null)
    setIsStockUpdate(false)
    setShowAddForm(true)
    setValue('descricao', product.descricao)
    setValue('quantidade', product.quantidade)
    setValue('valor_unitario', product.valor_unitario)
    setValue('valor_venda', product.valor_venda)
    setValue('categoria', product.categoria)
    setValue('codigo_barras_1', product.codigo_barras_1 || '')
    setValue('codigo_barras_2', product.codigo_barras_2 || '')
  }

  const handleDelete = async (id: number) => {
    if (confirm('Tem certeza que deseja excluir este produto?')) {
      try {
        await productsApi.delete(id)
        toast.success('Produto excluído com sucesso!')
        loadProducts()
      } catch (error) {
        toast.error('Erro ao excluir produto')
      }
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      // Validar e transformar dados
      const products = jsonData.map((row: any) => ({
        descricao: row['Descrição'] || row['descricao'] || '',
        quantidade: Number(row['Quantidade'] || row['quantidade'] || 0),
        valor_unitario: Number(row['Valor Unitário'] || row['valor_unitario'] || 0),
        valor_venda: Number(row['Valor Venda'] || row['valor_venda'] || 0),
        categoria: row['Categoria'] || row['categoria'] || 'Geral',
        codigo_barras_1: row['Código Barras 1'] || row['codigo_barras_1'] || '',
        codigo_barras_2: row['Código Barras 2'] || row['codigo_barras_2'] || ''
      }))

      // Criar FormData para upload
      const formData = new FormData()
      formData.append('file', file)

      await productsApi.importExcel(formData)
      toast.success(`${products.length} produtos importados com sucesso!`)
      loadProducts()
    } catch (error) {
      toast.error('Erro ao importar planilha')
      console.error('Erro na importação:', error)
    }
  }

  const downloadTemplate = () => {
    const template = [
      {
        'Descrição': 'Produto Exemplo',
        'Quantidade': 10,
        'Valor Unitário': 5.50,
        'Valor Venda': 8.99,
        'Categoria': 'Alimentação',
        'Código Barras 1': '7891234567890',
        'Código Barras 2': '1234567890123'
      }
    ]

    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos')
    XLSX.writeFile(wb, 'template_produtos.xlsx')
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Gerenciar Produtos</h1>
          <p className="text-gray-400">Adicione e gerencie seus produtos</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={downloadTemplate}
            className="btn-secondary flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Template Excel
          </button>
          <button
            onClick={() => {
              setShowAddForm(true)
              setEditingProduct(null)
              setExistingProduct(null)
              setIsStockUpdate(false)
              reset()
            }}
            className="btn-primary flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Produto
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="card">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-white">
              {editingProduct ? 'Editar Produto' : 'Adicionar Produto'}
            </h3>
            <button
              onClick={() => {
                setShowAddForm(false)
                setEditingProduct(null)
                setExistingProduct(null)
                setIsStockUpdate(false)
                reset()
              }}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>

          {/* Alerta de produto existente */}
          {isStockUpdate && existingProduct && (
            <div className="mb-6 p-4 bg-blue-600/20 border border-blue-600/30 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertCircle className="w-5 h-5 text-blue-400 mr-2" />
                <h4 className="text-blue-400 font-medium">Produto Existente Encontrado</h4>
              </div>
              <p className="text-sm text-gray-300 mb-2">
                Este código de barras já está cadastrado para: <strong>{existingProduct.descricao}</strong>
              </p>
              <p className="text-sm text-gray-300">
                Estoque atual: <strong>{existingProduct.quantidade} unidades</strong>
              </p>
              <p className="text-sm text-blue-300 mt-2">
                💡 Digite a quantidade que está chegando para somar ao estoque existente.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Descrição *
              </label>
              <input
                {...register('descricao', { required: 'Descrição é obrigatória' })}
                className="input-field w-full"
                placeholder="Digite a descrição do produto"
                readOnly={isStockUpdate}
              />
              {errors.descricao && (
                <p className="text-red-400 text-sm mt-1">{errors.descricao.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isStockUpdate ? 'Quantidade a Adicionar *' : 'Quantidade *'}
              </label>
              <input
                type="number"
                {...register('quantidade', { required: 'Quantidade é obrigatória', min: 0 })}
                className="input-field w-full"
                placeholder={isStockUpdate ? "Quantidade chegando..." : "0"}
              />
              {errors.quantidade && (
                <p className="text-red-400 text-sm mt-1">{errors.quantidade.message}</p>
              )}
              {isStockUpdate && (
                <p className="text-xs text-gray-400 mt-1">
                  Será somado ao estoque atual de {existingProduct?.quantidade} unidades
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Valor Unitário *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('valor_unitario', { required: 'Valor unitário é obrigatório', min: 0 })}
                className="input-field w-full"
                placeholder="0.00"
                readOnly={isStockUpdate}
              />
              {errors.valor_unitario && (
                <p className="text-red-400 text-sm mt-1">{errors.valor_unitario.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Valor de Venda *
              </label>
              <input
                type="number"
                step="0.01"
                {...register('valor_venda', { required: 'Valor de venda é obrigatório', min: 0 })}
                className="input-field w-full"
                placeholder="0.00"
                readOnly={isStockUpdate}
              />
              {errors.valor_venda && (
                <p className="text-red-400 text-sm mt-1">{errors.valor_venda.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Categoria *
              </label>
              <input
                {...register('categoria', { required: 'Categoria é obrigatória' })}
                className="input-field w-full"
                placeholder="Ex: Alimentação, Bebidas..."
                readOnly={isStockUpdate}
              />
              {errors.categoria && (
                <p className="text-red-400 text-sm mt-1">{errors.categoria.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Código de Barras 1
              </label>
              <input
                {...register('codigo_barras_1')}
                className="input-field w-full"
                placeholder="Digite o código de barras"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Código de Barras 2
              </label>
              <input
                {...register('codigo_barras_2')}
                className="input-field w-full"
                placeholder="Digite o código de barras alternativo"
              />
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary">
                {isStockUpdate ? 'Atualizar Estoque' : editingProduct ? 'Atualizar Produto' : 'Adicionar Produto'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setEditingProduct(null)
                  setExistingProduct(null)
                  setIsStockUpdate(false)
                  reset()
                }}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Import Excel */}
      <div className="card">
        <div className="flex items-center mb-4">
          <FileSpreadsheet className="w-5 h-5 text-green-400 mr-2" />
          <h3 className="text-lg font-semibold text-white">Importar Planilha Excel</h3>
        </div>
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="excel-upload"
          />
          <label
            htmlFor="excel-upload"
            className="btn-secondary flex items-center cursor-pointer"
          >
            <Upload className="w-4 h-4 mr-2" />
            Escolher Arquivo
          </label>
          <p className="text-sm text-gray-400">
            Selecione um arquivo Excel (.xlsx) com os produtos
          </p>
        </div>
      </div>

      {/* Search and Products Table */}
      <div className="card">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-white">Produtos Cadastrados</h3>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
              placeholder="Buscar por descrição ou código de barras..."
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-300">Descrição</th>
                    <th className="text-left py-3 px-4 text-gray-300">Quantidade</th>
                    <th className="text-left py-3 px-4 text-gray-300">Valor Unit.</th>
                    <th className="text-left py-3 px-4 text-gray-300">Valor Venda</th>
                    <th className="text-left py-3 px-4 text-gray-300">Categoria</th>
                    <th className="text-left py-3 px-4 text-gray-300">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-white font-medium">{product.descricao}</p>
                          {(product.codigo_barras_1 || product.codigo_barras_2) && (
                            <p className="text-xs text-gray-400">
                              {product.codigo_barras_1} {product.codigo_barras_2}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{product.quantidade}</td>
                      <td className="py-3 px-4 text-gray-300">
                        {formatCurrency(product.valor_unitario)}
                      </td>
                      <td className="py-3 px-4 text-green-400 font-medium">
                        {formatCurrency(product.valor_venda)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-primary-600/20 text-primary-400 rounded text-xs">
                          {product.categoria}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-1 text-blue-400 hover:text-blue-300"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id!)}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center mt-6 gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-50"
                >
                  Anterior
                </button>
                <span className="text-gray-300">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary disabled:opacity-50"
                >
                  Próxima
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
} 