import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'
import { ShoppingCart, X, Search, Package, ArrowLeft, CreditCard, Calendar, Plus, Minus } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

interface Product {
  id: number
  descricao: string
  quantidade_disponivel: number
  estoque_conferido: number
  quantidade_vendida: number
  valor_unitario: number
  valor_venda: number
  categoria: string
  codigo_barras_1?: string
  codigo_barras_2?: string
}

interface CartItem {
  produto: Product
  quantidade: number
  subtotal: number
}

interface Cliente {
  id: number
  nome_completo: string
  cpf: string
  dias_para_vencer: number
}

export default function PDV() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchCode, setSearchCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('dinheiro')
  const [installments, setInstallments] = useState(1)
  const [lastSale, setLastSale] = useState<any>(null)
  
  // Estados para desconto
  const [discountType, setDiscountType] = useState<'percent' | 'value'>('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [receivedValue, setReceivedValue] = useState('')
  
  // Estados para clientes
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
  const [clienteDiscount, setClienteDiscount] = useState(0)
  
  const barcodeRef = useRef<HTMLInputElement>(null)

  // Calcular totais
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  
  // Calcular desconto baseado no tipo
  const manualDiscountAmount = discountValue ? 
    (discountType === 'percent' ? (subtotal * Number(discountValue)) / 100 : Number(discountValue))
    : 0
  
  // Desconto total = desconto manual + desconto do cliente
  const discountAmount = manualDiscountAmount + clienteDiscount
  
  const total = Math.max(0, subtotal - discountAmount)
  const change = receivedValue ? Math.max(0, Number(receivedValue) - total) : 0

  useEffect(() => {
    loadProducts()
    loadClientes()
    // Focar no campo de código de barras ao carregar
    if (barcodeRef.current) {
      barcodeRef.current.focus()
    }
  }, [])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const response = await api.get('/estoque/produtos-disponiveis')
      // Garantir que os valores sejam números
      const productsWithNumbers = response.data.map((product: any) => ({
        ...product,
        valor_unitario: Number(product.valor_unitario) || 0,
        valor_venda: Number(product.valor_venda) || 0,
        quantidade_disponivel: Number(product.quantidade_disponivel) || 0
      }))
      setAllProducts(productsWithNumbers)
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      toast.error('Erro ao carregar produtos do estoque')
    } finally {
      setLoading(false)
    }
  }

  const loadClientes = async () => {
    try {
      const response = await api.get('/clientes/ativos/lista')
      setClientes(response.data || [])
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
      // Não exibir erro para não incomodar o usuário, apenas log
    }
  }

  const searchByBarcode = (code: string) => {
    if (!code.trim()) {
      return
    }

    const product = allProducts.find(p => 
      p.codigo_barras_1?.toLowerCase() === code.toLowerCase() ||
      p.codigo_barras_2?.toLowerCase() === code.toLowerCase() ||
      p.descricao.toLowerCase().includes(code.toLowerCase())
    )

    if (product) {
      addProductToCart(product)
      toast.success(`Produto adicionado: ${product.descricao}`)
    } else {
      toast.error('Produto não encontrado no estoque')
    }
  }

  const addProductToCart = (product: Product, quantity: number = 1) => {
    // Garantir que os valores sejam números
    const productWithNumbers = {
      ...product,
      valor_unitario: Number(product.valor_unitario) || 0,
      valor_venda: Number(product.valor_venda) || 0,
      quantidade_disponivel: Number(product.quantidade_disponivel) || 0
    }

    if (quantity <= 0) {
      toast.error('Quantidade deve ser maior que zero')
      return
    }

    if (quantity > productWithNumbers.quantidade_disponivel) {
      toast.error('Quantidade indisponível no estoque conferido')
      return
    }

    // Verificar se o produto já está no carrinho
    const existingItemIndex = cart.findIndex(item => item.produto.id === productWithNumbers.id)
    
    if (existingItemIndex >= 0) {
      // Se já existe, aumentar a quantidade
      const newCart = [...cart]
      const newQuantity = newCart[existingItemIndex].quantidade + quantity
      
      if (newQuantity > productWithNumbers.quantidade_disponivel) {
        toast.error('Quantidade total excede o estoque conferido disponível')
        return
      }
      
      newCart[existingItemIndex].quantidade = newQuantity
      newCart[existingItemIndex].subtotal = newQuantity * productWithNumbers.valor_venda
      setCart(newCart)
    } else {
      // Se não existe, adicionar novo item
      const cartItem: CartItem = {
        produto: productWithNumbers,
        quantidade: quantity,
        subtotal: quantity * productWithNumbers.valor_venda
      }
      setCart([...cart, cartItem])
    }
    
    // Limpar pesquisa
    setSearchCode('')
    
    // Focar novamente no código de barras
    if (barcodeRef.current) {
      barcodeRef.current.focus()
    }
  }

  const updateCartItemQuantity = (index: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(index)
      return
    }

    const item = cart[index]
    if (newQuantity > item.produto.quantidade_disponivel) {
      toast.error('Quantidade excede o estoque conferido disponível')
      return
    }

    const newCart = [...cart]
    newCart[index].quantidade = newQuantity
    newCart[index].subtotal = newQuantity * item.produto.valor_venda
    setCart(newCart)
  }

  const handleBarcodeSearch = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      searchByBarcode(searchCode)
    }
  }

  const filteredProducts = Array.isArray(allProducts) ? allProducts.filter(product =>
    product.descricao.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.codigo_barras_1?.toLowerCase().includes(productSearch.toLowerCase()) ||
    product.codigo_barras_2?.toLowerCase().includes(productSearch.toLowerCase())
  ) : []

  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index)
    setCart(newCart)
    toast.success('Item removido do carrinho')
  }

  const handleClienteChange = (clienteId: string) => {
    if (clienteId === '0' || clienteId === '') {
      // Nenhum cliente selecionado
      setSelectedCliente(null)
      setClienteDiscount(0)
    } else {
      const cliente = clientes.find(c => c.id === Number(clienteId))
      if (cliente) {
        setSelectedCliente(cliente)
        // Aplicar 10% de desconto do subtotal
        setClienteDiscount(subtotal * 0.1)
        toast.success(`Cliente ${cliente.nome_completo} selecionado! Desconto de 10% aplicado.`)
      }
    }
  }

  // Recalcular desconto do cliente quando o subtotal mudar
  useEffect(() => {
    if (selectedCliente) {
      setClienteDiscount(subtotal * 0.1)
    }
  }, [subtotal, selectedCliente])

  const openPaymentModal = () => {
    if (cart.length === 0) {
      toast.error('Carrinho vazio')
      return
    }
    setShowPaymentModal(true)
  }

  const finalizeSale = async () => {
    setLoading(true)
    
    try {
      const saleData = {
        produtos: cart.map(item => ({
          produto_id: item.produto.id,
          quantidade: item.quantidade,
          valor_unitario: item.subtotal / item.quantidade,
          subtotal: item.subtotal
        })),
        total,
        discount: discountAmount,
        payment_method: paymentMethod === 'cartao_credito' && installments > 1 
          ? `${paymentMethod}_${installments}x` 
          : paymentMethod,
        cliente_id: selectedCliente ? selectedCliente.id : null
      }

      console.log('Enviando dados da venda:', saleData)
      const response = await api.post('/sales', saleData)
      
      // Preparar dados da venda para impressão
      const saleForReceipt = {
        id: response.data.saleId,
        items: cart,
        subtotal,
        discount: discountAmount,
        total,
        payment_method: paymentMethod,
        installments: paymentMethod === 'cartao_credito' ? installments : 1,
        created_at: new Date().toISOString(),
        cliente_nome: selectedCliente ? selectedCliente.nome_completo : null
      }
      
      setLastSale(saleForReceipt)
      
              // Limpar carrinho
        setCart([])
        setDiscountValue('')
        setReceivedValue('')
        setSearchCode('')
        setPaymentMethod('dinheiro')
        setInstallments(1)
        setSelectedCliente(null)
        setClienteDiscount(0)
        setShowPaymentModal(false)
      
      // Recarregar produtos para atualizar estoque
      await loadProducts()
      
      toast.success(`Venda finalizada! Total: R$ ${total.toFixed(2)}`)
      
      // Mostrar modal de impressão
      setShowReceiptModal(true)
      
    } catch (error: any) {
      console.error('Erro ao finalizar venda:', error)
      toast.error(error.response?.data?.message || 'Erro ao finalizar venda')
    } finally {
      setLoading(false)
    }
  }

  const printReceipt = () => {
    if (!lastSale) return

    // Determinar o nome do vendedor baseado no usuário logado
    const vendedorNome = user?.role === 'admin' ? 'MixJovim' : (user?.username || 'Sistema')

    const receiptContent = `
      <div style="font-family: monospace; font-size: 12px; width: 80mm; margin: 0; padding: 10px; box-sizing: border-box; line-height: 1.4;">
        <div style="text-align: center; margin-bottom: 8px;">
          <h2 style="margin: 0; font-size: 22px; font-weight: bold;">MIXJOVIM</h2>
          <div style="margin: 5px 0; font-size: 14px;">
            <div style="font-weight: bold; margin: 5px 0; font-size: 16px;">--- CUPOM NÃO FISCAL ---</div>
            <div>Data: ${new Date(lastSale.created_at).toLocaleDateString('pt-BR')} - ${new Date(lastSale.created_at).toLocaleTimeString('pt-BR')}</div>
            <div>Tel: (19) 99304-2090</div>
            <div>Vendedor: ${vendedorNome}</div>
            ${lastSale.cliente_nome ? `<div>Cliente: ${lastSale.cliente_nome}</div>` : ''}
          </div>
        </div>
        
        <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 6px 0; margin: 8px 0;">
          <div style="text-align: center; font-weight: bold; font-size: 16px;">ITENS DO PEDIDO</div>
        </div>
        
        ${lastSale.items.map((item: CartItem) => `
          <div style="margin-bottom: 6px; font-size: 14px;">
            <div style="font-weight: bold; font-size: 14px; text-align: left;">${item.produto.descricao.toUpperCase()}</div>
            <div style="display: flex; justify-content: space-between;">
              <span>Qtd: ${item.quantidade}</span>
              <span>R$ ${item.subtotal.toFixed(2)}</span>
            </div>
          </div>
        `).join('')}
        
        <div style="border-top: 1px dashed #000; padding: 6px 0; margin: 8px 0; font-size: 14px;">
          <div style="display: flex; justify-content: space-between;">
            <span>Subtotal:</span>
            <span>R$ ${lastSale.subtotal.toFixed(2)}</span>
          </div>
          ${lastSale.discount > 0 ? `
            <div style="display: flex; justify-content: space-between;">
              <span>Desconto:</span>
              <span>- R$ ${lastSale.discount.toFixed(2)}</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 20px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px;">
            <span>TOTAL:</span>
            <span>R$ ${lastSale.total.toFixed(2)}</span>
          </div>
        </div>
        
        <div style="text-align: center; background: #000; color: #fff; padding: 8px; margin: 8px 0; font-size: 16px; border-radius: 6px;">
          <div style="font-weight: bold;">${lastSale.payment_method === 'dinheiro' ? 'DINHEIRO' : 
            lastSale.payment_method === 'cartao_credito' ? `CARTÃO CRÉDITO ${lastSale.installments}X` :
            lastSale.payment_method === 'cartao_debito' ? 'CARTÃO DÉBITO' :
            lastSale.payment_method === 'pix' ? 'PIX' : 'OUTROS'}</div>
          ${lastSale.payment_method === 'cartao_credito' && lastSale.installments > 1 ? 
            `<div style="font-size: 12px;">PARCELA: R$ ${(lastSale.total / lastSale.installments).toFixed(2)}</div>` : ''
          }
        </div>
        
        <div style="text-align: center; margin-top: 10px; font-size: 12px;">
          <div>Obrigado e volte sempre!</div>
        </div>
      </div>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Cupom Não Fiscal - Venda #${lastSale.id}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                margin: 0; 
                padding: 5px; 
                font-family: 'Courier New', monospace;
                background: white;
              }
              @media print {
                * { margin: 0; padding: 0; }
                body { 
                  margin: 0 !important; 
                  padding: 0 !important;
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                @page {
                  margin: 0;
                  padding: 0;
                  size: 80mm auto;
                }
              }
            </style>
          </head>
          <body>
            ${receiptContent}
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 100);
              }
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  const closeReceiptModal = () => {
    setShowReceiptModal(false)
    setLastSale(null)
    
    // Focar no código de barras
    if (barcodeRef.current) {
      barcodeRef.current.focus()
    }
  }

  // Atalhos do teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        openPaymentModal()
      } else if (e.altKey && e.key === 'F1') {
        e.preventDefault()
        if (barcodeRef.current) {
          barcodeRef.current.focus()
        }
      } else if (e.key === 'F3') {
        e.preventDefault()
        setShowProductModal(true)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        navigate('/dashboard')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cart, total, receivedValue, navigate])

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Conteúdo principal */}
      <div className="h-screen">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-4 h-full p-2 lg:p-4">
          
          {/* CARRINHO - Esquerda */}
          <div className="col-span-1 lg:col-span-4 h-64 lg:h-full">
            <div className="bg-gray-900 rounded-lg h-full flex flex-col">
              {/* Lista de produtos */}
              <div className="p-2 lg:p-4 flex-1 overflow-y-auto">
                <h2 className="text-white font-bold mb-2 lg:mb-4 text-center text-sm lg:text-base">CARRINHO</h2>
                <div className="space-y-2">
                  {cart.map((item, index) => (
                    <div key={index} className="p-3 bg-gray-800 rounded mb-2 text-white">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.produto.descricao}</div>
                          <div className="text-gray-400 text-xs">
                            R$ {Number(item.produto.valor_venda || 0).toFixed(2)} cada
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-red-500 hover:text-red-400 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Controles de quantidade */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateCartItemQuantity(index, item.quantidade - 1)}
                            className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center font-bold">{item.quantidade}</span>
                          <button
                            onClick={() => updateCartItemQuantity(index, item.quantidade + 1)}
                            className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded flex items-center justify-center"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="font-bold text-green-400">
                          R$ {Number(item.subtotal || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {cart.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Carrinho vazio</p>
                    <p className="text-sm">Escaneie ou busque produtos</p>
                  </div>
                )}
              </div>
              
              {/* Total e botões - sempre fixo na parte inferior */}
              <div className="p-2 lg:p-4 border-t border-gray-700 bg-gray-900 rounded-b-lg">
                <div className="text-center text-xl lg:text-3xl font-bold text-blue-400 mb-2 lg:mb-4">
                  R$ {Number(total || 0).toFixed(2)}
                </div>
                <div className="space-y-2">
                  <button
                    onClick={openPaymentModal}
                    disabled={loading || cart.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 lg:py-3 px-2 lg:px-4 rounded font-bold disabled:opacity-50 text-sm lg:text-base"
                  >
                    FECHAR VENDA <span className="hidden lg:inline">(F2)</span>
                  </button>
                  <button
                    onClick={() => setShowProductModal(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-2 lg:px-4 rounded font-bold text-sm lg:text-base"
                  >
                    BUSCAR PRODUTO <span className="hidden lg:inline">(F3)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BUSCA DE PRODUTOS - Centro */}
          <div className="col-span-1 lg:col-span-5 space-y-2 lg:space-y-4">
            {/* Código de barras */}
            <div>
              <input
                ref={barcodeRef}
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyDown={handleBarcodeSearch}
                placeholder="Digite código de barras ou nome do produto"
                className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-2 lg:px-4 py-2 lg:py-3 focus:outline-none focus:border-mixjovim-gold text-sm lg:text-lg"
              />
            </div>

            <div className="bg-gray-900 rounded-lg p-4 lg:p-8 text-center">
              <Package className="w-12 h-12 lg:w-16 lg:h-16 text-gray-600 mx-auto mb-2 lg:mb-4" />
              <p className="text-gray-400 text-base lg:text-lg mb-1 lg:mb-2">Escaneie o código de barras</p>
              <p className="text-gray-500 text-xs lg:text-sm">O produto será adicionado automaticamente ao carrinho</p>
              <p className="text-gray-500 text-xs lg:text-sm mt-1 lg:mt-2"><span className="lg:hidden">Ou toque em</span><span className="hidden lg:inline">Ou use F3 para</span> buscar produtos</p>
            </div>
          </div>

          {/* RESUMO E DESCONTO - Direita */}
          <div className="col-span-1 lg:col-span-3 space-y-2 lg:space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-1 px-3 py-2 bg-red-600 hover:bg-red-700 border border-red-500 hover:border-red-400 rounded text-white transition-colors text-xs font-medium"
                title="Voltar ao Dashboard"
              >
                <ArrowLeft className="w-3 h-3" />
                <span className="hidden sm:inline">Voltar</span>
                <span className="sm:hidden">Voltar</span>
              </button>
              <span className="hidden sm:inline">ou pressione ESC</span>
              <span className="sm:hidden">ou ESC</span>
            </div>
            
            {/* Logo */}
            <div className="bg-red-600 rounded-lg overflow-hidden hidden lg:block">
              <img 
                src="/MixJovim.jpg" 
                alt="MixJovim - Atacado e Varejo" 
                className="w-full object-cover"
                style={{ height: '10rem' }}
                onError={(e) => {
                  // Se a imagem não carregar, mostra um placeholder
                  e.currentTarget.style.display = 'none'
                  const placeholder = e.currentTarget.nextSibling as HTMLElement
                  if (placeholder) placeholder.style.display = 'block'
                }}
              />
              <div 
                className="w-full bg-red-700 flex items-center justify-center hidden"
                style={{ display: 'none', height: '10rem' }}
              >
                <span className="text-white font-bold text-xl">MJ</span>
              </div>
            </div>

            {/* Desconto */}
            <div className="bg-gray-900 rounded-lg p-2 lg:p-4">
              <label className="block text-white font-bold mb-2">Desconto</label>
              
              {/* Tipo de desconto */}
              <div className="flex space-x-2 mb-2">
                <button
                  onClick={() => setDiscountType('percent')}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                    discountType === 'percent' 
                      ? 'bg-mixjovim-gold text-gray-900' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  %
                </button>
                <button
                  onClick={() => setDiscountType('value')}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                    discountType === 'value' 
                      ? 'bg-mixjovim-gold text-gray-900' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  R$
                </button>
              </div>
              
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                min="0"
                max={discountType === 'percent' ? "100" : subtotal.toString()}
                step={discountType === 'percent' ? "0.1" : "0.01"}
                placeholder={discountType === 'percent' ? "0" : "0,00"}
                className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-mixjovim-gold text-center text-lg"
              />
              
              {discountAmount > 0 && (
                <div className="mt-2 text-center text-red-400 font-bold">
                  - R$ {discountAmount.toFixed(2)}
                </div>
              )}
            </div>

            {/* Valor recebido */}
            <div className="bg-gray-900 rounded-lg p-2 lg:p-4">
              <label className="block text-white font-bold mb-2">Valor Recebido</label>
              <input
                type="number"
                value={receivedValue}
                onChange={(e) => setReceivedValue(e.target.value)}
                step="0.01"
                min="0"
                placeholder="0,00"
                className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-white text-center text-lg"
              />
              {receivedValue && (
                <div className="mt-2 text-center">
                  <span className="text-gray-400">Troco: </span>
                  <span className="text-green-400 font-bold">R$ {Math.max(0, change).toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Resumo */}
            <div className="bg-gray-900 rounded-lg p-2 lg:p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-gray-300">
                  <span>Subtotal:</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                {manualDiscountAmount > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Desconto Manual:</span>
                    <span>- R$ {manualDiscountAmount.toFixed(2)}</span>
                  </div>
                )}
                {clienteDiscount > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Desconto Cliente (10%):</span>
                    <span>- R$ {clienteDiscount.toFixed(2)}</span>
                  </div>
                )}
                {discountAmount > 0 && manualDiscountAmount > 0 && clienteDiscount > 0 && (
                  <div className="flex justify-between text-yellow-400 border-t border-gray-700 pt-1">
                    <span>Total Descontos:</span>
                    <span>- R$ {discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-700 pt-2">
                  <div className="flex justify-between text-white font-bold text-lg">
                    <span>TOTAL:</span>
                    <span>R$ {total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Pagamento */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Fechar Venda - Total: R$ {total.toFixed(2)}
              </h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Seleção de Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Selecionar Cliente (Desconto de 10%)
                </label>
                <select
                  value={selectedCliente ? selectedCliente.id.toString() : '0'}
                  onChange={(e) => handleClienteChange(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
                >
                  <option value="0">Nenhum cliente</option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nome_completo} - {cliente.cpf}
                      {cliente.dias_para_vencer <= 30 && ` (Expira em ${cliente.dias_para_vencer} dias)`}
                    </option>
                  ))}
                </select>
                {selectedCliente && (
                  <div className="mt-2 p-2 bg-green-800/20 border border-green-600/30 rounded-lg">
                    <p className="text-green-400 text-sm font-medium">
                      ✓ Cliente selecionado: {selectedCliente.nome_completo}
                    </p>
                    <p className="text-green-300 text-xs">
                      Desconto de 10% aplicado: R$ {clienteDiscount.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Forma de Pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    setPaymentMethod(e.target.value)
                    if (e.target.value !== 'cartao_credito') {
                      setInstallments(1)
                    }
                  }}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
                >
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência Bancária</option>
                </select>
              </div>

              {/* Opção de Parcelas para Cartão de Crédito */}
              {paymentMethod === 'cartao_credito' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Número de Parcelas
                  </label>
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                      <option key={num} value={num}>
                        {num}x de R$ {(total / num).toFixed(2)}
                        {num === 1 ? ' (à vista)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  Data/Hora da Venda
                </label>
                <input
                  type="text"
                  value={new Date().toLocaleString('pt-BR')}
                  readOnly
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={finalizeSale}
                  disabled={loading}
                  className="flex-1 btn-gold disabled:opacity-50"
                >
                  {loading ? 'Finalizando...' : 'Fechar Venda'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Busca de Produtos */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="bg-gray-800 p-4 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Buscar Produto
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar por nome ou código de barras..."
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded pl-10 pr-4 py-2 focus:outline-none focus:border-mixjovim-gold"
                    autoFocus
                  />
                </div>
              </div>

              <div className="overflow-y-auto max-h-96">
                <div className="grid grid-cols-1 gap-2">
                  {filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => {
                        addProductToCart(product)
                        setShowProductModal(false)
                        toast.success(`Produto adicionado: ${product.descricao}`)
                      }}
                      className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-mixjovim-gold cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h5 className="font-medium text-white text-sm">{product.descricao}</h5>
                          <p className="text-sm text-gray-400">
                            Vendidos/Estoque: <span className="text-blue-400 font-bold">{product.quantidade_vendida || 0}</span>/<span className="text-green-400 font-bold">{product.estoque_conferido || 0}</span>
                          </p>
                          <p className="text-sm text-gray-400">
                            Disponível: <span className="text-white font-bold">{product.quantidade_disponivel}</span> unidades
                          </p>
                          <p className="text-sm text-gray-400">
                            Categoria: {product.categoria}
                          </p>
                          {(product.codigo_barras_1 || product.codigo_barras_2) && (
                            <p className="text-xs text-gray-500">
                              Códigos: {product.codigo_barras_1} {product.codigo_barras_2}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-mixjovim-gold">
                            R$ {Number(product.valor_venda || 0).toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-400">
                            Custo: R$ {Number(product.valor_unitario || 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {filteredProducts.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum produto encontrado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Impressão */}
      {showReceiptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Imprimir Cupom
              </h3>
              <button
                onClick={closeReceiptModal}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Deseja imprimir o cupom não fiscal?
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={printReceipt}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={closeReceiptModal}
                  className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 