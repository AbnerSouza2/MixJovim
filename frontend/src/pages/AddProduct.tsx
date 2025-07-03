import React, { useState, useEffect, useRef } from 'react'
import { 
  Plus, 
  Upload, 
  Search, 
  Edit, 
  Trash2, 
  Download,
  FileSpreadsheet,
  AlertCircle,
  X,
  Copy,
  Printer,
  ClipboardCheck,
  AlertTriangle,
  Scan,
  User,
  Shuffle
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { productsApi, Product } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
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
  const [showLabelModal, setShowLabelModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [labelQuantity, setLabelQuantity] = useState(1)
  const [showConferenceModal, setShowConferenceModal] = useState(false)
  const [showLossModal, setShowLossModal] = useState(false)
  const [modalProduct, setModalProduct] = useState<Product | null>(null)
  const [modalQuantity, setModalQuantity] = useState('')
  const [modalObservations, setModalObservations] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  
  // Estados para o scanner
  const [showScannerModal, setShowScannerModal] = useState(false)
  const [scannerInput, setScannerInput] = useState('')
  const [scannerLoading, setScannerLoading] = useState(false)
  const [lastProcessedCode, setLastProcessedCode] = useState('')
  const [lastInputTime, setLastInputTime] = useState(0)
  const [insertingMessage, setInsertingMessage] = useState('')
  const [scannerBlocked, setScannerBlocked] = useState(false)
  
  // Estados para detalhes de conferência
  const [showConferenceDetailsModal, setShowConferenceDetailsModal] = useState(false)
  const [conferenceDetails, setConferenceDetails] = useState<any[]>([])
  const [selectedProductForDetails, setSelectedProductForDetails] = useState<Product | null>(null)
  
  // Estados para detalhes de perdas
  const [showLossDetailsModal, setShowLossDetailsModal] = useState(false)
  const [lossDetails, setLossDetails] = useState<any[]>([])
  const [selectedProductForLossDetails, setSelectedProductForLossDetails] = useState<Product | null>(null)
  
  // Ref para o timeout do debounce e input
  const scannerTimeoutRef = useRef<number | null>(null)
  const scannerInputRef = useRef<HTMLInputElement>(null)
  const insertingTimeoutRef = useRef<number | null>(null)
  const blockTimeoutRef = useRef<number | null>(null)

  const { user } = useAuth()
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ProductForm>()

  const valorUnitario = watch('valor_unitario')
  const categoria = watch('categoria')
  const codigoBarras1 = watch('codigo_barras_1')
  const codigoBarras2 = watch('codigo_barras_2')

  // Opções de categoria com suas margens
  const categoriaOptions = [
    { value: 'Informática', label: 'Informática', desconto: 0.30, porcentagem: '30%' },
    { value: 'Eletrodoméstico', label: 'Eletrodoméstico', desconto: 0.35, porcentagem: '35%' },
    { value: 'Variados', label: 'Variados', desconto: 0.40, porcentagem: '40%' }
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

  // Limpar timeout quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (scannerTimeoutRef.current) {
        clearTimeout(scannerTimeoutRef.current)
      }
      if (insertingTimeoutRef.current) {
        clearTimeout(insertingTimeoutRef.current)
      }
      if (blockTimeoutRef.current) {
        clearTimeout(blockTimeoutRef.current)
      }
    }
  }, [])

  // Manter foco no input do scanner quando modal estiver aberto
  useEffect(() => {
    if (showScannerModal && scannerInputRef.current) {
      const focusInput = () => {
        scannerInputRef.current?.focus()
      }
      
      // Foco inicial
      setTimeout(focusInput, 100)
      
      // Manter foco após processamento
      const interval = setInterval(focusInput, 500)
      
      return () => clearInterval(interval)
    }
  }, [showScannerModal, scannerLoading])

  // Verificar código de barras quando digitado
  useEffect(() => {
    const checkBarcodeExists = async () => {
      // Não executar verificação se estamos editando um produto
      if (editingProduct) return
      
      if ((codigoBarras1 && codigoBarras1.length >= 8) || (codigoBarras2 && codigoBarras2.length >= 8)) {
        try {
          const query = (codigoBarras1 || codigoBarras2) as string
          const response = await productsApi.search(query)
          const foundProduct = response.data.find((p: Product) => 
            p.codigo_barras_1 === query || p.codigo_barras_2 === query
          )
          
          if (foundProduct) {
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
          } else {
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
    try {
      setLoading(true)
      const response = await productsApi.getAll(currentPage, 20, search)
      
      // Verificar se a resposta tem a estrutura antiga ou nova
      if (response.data.products) {
        // Nova estrutura
        setProducts(response.data.products)
        setTotalPages(response.data.totalPages)
      } else {
        // Estrutura antiga (fallback)
        setProducts(response.data)
        setTotalPages(1)
      }
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
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
      setShowEditModal(false)
      loadProducts()
    } catch (error) {
      toast.error('Erro ao salvar produto')
    }
  }

  const handleEdit = (product: Product) => {
    console.log('🔧 Editando produto:', product.descricao, product.id)
    
    // Limpar todos os estados relacionados primeiro
    setExistingProduct(null)
    setIsStockUpdate(false)
    
    // Configurar produto para edição
    setEditingProduct(product)
    
    // Preencher o formulário com os dados do produto
    setValue('descricao', product.descricao)
    setValue('quantidade', product.quantidade)
    setValue('valor_unitario', product.valor_unitario)
    setValue('valor_venda', product.valor_venda)
    setValue('categoria', product.categoria)
    setValue('codigo_barras_1', product.codigo_barras_1 || '')
    setValue('codigo_barras_2', product.codigo_barras_2 || '')
    
    // Abrir modal de edição
    setShowEditModal(true)
    
    console.log('✅ Modal de edição aberto')
  }

  const handleDelete = async () => {
    if (!productToDelete) return
    
    try {
      await productsApi.delete(productToDelete.id!)
      toast.success('Produto excluído com sucesso!')
      setShowDeleteModal(false)
      setProductToDelete(null)
      loadProducts()
    } catch (error) {
      toast.error('Erro ao excluir produto')
    }
  }

  const openDeleteModal = (product: Product) => {
    setProductToDelete(product)
    setShowDeleteModal(true)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Verificar tamanho do arquivo
    const fileSizeMB = file.size / (1024 * 1024)
    console.log(`📁 Arquivo selecionado: ${file.name} (${fileSizeMB.toFixed(2)} MB)`)
    
    if (fileSizeMB > 100) {
      toast.error('❌ Arquivo muito grande. Máximo: 100MB')
      return
    }

    try {
      // Feedback diferenciado para arquivos grandes
      if (fileSizeMB > 10) {
        toast.loading('📤 Arquivo grande detectado. Processando... (pode levar alguns minutos)', {
          duration: 0, // Não remover automaticamente
          id: 'upload-progress'
        })
      } else {
        toast.loading('📤 Importando planilha...', {
          id: 'upload-progress'
        })
      }

      // Criar FormData para upload
      const formData = new FormData()
      formData.append('file', file)

      setLoading(true)
      
      // Configurar timeout maior para arquivos grandes
      const timeoutMs = fileSizeMB > 10 ? 300000 : 60000 // 5 min para grandes, 1 min para pequenos
      
      const response = await productsApi.importExcel(formData, timeoutMs)
      
      // Remover toast de carregamento
      toast.dismiss('upload-progress')
      
      // Verificar se há dados na resposta
      if (response.data) {
        const { success, errors, created, updated, totalProcessed, details } = response.data
        
        console.log('📊 Resultado da importação:', {
          success,
          errors,
          created,
          updated,
          totalProcessed,
          details
        })
        
        // Mostrar resultado detalhado
        if (success > 0 && errors === 0) {
          if (created > 0 && updated > 0) {
            toast.success(`✅ Importação completa! ${created} produtos novos criados, ${updated} produtos atualizados. Total: ${totalProcessed} produtos processados.`, {
              duration: 8000
            })
          } else if (created > 0) {
            toast.success(`✅ ${created} produtos novos criados! Total processado: ${totalProcessed}`, {
              duration: 6000
            })
          } else if (updated > 0) {
            toast.success(`🔄 ${updated} produtos atualizados (estoque somado)! Total processado: ${totalProcessed}`, {
              duration: 6000
            })
          } else {
            toast.success(`✅ ${success} produtos processados com sucesso!`, {
              duration: 4000
            })
          }
        } else if (success > 0 && errors > 0) {
          const createdMsg = created > 0 ? `${created} criados` : ''
          const updatedMsg = updated > 0 ? `${updated} atualizados` : ''
          const successMsg = [createdMsg, updatedMsg].filter(Boolean).join(', ')
          
          toast.success(`✅ ${successMsg}! ⚠️ ${errors} produtos com erro de ${totalProcessed} processados.`, {
            duration: 8000
          })
          
          if (details && details.length > 0) {
            console.log('Detalhes dos erros:', details)
            // Mostrar primeiros 3 erros como exemplo
            const firstErrors = details.slice(0, 3).join('\n')
            toast.error(`Exemplos de erros:\n${firstErrors}`, {
              duration: 10000
            })
          }
        } else if (success === 0 && errors > 0) {
          toast.error(`❌ Erro ao importar produtos. ${errors} erros encontrados de ${totalProcessed} linhas.`, {
            duration: 8000
          })
          if (details && details.length > 0) {
            console.log('Detalhes dos erros:', details)
            // Mostrar primeiro erro como exemplo
            toast.error(`Exemplo de erro: ${details[0]}`, {
              duration: 8000
            })
          }
        } else {
          toast.error('❌ Nenhum produto foi importado. Verifique o formato do arquivo.')
        }
      } else {
        toast.success('✅ Produtos importados com sucesso!')
      }
      
      await loadProducts()
    } catch (error: any) {
      // Remover toast de carregamento
      toast.dismiss('upload-progress')
      
      console.error('Erro na importação:', error)
      
      // Tratamento específico para timeouts
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        toast.error('⏱️ Timeout na importação. O arquivo é muito grande ou o servidor está sobrecarregado. Tente dividir a planilha em partes menores.', {
          duration: 10000
        })
      }
      // Verificar se há detalhes do erro na resposta
      else if (error.response?.data?.details) {
        const details = error.response.data.details
        toast.error(`❌ Erro na importação: ${details}`, {
          duration: 8000
        })
      } else if (error.response?.status === 413) {
        toast.error('❌ Arquivo muito grande. Máximo permitido: 100MB. Tente dividir a planilha.', {
          duration: 8000
        })
      } else {
        toast.error('❌ Erro ao importar planilha. Verifique o formato do arquivo e tente novamente.', {
          duration: 6000
        })
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

  const generateLabels = (product: Product, quantity: number) => {
    if (!product || quantity <= 0) return;

    const productName = product.descricao;
    const fromPrice = `DE R$ ${Number(product.valor_unitario).toFixed(2).replace('.', ',')}`;
    const mainPrice = `R$ ${Number(product.valor_venda).toFixed(2).replace('.', ',')}`;
    const barcodeValue = product.codigo_barras_1 || `${product.id}`.padStart(13, '0');

    let labelsHtml = '';
    for (let i = 0; i < quantity; i++) {
      labelsHtml += `
        <div class="label">
          <div class="product-name">${productName.toUpperCase()}</div>
          <div class="from-price">${fromPrice}</div>
          <div class="main-price">${mainPrice}</div>
          <div class="barcode-container">
            <svg id="barcode-${i}" class="barcode"></svg>
          </div>
        </div>
      `;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Etiqueta - ${productName}</title>
            <style>
              @page {
                size: 6cm 3cm;
                margin: 0;
              }
              body {
                margin: 0;
                font-family: Arial, sans-serif;
                display: flex;
                flex-wrap: wrap;
                justify-content: flex-start;
                align-items: flex-start;
              }
              .label {
                width: 6cm;
                height: 3cm;
                padding: 1.5mm;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                justify-content: center; /* Centraliza verticalmente */
                align-items: center;
                text-align: center;
                overflow: hidden;
              }
              .product-name {
                font-size: 7.5pt; /* Levemente menor */
                font-weight: bold;
                line-height: 1.1;
                margin: 0;
                word-break: break-word;
              }
              .from-price {
                font-size: 7.5pt; /* Levemente menor */
                color: #333;
                margin: 0.5mm 0;
              }
              .main-price {
                font-size: 15pt; /* Levemente menor */
                font-weight: 900;
                margin: 0.5mm 0;
              }
              .barcode-container {
                display: flex;
                justify-content: center;
                align-items: center;
                width: 100%;
              }
              .barcode {
                width: 95%;
                height: 10mm;
              }
            </style>
          </head>
          <body>
            ${labelsHtml}
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
            <script>
              window.onload = function() {
                try {
                  for (let i = 0; i < ${quantity}; i++) {
                    JsBarcode("#barcode-" + i, "${barcodeValue}", {
                      format: "CODE128",
                      width: 2,
                      height: 40,
                      displayValue: false,
                      background: "transparent"
                    });
                  }
                  window.print();
                } catch (e) {
                  console.error('Erro ao gerar código de barras:', e);
                }
              };
            <\/script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }

  // Função para registrar conferência ou perda com modal
  const openConferenceModal = (produto: Product) => {
    setModalProduct(produto)
    setModalQuantity('')
    setModalObservations('')
    setShowConferenceModal(true)
  }

  const openLossModal = (produto: Product) => {
    setModalProduct(produto)
    setModalQuantity('')
    setModalObservations('')
    setShowLossModal(true)
  }

  const handleConferenceSubmit = async () => {
    if (!modalProduct || !modalQuantity) {
      toast.error('Quantidade é obrigatória!')
      return
    }

    const quantidadeNum = Number(modalQuantity)
    if (isNaN(quantidadeNum) || quantidadeNum <= 0) {
      toast.error('Quantidade inválida!')
      return
    }

    // Calcular disponível: total - conferidos - perdas
    const totalConferido = modalProduct.total_conferido || 0
    const totalPerdas = modalProduct.total_perdas || 0
    const disponivel = modalProduct.quantidade - totalConferido - totalPerdas

    if (quantidadeNum > disponivel) {
      toast.error(`Quantidade conferida não pode ser maior que o disponível (${disponivel})! 
      Total: ${modalProduct.quantidade} | Já conferidos: ${totalConferido} | Já perdidos: ${totalPerdas}`)
      return
    }

    try {
      const response = await fetch('/api/estoque/registrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          produto_id: modalProduct.id,
          tipo: 'conferido',
          quantidade: quantidadeNum,
          observacoes: modalObservations || `Conferência de ${quantidadeNum} unidades`,
          usuario_id: user?.id
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        setShowConferenceModal(false)
        setModalQuantity('')
        setModalObservations('')
        loadProducts() // Recarregar lista
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Erro ao registrar conferência')
      }
    } catch (error) {
      console.error('Erro ao registrar conferência:', error)
      toast.error('Erro ao registrar conferência')
    }
  }

  const handleLossSubmit = async () => {
    if (!modalProduct || !modalQuantity) {
      toast.error('Quantidade é obrigatória!')
      return
    }

    if (!modalObservations || modalObservations.trim() === '') {
      toast.error('Motivo da perda é obrigatório!')
      return
    }

    const quantidadeNum = Number(modalQuantity)
    if (isNaN(quantidadeNum) || quantidadeNum <= 0) {
      toast.error('Quantidade inválida!')
      return
    }

    // Calcular disponível: total - conferidos - perdas
    const totalConferido = modalProduct.total_conferido || 0
    const totalPerdas = modalProduct.total_perdas || 0
    const disponivel = modalProduct.quantidade - totalConferido - totalPerdas

    if (quantidadeNum > disponivel) {
      toast.error(`Quantidade de perda não pode ser maior que o disponível (${disponivel})! 
      Total: ${modalProduct.quantidade} | Já conferidos: ${totalConferido} | Já perdidos: ${totalPerdas}`)
      return
    }

    try {
      const response = await fetch('/api/estoque/registrar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          produto_id: modalProduct.id,
          tipo: 'perda',
          quantidade: quantidadeNum,
          observacoes: modalObservations || `Perda de ${quantidadeNum} unidades`,
          usuario_id: user?.id
        })
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        setShowLossModal(false)
        setModalQuantity('')
        setModalObservations('')
        loadProducts() // Recarregar lista
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Erro ao registrar perda')
      }
    } catch (error) {
      console.error('Erro ao registrar perda:', error)
      toast.error('Erro ao registrar perda')
    }
  }

  // Funções do Scanner
  const openScannerModal = () => {
    setShowScannerModal(true)
    setScannerInput('')
    setLastProcessedCode('')
    setLastInputTime(0)
    setScannerLoading(false)
    setInsertingMessage('')
    setScannerBlocked(false)
  }

  const closeScannerModal = () => {
    setShowScannerModal(false)
    setScannerInput('')
    setLastProcessedCode('')
    setLastInputTime(0)
    setScannerLoading(false)
    setInsertingMessage('')
    setScannerBlocked(false)
    if (scannerTimeoutRef.current) {
      clearTimeout(scannerTimeoutRef.current)
    }
    if (insertingTimeoutRef.current) {
      clearTimeout(insertingTimeoutRef.current)
    }
    if (blockTimeoutRef.current) {
      clearTimeout(blockTimeoutRef.current)
    }
  }

  const handleScannerInput = async (barcode?: string) => {
    // Usar o valor atual do input se não for fornecido um código específico
    const codeToProcess = barcode || scannerInput
    
    // Verificar se já está processando, se é o mesmo código ou se está bloqueado
    if (scannerLoading || !codeToProcess.trim() || codeToProcess.length < 8 || codeToProcess === lastProcessedCode || scannerBlocked) {
      return
    }

    console.log('🔍 Processando código:', codeToProcess)
    setLastProcessedCode(codeToProcess)
    setScannerLoading(true)
    setScannerBlocked(true) // Bloquear scanner
    setInsertingMessage('Inserindo...')
    
    try {
      // Buscar produto pelo código de barras
      const response = await productsApi.search(codeToProcess.trim())
      const foundProduct = response.data.find((p: Product) => 
        p.codigo_barras_1 === codeToProcess.trim() || p.codigo_barras_2 === codeToProcess.trim()
      )

      if (foundProduct) {
        console.log('✅ Produto encontrado:', foundProduct.descricao)
        
        // Verificar se há estoque disponível antes de conferir
        const totalConferido = foundProduct.total_conferido || 0
        const totalPerdas = foundProduct.total_perdas || 0
        const disponivel = foundProduct.quantidade - totalConferido - totalPerdas

        if (disponivel <= 0) {
          setInsertingMessage('❌ Sem estoque disponível')
          toast.error(`❌ ${foundProduct.descricao}: Sem estoque disponível para conferir`)
          console.log('❌ Sem estoque disponível para:', foundProduct.descricao)
          return
        }

        // Registrar conferência automaticamente
        const conferenceResponse = await fetch('/api/estoque/registrar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            produto_id: foundProduct.id!,
            tipo: 'conferido',
            quantidade: 1,
            observacoes: `Conferido via scanner automático em ${new Date().toLocaleString()}`,
            usuario_id: user?.id
          })
        })

        if (conferenceResponse.ok) {
          setInsertingMessage('✅ Produto validado')
          console.log('✅ Conferência registrada com sucesso')
          loadProducts() // Recarregar lista
          
          // Mostrar toast após um pequeno delay
          setTimeout(() => {
            toast.success(`✅ Produto validado`)
          }, 500)
        } else {
          const errorData = await conferenceResponse.json()
          setInsertingMessage('❌ Erro ao conferir')
          toast.error(`❌ Erro ao conferir: ${errorData.error || 'Erro desconhecido'}`)
          console.error('❌ Erro na conferência:', errorData)
        }
      } else {
        setInsertingMessage('❌ Produto não encontrado')
        toast.error(`❌ Produto não encontrado: ${codeToProcess}`)
        console.log('❌ Produto não encontrado para código:', codeToProcess)
      }
    } catch (error) {
      console.error('❌ Erro ao processar escaneamento:', error)
      setInsertingMessage('❌ Erro ao processar')
      toast.error('❌ Erro ao processar escaneamento')
    } finally {
      setScannerLoading(false)
      setScannerInput('') // Limpar campo automaticamente
      
      // Limpar mensagem de inserindo após 2 segundos
      if (insertingTimeoutRef.current) {
        clearTimeout(insertingTimeoutRef.current)
      }
      insertingTimeoutRef.current = window.setTimeout(() => {
        setInsertingMessage('')
      }, 2000)
      
      // Desbloquear scanner após 1 segundo
      if (blockTimeoutRef.current) {
        clearTimeout(blockTimeoutRef.current)
      }
      blockTimeoutRef.current = window.setTimeout(() => {
        setScannerBlocked(false)
        setLastProcessedCode('') // Permitir re-escaneamento do mesmo código
        console.log('🔓 Scanner desbloqueado')
      }, 1000)
      
      // Garantir que o input mantenha o foco
      setTimeout(() => {
        if (scannerInputRef.current) {
          scannerInputRef.current.focus()
        }
      }, 100)
    }
  }

  // Função para detectar automaticamente quando um código completo foi digitado
  const handleScannerChange = (value: string) => {
    // Se o scanner estiver bloqueado, não processar
    if (scannerBlocked) {
      console.log('🚫 Scanner bloqueado, aguarde...')
      return
    }

    const currentTime = Date.now()
    const timeDiff = currentTime - lastInputTime
    
    setScannerInput(value)
    setLastInputTime(currentTime)
    
    // Limpar timeout anterior se existir
    if (scannerTimeoutRef.current) {
      clearTimeout(scannerTimeoutRef.current)
    }
    
    // Se o código tem pelo menos 8 caracteres e não está carregando
    if (value.length >= 8 && !scannerLoading && value !== lastProcessedCode) {
      // Detectar se foi inserido muito rapidamente (scanner) ou se é um código longo
      const isScannedCode = value.length >= 12 || (value.length >= 8 && timeDiff < 50)
      
      if (isScannedCode) {
        // Para códigos escaneados, aguardar um pouco mais para garantir que o código completo foi inserido
        console.log('🚀 Código detectado como escaneado, aguardando conclusão...', value)
        scannerTimeoutRef.current = window.setTimeout(() => {
          // Usar o valor atual do input para garantir que temos o código completo
          const currentValue = scannerInputRef.current?.value || scannerInput
          if (currentValue && currentValue.length >= 8 && !scannerLoading) {
            console.log('🚀 Processando código escaneado completo:', currentValue)
            handleScannerInput(currentValue)
          }
        }, 150) // Aguardar 150ms para garantir que o código completo foi inserido
      } else {
        // Para códigos digitados manualmente, usar debounce maior
        console.log('⌨️ Código detectado como digitado, aguardando...', value)
        scannerTimeoutRef.current = window.setTimeout(() => {
          const currentValue = scannerInputRef.current?.value || scannerInput
          if (currentValue && currentValue.length >= 8) {
            handleScannerInput(currentValue)
          }
        }, 500)
      }
    }
  }

  const handleScannerKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !scannerLoading) {
      e.preventDefault()
      if (scannerTimeoutRef.current) {
        clearTimeout(scannerTimeoutRef.current)
      }
      if (scannerInput.length >= 8) {
        handleScannerInput(scannerInput)
      }
    }
  }

  // Função para detectar paste (códigos colados ou escaneados muito rápido)
  const handleScannerPaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData('text')
    if (pastedText.length >= 8) {
      e.preventDefault()
      setScannerInput(pastedText)
      // Processar códigos colados após um delay para garantir que foram inseridos completamente
      setTimeout(() => {
        if (!scannerLoading && pastedText !== lastProcessedCode) {
          console.log('📋 Processando código colado:', pastedText)
          handleScannerInput(pastedText)
        }
      }, 200) // Aguardar 200ms para códigos colados
    }
  }

  // Função para processar quando o campo perde o foco (útil para scanners)
  const handleScannerBlur = () => {
    if (scannerInput.length >= 8 && !scannerLoading && scannerInput !== lastProcessedCode) {
      if (scannerTimeoutRef.current) {
        clearTimeout(scannerTimeoutRef.current)
      }
      handleScannerInput(scannerInput)
    }
  }

  // Função para mostrar detalhes de conferência
  const showConferenceDetails = async (produto: Product) => {
    if (!produto.id || !produto.total_conferido || produto.total_conferido === 0) {
      toast.error('Este produto ainda não foi conferido')
      return
    }

    try {
      const response = await fetch(`/api/estoque/produto/${produto.id}/conferencias`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setConferenceDetails(data)
        setSelectedProductForDetails(produto)
        setShowConferenceDetailsModal(true)
      } else {
        toast.error('Erro ao buscar detalhes de conferência')
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes de conferência:', error)
      toast.error('Erro ao buscar detalhes de conferência')
    }
  }

  // Função para mostrar detalhes das perdas
  const showLossDetails = async (produto: Product) => {
    if (!produto.id || !produto.total_perdas || produto.total_perdas === 0) {
      toast.error('Este produto não tem perdas registradas')
      return
    }

    try {
      const response = await fetch(`/api/estoque/produto/${produto.id}/perdas`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setLossDetails(data)
        setSelectedProductForLossDetails(produto)
        setShowLossDetailsModal(true)
      } else {
        toast.error('Erro ao buscar detalhes das perdas')
      }
    } catch (error) {
      console.error('Erro ao buscar detalhes das perdas:', error)
      toast.error('Erro ao buscar detalhes das perdas')
    }
  }

  // Função para gerar código de barras aleatório de 8 dígitos
  const generateRandomBarcode = async (): Promise<string> => {
    let attempts = 0
    const maxAttempts = 100

    while (attempts < maxAttempts) {
      // Gerar número aleatório de 8 dígitos
      const randomCode = Math.floor(10000000 + Math.random() * 90000000).toString()
      
      try {
        // Verificar se o código já existe
        const response = await productsApi.search(randomCode)
        const existingProduct = response.data.find((p: Product) => 
          p.codigo_barras_1 === randomCode || p.codigo_barras_2 === randomCode
        )

        if (!existingProduct) {
          return randomCode
        }
      } catch (error) {
        // Se houver erro na busca, considerar que o código não existe
        return randomCode
      }

      attempts++
    }

    // Se não conseguir gerar um código único após 100 tentativas
    throw new Error('Não foi possível gerar um código único')
  }

  // Função para gerar código para o campo 1
  const generateBarcodeField1 = async () => {
    try {
      const newCode = await generateRandomBarcode()
      setValue('codigo_barras_1', newCode)
      toast.success(`Código gerado: ${newCode}`)
    } catch (error) {
      toast.error('Erro ao gerar código de barras')
    }
  }

  // Função para gerar código para o campo 2
  const generateBarcodeField2 = async () => {
    try {
      const newCode = await generateRandomBarcode()
      setValue('codigo_barras_2', newCode)
      toast.success(`Código gerado: ${newCode}`)
    } catch (error) {
      toast.error('Erro ao gerar código de barras')
    }
  }

  return (
    <div className="container mx-auto p-4 bg-gray-900 text-white min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1 sm:mb-2">Gerenciar Produtos</h1>
          <p className="text-gray-400 text-sm sm:text-base">Adicione e gerencie seus produtos</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={downloadTemplate}
            className="btn-secondary flex items-center justify-center text-xs sm:text-sm"
          >
            <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Template Excel</span>
            <span className="sm:hidden">Template</span>
          </button>
          <button
            onClick={openScannerModal}
            className="btn-secondary flex items-center justify-center bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm"
          >
            <Scan className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Escanear Produtos</span>
            <span className="sm:hidden">Escanear</span>
          </button>
          <button
            onClick={() => {
              setShowAddForm(true)
              setExistingProduct(null)
              setIsStockUpdate(false)
              reset()
            }}
            className="btn-primary flex items-center justify-center text-xs sm:text-sm"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Novo Produto</span>
            <span className="sm:hidden">Novo</span>
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && !editingProduct && (
        <div className="card">
          <div className="flex justify-between items-center mb-4 sm:mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-white">
              Adicionar Produto
            </h3>
            <button
              onClick={() => {
                setShowAddForm(false)
                setExistingProduct(null)
                setIsStockUpdate(false)
                reset()
              }}
              className="text-gray-400 hover:text-white text-xl"
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

          <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
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
              <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2">
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
                disabled={isStockUpdate}
              >
                <option value="">Selecione uma categoria</option>
                {categoriaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} - {option.porcentagem} desconto
                  </option>
                ))}
              </select>
              {categoria && (
                <p className="text-xs text-mixjovim-gold mt-1 font-medium">
                  {categoria === 'Informática' && '✨ 30% de desconto aplicado no valor de venda'}
                  {categoria === 'Eletrodoméstico' && '✨ 35% de desconto aplicado no valor de venda'}
                  {categoria === 'Variados' && '✨ 40% de desconto aplicado no valor de venda'}
                </p>
              )}
              {errors.categoria && (
                <p className="text-red-400 text-sm mt-1">{errors.categoria.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Código de Barras 1
              </label>
              <div className="relative">
                <input
                  {...register('codigo_barras_1')}
                  className="input-field w-full pr-20"
                  placeholder="Digite o código de barras"
                />
                <button
                  type="button"
                  onClick={generateBarcodeField1}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs rounded flex items-center gap-1 transition-colors"
                  title="Gerar código aleatório de 8 dígitos"
                >
                  <Shuffle className="w-3 h-3" />
                  Gerar
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Código de Barras 2
              </label>
              <div className="relative">
                <input
                  {...register('codigo_barras_2')}
                  className="input-field w-full pr-20"
                  placeholder="Digite o código de barras alternativo"
                />
                <button
                  type="button"
                  onClick={generateBarcodeField2}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs rounded flex items-center gap-1 transition-colors"
                  title="Gerar código aleatório de 8 dígitos"
                >
                  <Shuffle className="w-3 h-3" />
                  Gerar
                </button>
              </div>
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary">
                {isStockUpdate ? 'Atualizar Estoque' : 'Adicionar Produto'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
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
        <div className="flex items-center mb-3 sm:mb-4">
          <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 mr-2" />
          <h3 className="text-base sm:text-lg font-semibold text-white">Importar Planilha Excel</h3>
        </div>
        
        {/* Informações sobre suporte a arquivos grandes */}
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
          <h4 className="text-sm font-semibold text-blue-300 mb-2">📊 Suporte a Planilhas Grandes</h4>
          <ul className="text-xs text-blue-200 space-y-1">
            <li>✅ Suporte até <strong>100MB</strong> e <strong>25.000+ produtos</strong></li>
            <li>⏱️ Timeout de até 5 minutos para arquivos grandes</li>
          </ul>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
            id="excel-upload"
          />
          <label
            htmlFor="excel-upload"
            className="btn-secondary flex items-center justify-center cursor-pointer text-xs sm:text-sm"
          >
            <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            Escolher Arquivo
          </label>
          <div className="text-xs sm:text-sm text-gray-400">
            <p>Selecione um arquivo Excel (.xlsx) com os produtos</p>
            <p className="text-green-400 mt-1">💡 Dica: Arquivos grandes podem levar alguns minutos</p>
          </div>
        </div>
      </div>

      {/* Search and Products Table */}
      <div className="card">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
          <h3 className="text-base sm:text-lg font-semibold text-white">Produtos Cadastrados</h3>
          <div className="relative w-full sm:w-auto">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10 w-full sm:w-64 text-sm"
              placeholder="Buscar por descrição ou código..."
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : (
          <>
                                  <div className="overflow-x-auto scrollbar-custom">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Descrição</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Qtd</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden md:table-cell">V. Unit.</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">V. Venda</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm hidden lg:table-cell">Categoria</th>
                    <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-gray-300 text-xs sm:text-sm">Ações</th>
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
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{product.quantidade}</span>
                            {((product.total_conferido && product.total_conferido > 0) || (product.total_perdas && product.total_perdas > 0)) && (
                              <div className="flex items-center gap-2 text-xs ml-2">
                                {product.total_conferido && product.total_conferido > 0 && (
                                  <button
                                    onClick={() => showConferenceDetails(product)}
                                    className="text-green-400 font-bold hover:text-green-300 cursor-pointer"
                                    title="Ver detalhes das conferências"
                                  >
                                    +{product.total_conferido}
                                  </button>
                                )}
                                {product.total_perdas && product.total_perdas > 0 && (
                                  <button
                                    onClick={() => showLossDetails(product)}
                                    className="text-red-400 font-bold hover:text-red-300 cursor-pointer"
                                    title="Ver motivos das perdas"
                                  >
                                    -{product.total_perdas}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
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
                        {product.categoria && categoriaOptions.find(cat => cat.value === product.categoria) ? (
                          <div>
                            <select
                              defaultValue={product.categoria}
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                              onBlur={(e) => {
                                const newValue = e.target.value
                                if (newValue !== product.categoria && newValue !== '') {
                                  updateProductInline(product.id!, 'categoria', newValue)
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur()
                                }
                              }}
                            >
                              {categoriaOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-mixjovim-gold mt-1">
                              {categoriaOptions.find(cat => cat.value === product.categoria)?.porcentagem} desconto
                            </p>
                          </div>
                        ) : (
                          <div>
                            <select
                              defaultValue=""
                              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-yellow-400 text-sm"
                              onBlur={(e) => {
                                const newValue = e.target.value
                                if (newValue !== '') {
                                  updateProductInline(product.id!, 'categoria', newValue)
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur()
                                }
                              }}
                            >
                              <option value="" disabled>Selecione a categoria</option>
                              {categoriaOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label} - {option.porcentagem}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-gray-400 mt-1">
                              Selecione para aplicar desconto
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openConferenceModal(product)}
                            className="p-1 text-green-400 hover:text-green-300"
                            title="Registrar conferência"
                          >
                            <ClipboardCheck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openLossModal(product)}
                            className="p-1 text-red-400 hover:text-red-300"
                            title="Registrar perda"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </button>
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
                            onClick={() => openDeleteModal(product)}
                            className="p-1 text-red-400 hover:text-red-300"
                            title="Excluir produto"
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
              <div className="flex justify-center items-center mt-4 sm:mt-6 gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary disabled:opacity-50 text-xs sm:text-sm px-2 sm:px-4"
                >
                  <span className="hidden sm:inline">Anterior</span>
                  <span className="sm:hidden">Ant.</span>
                </button>

                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-2 sm:px-3 py-1 text-xs sm:text-sm rounded border ${
                        pageNum === currentPage
                          ? 'bg-mixjovim-gold text-black border-mixjovim-gold font-medium'
                          : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}


                
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary disabled:opacity-50 text-xs sm:text-sm px-2 sm:px-4"
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <span className="sm:hidden">Prox.</span>
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
                onClick={() => selectedProduct && generateLabels(selectedProduct, labelQuantity)}
                className="btn-gold flex-1"
              >
                Imprimir Etiquetas
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

      {/* Modal de Conferência */}
      {showConferenceModal && modalProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Registrar Conferência</h2>
              <button
                onClick={() => setShowConferenceModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-2">Produto:</p>
              <p className="text-white font-medium">{modalProduct.descricao}</p>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Total: {modalProduct.quantidade} unidades</p>
                {(modalProduct.total_conferido && modalProduct.total_conferido > 0) && (
                  <p className="text-green-400">✓ Já conferidos: {modalProduct.total_conferido}</p>
                )}
                {(modalProduct.total_perdas && modalProduct.total_perdas > 0) && (
                  <p className="text-red-400">✗ Já perdidos: {modalProduct.total_perdas}</p>
                )}
                <p className="text-blue-400 font-medium">
                  📦 Disponível para conferir: {modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0)}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quantidade Conferida *
              </label>
              <input
                type="number"
                min="1"
                max={modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0)}
                value={modalQuantity}
                onChange={(e) => setModalQuantity(e.target.value)}
                className={`input-field w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  modalQuantity && Number(modalQuantity) > (modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0)) 
                    ? 'border-red-500 bg-red-900/20' 
                    : ''
                }`}
                placeholder="Digite a quantidade conferida"
                autoFocus
              />
              {modalQuantity && Number(modalQuantity) > (modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0)) && (
                <p className="text-red-400 text-sm mt-1">
                  ⚠️ Quantidade excede o disponível ({modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0)})
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Observações (opcional)
              </label>
              <textarea
                value={modalObservations}
                onChange={(e) => setModalObservations(e.target.value)}
                className="input-field w-full h-20 resize-none"
                placeholder="Observações sobre a conferência..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleConferenceSubmit}
                disabled={!modalQuantity || Number(modalQuantity) <= 0 || Number(modalQuantity) > (modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0))}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✅ Confirmar
              </button>
              <button
                onClick={() => setShowConferenceModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Perda */}
      {showLossModal && modalProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Registrar Perda</h2>
              <button
                onClick={() => setShowLossModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-2">Produto:</p>
              <p className="text-white font-medium">{modalProduct.descricao}</p>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Total: {modalProduct.quantidade} unidades</p>
                {(modalProduct.total_conferido && modalProduct.total_conferido > 0) && (
                  <p className="text-green-400">✓ Já conferidos: {modalProduct.total_conferido}</p>
                )}
                {(modalProduct.total_perdas && modalProduct.total_perdas > 0) && (
                  <p className="text-red-400">✗ Já perdidos: {modalProduct.total_perdas}</p>
                )}
                <p className="text-blue-400 font-medium">
                  📦 Disponível para marcar como perda: {modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0)}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quantidade Perdida *
              </label>
              <input
                type="number"
                min="1"
                max={modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0)}
                value={modalQuantity}
                onChange={(e) => setModalQuantity(e.target.value)}
                className={`input-field w-full [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                  modalQuantity && Number(modalQuantity) > (modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0)) 
                    ? 'border-red-500 bg-red-900/20' 
                    : ''
                }`}
                placeholder="Digite a quantidade perdida"
                autoFocus
              />
              {modalQuantity && Number(modalQuantity) > (modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0)) && (
                <p className="text-red-400 text-sm mt-1">
                  ⚠️ Quantidade excede o disponível ({modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0)})
                </p>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Motivo da Perda *
              </label>
              <textarea
                value={modalObservations}
                onChange={(e) => setModalObservations(e.target.value)}
                className="input-field w-full h-20 resize-none"
                placeholder="Descreva o motivo da perda (avaria, vencimento, etc.)"
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLossSubmit}
                disabled={!modalQuantity || Number(modalQuantity) <= 0 || Number(modalQuantity) > (modalProduct.quantidade - (modalProduct.total_conferido || 0) - (modalProduct.total_perdas || 0)) || !modalObservations || modalObservations.trim() === ''}
                className="btn-danger flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ⚠️ Confirmar
              </button>
              <button
                onClick={() => setShowLossModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Edição */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Editar Produto</h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditingProduct(null)
                  reset()
                }}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Descrição *
                </label>
                <input
                  {...register('descricao', { required: 'Descrição é obrigatória' })}
                  className="input-field w-full"
                  placeholder="Digite a descrição do produto"
                />
                {errors.descricao && (
                  <p className="text-red-400 text-sm mt-1">{errors.descricao.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Quantidade *
                </label>
                <input
                  type="number"
                  {...register('quantidade', { required: 'Quantidade é obrigatória', min: 0 })}
                  className="input-field w-full"
                  placeholder="0"
                />
                {errors.quantidade && (
                  <p className="text-red-400 text-sm mt-1">{errors.quantidade.message}</p>
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
                >
                  <option value="">Selecione uma categoria</option>
                  {categoriaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} - {option.porcentagem} desconto
                    </option>
                  ))}
                </select>
                {categoria && (
                  <p className="text-xs text-mixjovim-gold mt-1 font-medium">
                    {categoria === 'Informática' && '✨ 30% de desconto aplicado no valor de venda'}
                    {categoria === 'Eletrodoméstico' && '✨ 35% de desconto aplicado no valor de venda'}
                    {categoria === 'Variados' && '✨ 40% de desconto aplicado no valor de venda'}
                  </p>
                )}
                {errors.categoria && (
                  <p className="text-red-400 text-sm mt-1">{errors.categoria.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Código de Barras 1
                </label>
                <div className="relative">
                  <input
                    {...register('codigo_barras_1')}
                    className="input-field w-full pr-20"
                    placeholder="Digite o código de barras"
                  />
                  <button
                    type="button"
                    onClick={generateBarcodeField1}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs rounded flex items-center gap-1 transition-colors"
                    title="Gerar código aleatório de 8 dígitos"
                  >
                    <Shuffle className="w-3 h-3" />
                    Gerar
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Código de Barras 2
                </label>
                <div className="relative">
                  <input
                    {...register('codigo_barras_2')}
                    className="input-field w-full pr-20"
                    placeholder="Digite o código de barras alternativo"
                  />
                  <button
                    type="button"
                    onClick={generateBarcodeField2}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs rounded flex items-center gap-1 transition-colors"
                    title="Gerar código aleatório de 8 dígitos"
                  >
                    <Shuffle className="w-3 h-3" />
                    Gerar
                  </button>
                </div>
              </div>

              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="btn-primary">
                  Atualizar Produto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingProduct(null)
                    reset()
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Exclusão */}
      {showDeleteModal && productToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Confirmar Exclusão</h2>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <p className="text-sm text-gray-300 mb-2">Tem certeza que deseja excluir este produto?</p>
              <p className="text-white font-medium">{productToDelete.descricao}</p>
              <p className="text-sm text-gray-400 mt-2">Esta ação não pode ser desfeita.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="btn-danger flex-1"
              >
                🗑️ Confirmar
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal do Scanner */}
      {showScannerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <Scan className="w-6 h-6 text-green-400 mr-3" />
                <h2 className="text-xl font-semibold text-white">Scanner de Produtos</h2>
              </div>
              <button
                onClick={closeScannerModal}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instruções */}
            <div className="mb-6 p-4 bg-blue-600/20 border border-blue-600/30 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertCircle className="w-5 h-5 text-blue-400 mr-2" />
                <h4 className="text-blue-400 font-medium">Scanner Ultra-Rápido - 100% Automático</h4>
              </div>
              <ul className="text-sm text-gray-300 space-y-1">
                <li>• Digite ou escaneie o código de barras no campo abaixo (mínimo 8 caracteres)</li>
               
              </ul>
            </div>

            {/* Campo de entrada do scanner */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Código de Barras - Scanner Automático
                {scannerBlocked && (
                  <span className="ml-2 text-red-400 text-xs">🚫 Bloqueado por 1 segundo</span>
                )}
              </label>
              <div className="flex gap-3">
                <input
                  ref={scannerInputRef}
                  type="text"
                  value={scannerInput}
                  onChange={(e) => handleScannerChange(e.target.value)}
                  onKeyPress={handleScannerKeyPress}
                  onBlur={handleScannerBlur}
                  onPaste={handleScannerPaste}
                  className={`input-field flex-1 text-lg font-mono ${scannerBlocked ? 'bg-red-900/20 border-red-600' : ''}`}
                  placeholder="Digite ou escaneie o código de barras (mínimo 8 caracteres)..."
                  autoFocus
                  disabled={scannerLoading || scannerBlocked}
                  autoComplete="off"
                  spellCheck={false}
                />
                {scannerLoading && (
                  <div className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Processando...
                  </div>
                )}
                {scannerBlocked && !scannerLoading && (
                  <div className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg">
                    <div className="w-4 h-4 mr-2">🚫</div>
                    Bloqueado
                  </div>
                )}
              </div>
              
              {/* Mensagem de status */}
              {insertingMessage && (
                <div className="mt-3 p-3 rounded-lg text-center font-medium text-lg">
                  {insertingMessage.includes('✅') && (
                    <div className="bg-green-600/20 border border-green-600/30 text-green-400">
                      {insertingMessage}
                    </div>
                  )}
                  {insertingMessage.includes('❌') && (
                    <div className="bg-red-600/20 border border-red-600/30 text-red-400">
                      {insertingMessage}
                    </div>
                  )}
                  {insertingMessage === 'Inserindo...' && (
                    <div className="bg-blue-600/20 border border-blue-600/30 text-blue-400 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mr-2" />
                      {insertingMessage}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Botão de fechar */}
            <div className="flex justify-end">
              <button
                onClick={closeScannerModal}
                className="btn-secondary"
                disabled={scannerLoading}
              >
                Fechar Scanner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes de Conferência */}
      {showConferenceDetailsModal && selectedProductForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Detalhes de Conferência</h2>
              <button
                onClick={() => setShowConferenceDetailsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-2">Produto:</p>
              <p className="text-white font-medium">{selectedProductForDetails.descricao}</p>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Total conferido: <span className="text-green-400 font-medium">{selectedProductForDetails.total_conferido}</span></p>
                <p>Última conferência: <span className="text-blue-400">{selectedProductForDetails.ultima_conferencia ? new Date(selectedProductForDetails.ultima_conferencia).toLocaleString('pt-BR') : '-'}</span></p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-medium text-white mb-3">Histórico de Conferências</h3>
              
              {conferenceDetails.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardCheck className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhuma conferência encontrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conferenceDetails.map((conferencia: any) => (
                    <div key={conferencia.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-mixjovim-gold" />
                          <span className="text-mixjovim-gold font-medium">
                            {conferencia.usuario_nome || 'Sistema'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {new Date(conferencia.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Quantidade:</span>
                          <span className="text-green-400 font-medium ml-2">{conferencia.quantidade}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Valor Total:</span>
                          <span className="text-white font-medium ml-2">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(conferencia.valor_total)}
                          </span>
                        </div>
                      </div>
                      
                      {conferencia.observacoes && (
                        <div className="mt-2">
                          <span className="text-gray-400 text-sm">Observações:</span>
                          <p className="text-gray-300 text-sm mt-1">{conferencia.observacoes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowConferenceDetailsModal(false)}
                className="btn-secondary"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes das Perdas */}
      {showLossDetailsModal && selectedProductForLossDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 w-[600px] max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Detalhes das Perdas</h2>
              <button
                onClick={() => setShowLossDetailsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-300 mb-2">Produto:</p>
              <p className="text-white font-medium">{selectedProductForLossDetails.descricao}</p>
              <div className="text-sm text-gray-400 space-y-1">
                <p>Total perdido: <span className="text-red-400 font-medium">{selectedProductForLossDetails.total_perdas}</span></p>
                <p>Última perda: <span className="text-blue-400">{selectedProductForLossDetails.ultima_perda ? new Date(selectedProductForLossDetails.ultima_perda).toLocaleString('pt-BR') : '-'}</span></p>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-medium text-white mb-3">Histórico de Perdas e Motivos</h3>
              
              {lossDetails.length === 0 ? (
                <div className="text-center py-8">
                  <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">Nenhuma perda encontrada</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lossDetails.map((perda: any) => (
                    <div key={perda.id} className="bg-red-900/20 border border-red-600/30 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-red-400" />
                          <span className="text-red-400 font-medium">
                            {perda.usuario_nome || 'Sistema'}
                          </span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {new Date(perda.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-400">Quantidade:</span>
                          <span className="text-red-400 font-medium ml-2">{perda.quantidade}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Valor Perdido:</span>
                          <span className="text-white font-medium ml-2">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(perda.valor_total)}
                          </span>
                        </div>
                      </div>
                      
                      {perda.observacoes && (
                        <div className="bg-gray-800 rounded p-3 border-l-4 border-red-500">
                          <span className="text-red-400 text-sm font-medium">Motivo da Perda:</span>
                          <p className="text-gray-300 text-sm mt-1 font-medium">{perda.observacoes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowLossDetailsModal(false)}
                className="btn-secondary"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 