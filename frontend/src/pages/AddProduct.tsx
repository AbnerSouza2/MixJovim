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
  AlertCircle,
  Check,
  X,
  Copy,
  Printer
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
  const [editingInline, setEditingInline] = useState<{[key: number]: {field: string, value: string}} | null>(null)
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [labelQuantity, setLabelQuantity] = useState(1)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductForm>()

  const valorUnitario = watch('valor_unitario')
  const quantidade = watch('quantidade')
  const categoria = watch('categoria')
  const codigoBarras1 = watch('codigo_barras_1')
  const codigoBarras2 = watch('codigo_barras_2')

  // Opções de categoria com suas margens
  const categoriaOptions = [
    { value: 'Informática', label: 'Informática', desconto: 0.30 },
    { value: 'Eletrodoméstico', label: 'Eletrodoméstico', desconto: 0.35 },
    { value: 'Variados', label: 'Variados', desconto: 0.40 }
  ]

  // Calcular valor de venda automaticamente baseado na categoria
  const calcularValorVenda = (valorUnitario: number, categoria: string): number => {
    const categoriaInfo = categoriaOptions.find(cat => cat.value === categoria)
    if (categoriaInfo) {
      return Number((valorUnitario * (1 - categoriaInfo.desconto)).toFixed(2))
    }
    return valorUnitario
  }

  // Calcular valor de venda automaticamente baseado na categoria
  useEffect(() => {
    if (valorUnitario && categoria && !isStockUpdate) {
      const categoriaInfo = categoriaOptions.find(cat => cat.value === categoria)
      if (categoriaInfo) {
        const valorVenda = Number(valorUnitario) * (1 - categoriaInfo.desconto)
        setValue('valor_venda', Number(valorVenda.toFixed(2)))
      }
    }
  }, [valorUnitario, categoria, setValue, isStockUpdate])

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

  // Função para formatar valor em tempo real
  const formatCurrencyInput = (value: string): string => {
    // Remove todos os caracteres não numéricos
    const numericValue = value.replace(/[^\d]/g, '')
    
    if (!numericValue) return ''
    
    // Converte para número e divide por 100 para ter centavos
    const numberValue = parseInt(numericValue) / 100
    
    // Formata como moeda brasileira
    return numberValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  // Função para converter valor formatado para número
  const parseCurrencyInput = (value: string): number => {
    // Remove pontos (separadores de milhares) e substitui vírgula por ponto
    const numericString = value.replace(/\./g, '').replace(',', '.')
    return parseFloat(numericString) || 0
  }

  // Função para atualizar produto inline
  const updateProductInline = async (productId: number, field: string, value: string | number) => {
    try {
      const product = products.find(p => p.id === productId)
      if (!product) return

      let updatedData = { ...product }
      
      if (field === 'categoria') {
        updatedData.categoria = value as string
        // Recalcular valor de venda se valor unitário estiver preenchido
        if (updatedData.valor_unitario > 0) {
          updatedData.valor_venda = calcularValorVenda(updatedData.valor_unitario, value as string)
        }
      } else if (field === 'valor_unitario') {
        updatedData.valor_unitario = Number(value)
        // Recalcular valor de venda
        if (updatedData.categoria && categoriaOptions.find(c => c.value === updatedData.categoria)) {
          updatedData.valor_venda = calcularValorVenda(Number(value), updatedData.categoria)
        }
      }

      await productsApi.update(productId, updatedData)
      
      // Atualizar lista local
      setProducts(prev => prev.map(p => p.id === productId ? updatedData : p))
      
      if (field === 'categoria') {
        toast.success('Categoria atualizada!')
      } else if (field === 'valor_unitario') {
        toast.success('Valores atualizados!')
      }
      
    } catch (error) {
      toast.error('Erro ao atualizar produto')
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
      // Criar FormData para upload
      const formData = new FormData()
      formData.append('file', file)

      setLoading(true)
      const response = await productsApi.importExcel(formData)
      
      // Verificar se há dados na resposta
      if (response.data) {
        const { success, errors, created, updated, details } = response.data
        
        // Mostrar resultado detalhado
        if (success > 0 && errors === 0) {
          if (created > 0 && updated > 0) {
            toast.success(`✅ ${created} produtos novos criados, ${updated} produtos atualizados!`)
          } else if (created > 0) {
            toast.success(`✅ ${created} produtos novos criados!`)
          } else if (updated > 0) {
            toast.success(`🔄 ${updated} produtos atualizados (estoque somado)!`)
          } else {
            toast.success(`✅ ${success} produtos processados com sucesso!`)
          }
        } else if (success > 0 && errors > 0) {
          const createdMsg = created > 0 ? `${created} criados` : ''
          const updatedMsg = updated > 0 ? `${updated} atualizados` : ''
          const successMsg = [createdMsg, updatedMsg].filter(Boolean).join(', ')
          
          toast.success(`✅ ${successMsg}! ⚠️ ${errors} produtos com erro.`)
          if (details && details.length > 0) {
            console.log('Detalhes dos erros:', details)
          }
        } else if (success === 0 && errors > 0) {
          toast.error(`❌ Erro ao importar produtos. ${errors} erros encontrados.`)
          if (details && details.length > 0) {
            console.log('Detalhes dos erros:', details)
            // Mostrar primeiro erro como exemplo
            toast.error(`Exemplo de erro: ${details[0]}`)
          }
        } else {
          toast.error('❌ Nenhum produto foi importado. Verifique o formato do arquivo.')
        }
      } else {
        toast.success('✅ Produtos importados com sucesso!')
      }
      
      await loadProducts()
    } catch (error: any) {
      console.error('Erro na importação:', error)
      
      // Verificar se há detalhes do erro na resposta
      if (error.response?.data?.details) {
        const details = error.response.data.details
        toast.error(`❌ Erro na importação: ${details[0] || 'Formato inválido'}`)
      } else {
        toast.error('❌ Erro ao importar planilha. Verifique o formato do arquivo.')
      }
    } finally {
      setLoading(false)
      // Limpar o input de arquivo
      event.target.value = ''
    }
  }

  const downloadTemplate = () => {
    const template = [
      {
        'Descrição': 'Produto Exemplo',
        'Quantidade': 10,
        'Valor Unitário': '',
        'Valor Venda': '',
        'Categoria': 'Informática',
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
      currency: 'BRL',
    }).format(value)
  }

  const copyProductName = async (productName: string) => {
    try {
      await navigator.clipboard.writeText(productName)
      toast.success('Nome do produto copiado!')
    } catch (error) {
      toast.error('Erro ao copiar nome do produto')
    }
  }

  const printLabel = (product: Product) => {
    setSelectedProduct(product)
    setShowLabelModal(true)
    setLabelQuantity(1)
  }

  const generateLabels = () => {
    if (!selectedProduct) return

    const barcode = selectedProduct.codigo_barras_1 || selectedProduct.codigo_barras_2 || `${selectedProduct.id}`.padStart(13, '0')
    
    // Calcular quantas etiquetas por linha (máximo 2 para caber bem)
    const labelsPerRow = Math.min(labelQuantity, 2)
    const totalRows = Math.ceil(labelQuantity / labelsPerRow)
    
    let labelGrid = ''
    
    for (let row = 0; row < totalRows; row++) {
      const labelsInThisRow = Math.min(labelsPerRow, labelQuantity - (row * labelsPerRow))
      
      // Centralizar as etiquetas quando há apenas uma na linha
      const justifyContent = labelsInThisRow === 1 ? 'center' : 'flex-start'
      
      labelGrid += `<div style="display: flex; justify-content: ${justifyContent}; margin-bottom: 10px; gap: 10px;">`
      
      for (let col = 0; col < labelsInThisRow; col++) {
        const labelIndex = (row * labelsPerRow) + col
        labelGrid += `
          <div style="font-family: Arial, sans-serif; width: 300px; height: 220px; margin: 0; padding: 8px; border: 2px solid #000; text-align: center; box-sizing: border-box; background: white; display: flex; flex-direction: column; justify-content: space-between;">
            
            <!-- Nome do Produto -->
            <div style="font-weight: bold; font-size: 11px; line-height: 1.2; height: 45px; overflow: hidden; display: flex; align-items: center; justify-content: center; word-wrap: break-word; hyphens: auto;">
              ${selectedProduct.descricao.toUpperCase()}
            </div>
            
            <!-- Código de Barras -->
            <div style="display: flex; justify-content: center; align-items: center; height: 50px;">
              <canvas id="barcode${labelIndex}" style="max-width: 250px; height: 40px;"></canvas>
            </div>
            
            <!-- Preços -->
            <div style="margin: 5px 0;">
              <div style="color: #666; font-size: 10px; font-weight: bold; margin-bottom: 2px;">
                DE R$ ${Number(selectedProduct.valor_unitario || 0).toFixed(2).replace('.', ',')}
              </div>
              <div style="font-weight: bold; font-size: 14px; color: #000; margin-bottom: 2px;">
                POR R$ ${Number(selectedProduct.valor_venda || 0).toFixed(2).replace('.', ',')}
              </div>
            </div>
            
            <!-- Código de Barras em Texto -->
            <div style="font-size: 8px; color: #666; margin-top: 2px;">
              ${barcode}
            </div>
            
          </div>
        `
      }
      
      labelGrid += '</div>'
    }

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Etiquetas - ${selectedProduct.descricao}</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            <style>
              body { 
                margin: 10px; 
                padding: 0;
                font-family: Arial, sans-serif;
                background: #f5f5f5;
              }
              @media print {
                body { 
                  margin: 5mm; 
                  padding: 0; 
                  background: white; 
                }
                @page { 
                  margin: 5mm; 
                  size: A4;
                }
              }
            </style>
          </head>
          <body>
            ${labelGrid}
            <script>
              window.onload = function() {
                try {
                  // Gerar código de barras para cada etiqueta
                  for (let i = 0; i < ${labelQuantity}; i++) {
                    const canvas = document.getElementById('barcode' + i);
                    if (canvas) {
                      JsBarcode(canvas, "${barcode}", {
                        format: "CODE128",
                        width: 2,
                        height: 40,
                        displayValue: false,
                        margin: 0,
                        background: "#ffffff",
                        lineColor: "#000000"
                      });
                    }
                  }
                  
                  // Aguardar um pouco para os códigos de barras serem gerados
                  setTimeout(function() {
                    window.print();
                    setTimeout(function() {
                      window.close();
                    }, 100);
                  }, 1000);
                } catch (error) {
                  console.error("Erro ao gerar códigos de barras:", error);
                  // Se falhar, imprimir mesmo assim
                  setTimeout(function() {
                    window.print();
                    setTimeout(function() {
                      window.close();
                    }, 100);
                  }, 500);
                }
              }
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
    
    setShowLabelModal(false)
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
                Valor de Venda * (Calculado Automaticamente)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('valor_venda', { required: 'Valor de venda é obrigatório', min: 0 })}
                className="input-field w-full bg-gray-700"
                placeholder="0.00"
                readOnly={true}
              />
              {categoria && (
                <p className="text-xs text-gray-400 mt-1">
                  {categoria === 'Informática' && '30% de desconto aplicado'}
                  {categoria === 'Eletrodoméstico' && '35% de desconto aplicado'}
                  {categoria === 'Variados' && '40% de desconto aplicado'}
                </p>
              )}
              {errors.valor_venda && (
                <p className="text-red-400 text-sm mt-1">{errors.valor_venda.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Categoria *
              </label>
              <select
                {...register('categoria', { required: 'Categoria é obrigatória' })}
                className="input-field w-full"
                readOnly={isStockUpdate}
              >
                <option value="">Selecione uma categoria</option>
                {categoriaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-gray-400">
                                {product.codigo_barras_1} {product.codigo_barras_2}
                              </p>
                              <button
                                onClick={() => copyProductName(product.descricao)}
                                className="flex items-center gap-1 text-mixjovim-gold hover:text-yellow-400 transition-colors text-xs px-1 py-0.5 rounded hover:bg-gray-700/50"
                                title="Copiar nome do produto"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copiar</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-300">{product.quantidade}</td>
                      <td className="py-3 px-4">
                        {product.valor_unitario > 0 ? (
                          <input
                            type="text"
                            defaultValue={formatCurrencyInput((product.valor_unitario * 100).toString())}
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                            onBlur={(e) => {
                              const newValue = parseCurrencyInput(e.target.value)
                              if (newValue !== product.valor_unitario && newValue >= 0) {
                                updateProductInline(product.id!, 'valor_unitario', newValue)
                              }
                            }}
                            onChange={(e) => {
                              // Formatar em tempo real
                              const formatted = formatCurrencyInput(e.target.value)
                              e.target.value = formatted
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur()
                              }
                            }}
                          />
                        ) : (
                          <input
                            type="text"
                            placeholder="0,00"
                            className="w-24 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm placeholder-gray-400"
                            onBlur={(e) => {
                              const newValue = parseCurrencyInput(e.target.value)
                              if (newValue > 0) {
                                updateProductInline(product.id!, 'valor_unitario', newValue)
                              }
                            }}
                            onChange={(e) => {
                              // Formatar em tempo real
                              const formatted = formatCurrencyInput(e.target.value)
                              e.target.value = formatted
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur()
                              }
                            }}
                          />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {product.valor_venda > 0 ? (
                          <span className="text-green-400 font-medium">{formatCurrency(product.valor_venda)}</span>
                        ) : (
                          <span className="text-yellow-400 text-sm">⚠️ Não preenchido</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={product.categoria}
                          onChange={(e) => updateProductInline(product.id!, 'categoria', e.target.value)}
                          className={`px-2 py-1 rounded text-xs bg-gray-700 border border-gray-600 text-white min-w-[120px] ${
                            product.categoria === 'Selecione a categoria' ? 'text-yellow-400 border-yellow-500' : ''
                          }`}
                          style={{
                            backgroundColor: '#374151',
                            color: product.categoria === 'Selecione a categoria' ? '#fbbf24' : '#ffffff',
                            border: product.categoria === 'Selecione a categoria' ? '1px solid #f59e0b' : '1px solid #4B5563'
                          }}
                        >
                          {product.categoria === 'Selecione a categoria' && (
                            <option value="Selecione a categoria" style={{ backgroundColor: '#374151', color: '#fbbf24' }}>
                              Selecione a categoria
                            </option>
                          )}
                          {categoriaOptions.map((option) => (
                            <option 
                              key={option.value} 
                              value={option.value}
                              style={{ backgroundColor: '#374151', color: '#ffffff' }}
                            >
                              {option.label}
                            </option>
                          ))}
                        </select>
                        {['Informática', 'Eletrodoméstico', 'Variados'].includes(product.categoria) && (
                          <div className="mt-1">
                            <span className="text-xs text-green-400">
                              {product.categoria === 'Informática' && '(-30%)'}
                              {product.categoria === 'Eletrodoméstico' && '(-35%)'}
                              {product.categoria === 'Variados' && '(-40%)'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-1 text-blue-400 hover:text-blue-300"
                            title="Editar produto completo"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => printLabel(product)}
                            className="p-1 text-green-400 hover:text-green-300"
                            title="Imprimir etiqueta"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id!)}
                            className="p-1 text-red-400 hover:text-red-300"
                            title="Deletar produto"
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

      {/* Modal de Etiquetas */}
      {showLabelModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96">
            <h2 className="text-xl font-semibold text-white mb-4">{selectedProduct.descricao}</h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quantidade Gerada
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={labelQuantity}
                onChange={(e) => setLabelQuantity(Math.max(1, Math.min(50, Number(e.target.value))))}
                className="input-field w-full"
                placeholder="Quantidade de etiquetas"
              />
              <p className="text-xs text-gray-400 mt-1">
                Máximo 2 etiquetas por linha • Máximo 50 etiquetas
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={generateLabels}
                className="btn-gold flex-1"
              >
                GERAR ETIQUETAS
              </button>
              <button
                onClick={() => setShowLabelModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 