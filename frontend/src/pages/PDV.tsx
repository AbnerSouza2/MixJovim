import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import toast from 'react-hot-toast'
import { ShoppingCart, X, Search, Package, ArrowLeft, CreditCard, Calendar } from 'lucide-react'

interface Product {
  id: number
  descricao: string
  quantidade: number
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

export default function PDV() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchCode, setSearchCode] = useState('')
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [unitPrice, setUnitPrice] = useState('')
  const [discount, setDiscount] = useState('')
  const [receivedValue, setReceivedValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('dinheiro')
  
  const barcodeRef = useRef<HTMLInputElement>(null)

  // Calcular totais
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
  const discountAmount = discount ? (subtotal * Number(discount)) / 100 : 0
  const total = subtotal - discountAmount
  const change = receivedValue ? Number(receivedValue) - total : 0

  useEffect(() => {
    loadProducts()
    // Focar no campo de código de barras ao carregar
    if (barcodeRef.current) {
      barcodeRef.current.focus()
    }
  }, [])

  useEffect(() => {
    if (selectedProduct) {
      setUnitPrice(selectedProduct.valor_venda.toString())
    }
  }, [selectedProduct])

  const loadProducts = async () => {
    try {
      const response = await api.get('/products/all')
      const productsData = Array.isArray(response.data) ? response.data : []
      setProducts(productsData)
      setAllProducts(productsData)
      console.log('Produtos carregados:', productsData.length)
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
      toast.error('Erro ao carregar produtos')
      // Garantir que seja sempre um array mesmo em caso de erro
      setProducts([])
      setAllProducts([])
    }
  }

  const searchByBarcode = (code: string) => {
    if (!code.trim()) return
    
    // Buscar nos produtos carregados
    const product = allProducts.find(p => 
      p.codigo_barras_1?.toLowerCase().includes(code.toLowerCase()) || 
      p.codigo_barras_2?.toLowerCase().includes(code.toLowerCase()) ||
      p.descricao.toLowerCase().includes(code.toLowerCase())
    )
    
    if (product) {
      selectProduct(product)
      toast.success(`Produto encontrado: ${product.descricao}`)
    } else {
      toast.error('Produto não encontrado')
      setSelectedProduct(null)
    }
  }

  const selectProduct = (product: Product) => {
    setSelectedProduct(product)
    setQuantity(1)
    setUnitPrice(product.valor_venda.toString())
    setSearchCode(product.codigo_barras_1 || product.descricao)
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

  const addToCart = () => {
    if (!selectedProduct) {
      toast.error('Selecione um produto')
      return
    }

    if (quantity <= 0) {
      toast.error('Quantidade deve ser maior que zero')
      return
    }

    if (quantity > selectedProduct.quantidade) {
      toast.error('Quantidade indisponível no estoque')
      return
    }

    const price = unitPrice ? Number(unitPrice) : selectedProduct.valor_venda
    const cartItem: CartItem = {
      produto: selectedProduct,
      quantidade: quantity,
      subtotal: quantity * price
    }

    setCart([...cart, cartItem])
    
    // Limpar seleção
    setSelectedProduct(null)
    setSearchCode('')
    setQuantity(1)
    setUnitPrice('')
    
    // Focar novamente no código de barras
    if (barcodeRef.current) {
      barcodeRef.current.focus()
    }
    
    toast.success('Produto adicionado ao carrinho')
  }

  const removeFromCart = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index)
    setCart(newCart)
    toast.success('Item removido do carrinho')
  }

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
        payment_method: paymentMethod
      }

      console.log('Enviando dados da venda:', saleData)
      await api.post('/sales', saleData)
      
      // Limpar carrinho
      setCart([])
      setDiscount('')
      setReceivedValue('')
      setSelectedProduct(null)
      setSearchCode('')
      setQuantity(1)
      setUnitPrice('')
      setShowPaymentModal(false)
      
      // Recarregar produtos para atualizar estoque
      await loadProducts()
      
      toast.success(`Venda finalizada! Total: R$ ${total.toFixed(2)}`)
      
      // Focar no código de barras
      if (barcodeRef.current) {
        barcodeRef.current.focus()
      }
    } catch (error: any) {
      console.error('Erro ao finalizar venda:', error)
      toast.error(error.response?.data?.message || 'Erro ao finalizar venda')
    } finally {
      setLoading(false)
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
      {/* Header com botão de voltar */}
      <div className="bg-gray-900 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-white hover:text-mixjovim-gold transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Voltar ao Dashboard</span>
            </button>
            <div className="h-6 w-px bg-gray-600"></div>
            <h1 className="text-xl font-bold text-white flex items-center">
              <ShoppingCart className="w-6 h-6 mr-2 text-mixjovim-gold" />
              PDV - Ponto de Venda
            </h1>
          </div>
          <div className="text-sm text-gray-400">
            Pressione ESC para voltar ao dashboard
          </div>
        </div>
      </div>

      {/* Conteúdo principal */}
      <div className="p-4">
        <div className="grid grid-cols-12 gap-4 h-full">
          
          {/* CARRINHO - Esquerda */}
          <div className="col-span-4">
            <div className="bg-gray-900 rounded-lg h-full flex flex-col min-h-[600px] max-h-[600px]">
              {/* Lista de produtos */}
              <div className="p-4 flex-1 overflow-y-auto">
                <h2 className="text-white font-bold mb-4 text-center">CARRINHO</h2>
                <div className="space-y-2">
                  {cart.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-800 rounded mb-2 text-white">
                      <div className="flex-1">
                        <div className="font-medium">{item.produto.descricao}</div>
                        <div className="text-gray-400 text-sm">
                          {item.quantidade}x R$ {(item.subtotal / item.quantidade).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">R$ {item.subtotal.toFixed(2)}</div>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-red-500 hover:text-red-400 ml-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                {cart.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Carrinho vazio</p>
                    <p className="text-sm">Adicione produtos para iniciar a venda</p>
                  </div>
                )}
              </div>
              
              {/* Total e botões - sempre fixo na parte inferior */}
              <div className="p-4 border-t border-gray-700 bg-gray-900 rounded-b-lg">
                <div className="text-center text-3xl font-bold text-blue-400 mb-4">
                  R$ {total.toFixed(2)}
                </div>
                <div className="space-y-2">
                  <button
                    onClick={openPaymentModal}
                    disabled={loading || cart.length === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded font-bold disabled:opacity-50"
                  >
                    FECHAR VENDA (F2)
                  </button>
                  <button
                    onClick={() => setShowProductModal(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-bold"
                  >
                    BUSCAR PRODUTO (F3)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PRODUTO - Centro */}
          <div className="col-span-5 space-y-4">
            {/* Código de barras */}
            <div>
              <input
                ref={barcodeRef}
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyDown={handleBarcodeSearch}
                placeholder="Digite código de barras ou nome do produto"
                className="w-full bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-3 focus:outline-none focus:border-mixjovim-gold text-lg"
              />
            </div>

            {/* Produto selecionado */}
            {selectedProduct && (
              <div className="bg-gray-900 rounded-lg p-4">
                <h3 className="text-white font-bold mb-3">{selectedProduct.descricao}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 text-sm mb-1">Quantidade</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      min="1"
                      max={selectedProduct.quantidade}
                      className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-mixjovim-gold text-center"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      Estoque: {selectedProduct.quantidade}
                    </div>
                  </div>
                  <div>
                    <label className="block text-gray-300 text-sm mb-1">Valor Unitário</label>
                    <input
                      type="number"
                      value={unitPrice}
                      onChange={(e) => setUnitPrice(e.target.value)}
                      step="0.01"
                      min="0"
                      className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-mixjovim-gold text-center"
                    />
                  </div>
                </div>
                
                <button
                  onClick={addToCart}
                  disabled={!selectedProduct || quantity <= 0}
                  className="w-full btn-gold py-3 mt-4 font-bold disabled:opacity-50 disabled:cursor-not-allowed rounded-lg"
                >
                  <ShoppingCart className="w-5 h-5 inline mr-2" />
                  ADICIONAR AO CARRINHO
                </button>
              </div>
            )}

            {!selectedProduct && (
              <div className="bg-gray-900 rounded-lg p-8 text-center">
                <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Digite um código de barras ou use F3 para buscar produtos</p>
              </div>
            )}
          </div>

          {/* RESUMO - Direita */}
          <div className="col-span-3 space-y-4">
            {/* Logo */}
            <div className="bg-red-600 rounded-lg overflow-hidden">
              <img 
                src="/MixJovim.jpg" 
                alt="MixJovim - Atacado e Varejo" 
                className="w-full object-cover"
                style={{ height: '13rem' }}
                onError={(e) => {
                  // Se a imagem não carregar, mostra um placeholder
                  e.currentTarget.style.display = 'none'
                  const placeholder = e.currentTarget.nextSibling as HTMLElement
                  if (placeholder) placeholder.style.display = 'block'
                }}
              />
              <div 
                className="w-full bg-red-700 flex items-center justify-center hidden"
                style={{ display: 'none', height: '13rem' }}
              >
                <span className="text-white font-bold text-xl">MJ</span>
              </div>
            </div>

            {/* Desconto */}
            <div className="bg-gray-900 rounded-lg p-4">
              <label className="block text-white font-bold mb-2">Desconto (%)</label>
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                min="0"
                max="100"
                step="0.1"
                placeholder="0"
                className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-mixjovim-gold text-center text-lg"
              />
            </div>

            {/* Valor recebido */}
            <div className="bg-gray-900 rounded-lg p-4">
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
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-gray-300">
                  <span>Subtotal:</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-red-400">
                    <span>Desconto:</span>
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
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Forma de Pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-mixjovim-gold"
                >
                  <option value="dinheiro">Dinheiro</option>
                  <option value="cartao_credito">Cartão de Crédito</option>
                  <option value="cartao_debito">Cartão de Débito</option>
                  <option value="pix">PIX</option>
                  <option value="transferencia">Transferência Bancária</option>
                </select>
              </div>

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
                        selectProduct(product)
                        setShowProductModal(false)
                        toast.success(`Produto selecionado: ${product.descricao}`)
                      }}
                      className="p-3 bg-gray-800 rounded-lg border border-gray-700 hover:border-mixjovim-gold cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h5 className="font-medium text-white text-sm">{product.descricao}</h5>
                          <p className="text-sm text-gray-400">
                            Estoque: {product.quantidade} unidades
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
                            R$ {product.valor_venda.toFixed(2)}
                          </p>
                          <p className="text-sm text-gray-400">
                            Custo: R$ {product.valor_unitario.toFixed(2)}
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
    </div>
  )
} 