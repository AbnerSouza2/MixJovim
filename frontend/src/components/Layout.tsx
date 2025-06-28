import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { userApi } from '../services/api'
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  LogOut, 
  Menu,
  X,
  Users,
  DollarSign,
  FileText,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Camera,
  Upload,
  UserCheck
} from 'lucide-react'
import { Link } from 'react-router-dom'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [reportsOpen, setReportsOpen] = useState(false)
  const [showPhotoOptions, setShowPhotoOptions] = useState(false)
  const [userPhoto, setUserPhoto] = useState<string | null>(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Verificar se o usuário tem permissão para acessar uma funcionalidade
  const hasPermission = (permission: string) => {
    if (!user || !user.permissions) return false
    if (user.role === 'admin') return true // Admin tem acesso total
    
    // Gerente tem acesso automático a funcionários e financeiro
    if (user.role === 'gerente') {
      if (permission === 'funcionarios' || permission === 'financeiro') return true
      return user.permissions[permission as keyof typeof user.permissions]
    }
    
    // Funcionário precisa ter a permissão específica
    return user.permissions[permission as keyof typeof user.permissions]
  }

  // Carregar foto do usuário quando o componente monta
  useEffect(() => {
    if (user?.id) {
      loadUserPhoto()
    }
  }, [user?.id])

  const loadUserPhoto = async () => {
    if (!user?.id) {
      console.log('❌ [LOAD PHOTO] Sem ID do usuário')
      return
    }
    
    console.log(`📸 [LOAD PHOTO] Carregando foto para usuário ${user.id}`)
    
    try {
      const response = await userApi.getPhoto(user.id)
      console.log('📸 [LOAD PHOTO] Resposta recebida:', response.data)
      
      if (response.data && response.data.size > 0) {
        const photoBlob = new Blob([response.data], { type: 'image/jpeg' })
        const photoUrl = URL.createObjectURL(photoBlob)
        setUserPhoto(photoUrl)
        console.log('✅ [LOAD PHOTO] Foto carregada com sucesso')
      } else {
        console.log('⚠️ [LOAD PHOTO] Resposta vazia ou inválida')
        setUserPhoto(null)
      }
    } catch (error: any) {
      console.log('❌ [LOAD PHOTO] Erro ao carregar foto:', error.response?.status, error.response?.data)
      // Se não encontrar foto, mantém null
      setUserPhoto(null)
    }
  }

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user?.id) return

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem.')
      return
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 5MB.')
      return
    }

    setPhotoLoading(true)
    try {
      const formData = new FormData()
      formData.append('photo', file)

      await userApi.uploadPhoto(formData)
      
      // Recarregar a foto
      await loadUserPhoto()
      setShowPhotoOptions(false)
      
      console.log('✅ Foto enviada com sucesso!')
    } catch (error: any) {
      console.error('❌ Erro ao enviar foto:', error)
      alert(error.response?.data?.error || 'Erro ao enviar foto')
    } finally {
      setPhotoLoading(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (!user?.id) return

    setPhotoLoading(true)
    try {
      await userApi.deletePhoto()
      
      // Limpar foto local
      if (userPhoto) {
        URL.revokeObjectURL(userPhoto)
      }
      setUserPhoto(null)
      setShowPhotoOptions(false)
      
      console.log('✅ Foto removida com sucesso!')
    } catch (error: any) {
      console.error('❌ Erro ao remover foto:', error)
      alert(error.response?.data?.error || 'Erro ao remover foto')
    } finally {
      setPhotoLoading(false)
    }
  }

  // Função para abrir câmera
  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user' // Câmera frontal
        } 
      })
      
      // Criar elemento de vídeo temporário
      const video = document.createElement('video')
      video.srcObject = stream
      video.autoplay = true
      
      // Criar canvas para capturar a foto
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      // Criar modal para preview da câmera
      const modal = document.createElement('div')
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
      modal.innerHTML = `
        <div class="bg-gray-800 p-6 rounded-lg max-w-md w-full mx-4">
          <h3 class="text-white text-lg font-semibold mb-4">Tirar Foto</h3>
          <div class="relative mb-4">
            <video id="camera-preview" autoplay class="w-full rounded-lg"></video>
          </div>
          <div class="flex space-x-3">
            <button id="capture-btn" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
              📷 Capturar
            </button>
            <button id="cancel-btn" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors">
              ❌ Cancelar
            </button>
          </div>
        </div>
      `
      
      document.body.appendChild(modal)
      const videoElement = modal.querySelector('#camera-preview') as HTMLVideoElement
      videoElement.srcObject = stream
      
      // Botão capturar
      modal.querySelector('#capture-btn')?.addEventListener('click', async () => {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx?.drawImage(video, 0, 0)
        
        // Converter para blob e fazer upload
        canvas.toBlob(async (blob) => {
          if (blob && user?.id) {
            setPhotoLoading(true)
            try {
              const formData = new FormData()
              formData.append('photo', blob, 'camera-photo.jpg')
              
              await userApi.uploadPhoto(formData)
              
              // Recarregar a foto
              await loadUserPhoto()
              
              console.log('✅ Foto da câmera enviada com sucesso!')
            } catch (error: any) {
              console.error('❌ Erro ao enviar foto da câmera:', error)
              alert(error.response?.data?.error || 'Erro ao enviar foto')
            } finally {
              setPhotoLoading(false)
            }
          }
        }, 'image/jpeg', 0.8)
        
        // Parar stream e fechar modal
        stream.getTracks().forEach(track => track.stop())
        document.body.removeChild(modal)
        setShowPhotoOptions(false)
      })
      
      // Botão cancelar
      modal.querySelector('#cancel-btn')?.addEventListener('click', () => {
        stream.getTracks().forEach(track => track.stop())
        document.body.removeChild(modal)
        setShowPhotoOptions(false)
      })
      
    } catch (error) {
      console.error('Erro ao acessar câmera:', error)
      alert('Não foi possível acessar a câmera. Verifique as permissões do navegador.')
      setShowPhotoOptions(false)
    }
  }

  // Função para abrir galeria
  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Filtrar itens do menu baseado nas permissões
  const getAllMenuItems = () => {
    const allItems = [
      { 
        name: 'Dashboard', 
        icon: LayoutDashboard, 
        path: '/dashboard',
        permission: 'dashboard'
      },
      { 
        name: 'Adicionar Produto', 
        icon: Package, 
        path: '/adicionar-produto',
        permission: 'products'
      },
      { 
        name: 'PDV', 
        icon: ShoppingCart, 
        path: '/pdv',
        permission: 'pdv'
      },
      { 
        name: 'Estoque', 
        icon: ClipboardCheck, 
        path: '/estoque',
        permission: 'products'
      },
      { 
        name: 'Financeiro', 
        icon: DollarSign, 
        path: '/financeiro',
        permission: 'financeiro'
      },
      { 
        name: 'Clientes', 
        icon: UserCheck, 
        path: '/clientes',
        permission: 'pdv'
      },
      { 
        name: 'Funcionários', 
        icon: Users, 
        path: '/funcionarios',
        permission: 'funcionarios'
      },
    ]

    return allItems.filter(item => {
      return hasPermission(item.permission)
    })
  }

  const getReportItems = () => {
    const reportItems = [
      {
        name: 'Relatório de Vendas',
        path: '/relatorios/vendas',
        permission: 'reports'
      },
      {
        name: 'Relatório de Produtos',
        path: '/relatorios/produtos',
        permission: 'reports'
      }
    ]

    return reportItems.filter(item => hasPermission(item.permission))
  }

  const menuItems = getAllMenuItems()
  const reportItems = getReportItems()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isReportPath = location.pathname.startsWith('/relatorios')

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0 lg:flex lg:flex-col
        flex flex-col h-full
      `}>
        {/* Header do Sidebar - Agora com logo da empresa */}
        <div className="flex items-center justify-between h-28 px-6 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center w-full">
            {/* Logo da empresa - ocupando todo o espaço retangular */}
            <div className="w-full h-24 overflow-hidden rounded-lg">
              <img 
                src="/MixJovim.jpg" 
                alt="MixJovim Logo" 
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback caso a imagem não carregue
                  e.currentTarget.style.display = 'none'
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement
                  if (fallback) fallback.style.display = 'flex'
                }}
              />
              {/* Fallback - só aparece se a imagem não carregar */}
              <div 
                className="w-full h-full bg-gradient-to-r from-mixjovim-gold to-yellow-500 rounded-lg flex items-center justify-center"
                style={{ display: 'none' }}
              >
                <span className="text-2xl font-bold text-gray-900">MJ</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white transition-colors ml-2"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Navigation - SEM SCROLL */}
        <div className="flex-1 px-4 py-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`
                  group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                  ${isActive
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }
                `}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon
                  className={`
                    mr-3 flex-shrink-0 h-5 w-5 transition-colors
                    ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}
                  `}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            )
          })}

          {/* Dropdown de Relatórios */}
          {reportItems.length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setReportsOpen(!reportsOpen)}
                className={`
                  group flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                  ${isReportPath
                    ? 'bg-red-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                <FileText className={`
                  mr-3 flex-shrink-0 h-5 w-5 transition-colors
                  ${isReportPath ? 'text-white' : 'text-gray-400 group-hover:text-white'}
                `} />
                <span className="flex-1 text-left">Relatórios</span>
                {reportsOpen ? (
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 flex-shrink-0" />
                )}
              </button>
              
              {reportsOpen && (
                <div className="ml-8 space-y-1">
                  {reportItems.map((item) => {
                    const isActive = location.pathname === item.path
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`
                          group flex items-center px-3 py-1.5 text-sm rounded-lg transition-all duration-200
                          ${isActive
                            ? 'bg-red-600 text-white shadow-lg'
                            : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                          }
                        `}
                        onClick={() => setSidebarOpen(false)}
                      >
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer do Sidebar */}
        <div className="flex-shrink-0 border-t border-gray-800 p-4">
          {/* Permissões compactas - SÓ para funcionários */}
          {user?.role === 'funcionario' && user?.permissions && (
            <div className="mb-3 p-2 bg-gray-800 rounded-md">
              <p className="text-xs text-gray-400 mb-1">Acessos:</p>
              <div className="flex flex-wrap gap-1">
                {Object.entries(user.permissions).map(([key, value]) => (
                  value && (
                    <span key={key} className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-xs font-medium">
                      {key === 'pdv' ? 'PDV' :
                       key === 'products' ? 'Produtos' :
                       key === 'dashboard' ? 'Dashboard' :
                       key === 'reports' ? 'Relatórios' :
                       key === 'estoque' ? 'Estoque' :
                       key === 'funcionarios' ? 'Funcionários' :
                       key === 'financeiro' ? 'Financeiro' : key}
                    </span>
                  )
                ))}
              </div>
            </div>
          )}
          
          {/* Botão Sair com fundo vermelho */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </button>
        </div>
      </div>

      {/* Input para upload de foto (oculto) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Top bar - Agora com usuário no canto direito */}
        <header className="bg-gray-900 border-b border-gray-800 h-16 flex items-center px-4 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-400 hover:text-white mr-4 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          {/* Título da página */}
          <h2 className="text-lg font-semibold text-white truncate flex-1">
            {isReportPath ? 'Relatórios' : menuItems.find(item => item.path === location.pathname)?.name || 'Sistema de Gestão'}
          </h2>
          
          {/* Área do usuário - canto direito */}
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-white">
                Seja bem-vindo, <span className="font-medium">{user?.username}</span>
              </p>
              <p className={`text-xs ${
                user?.role === 'admin' ? 'text-red-400' : 
                user?.role === 'gerente' ? 'text-yellow-400' : 
                'text-blue-400'
              }`}>
                {user?.role === 'admin' ? 'Administrador' : 
                 user?.role === 'gerente' ? 'Gerente' : 
                 'Funcionário'}
              </p>
            </div>
            
            {/* Foto do usuário */}
            <div className="relative">
              <div 
                className="h-10 w-10 rounded-full bg-mixjovim-gold flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity overflow-hidden border-2 border-gray-700"
                onClick={() => setShowPhotoOptions(!showPhotoOptions)}
              >
                {userPhoto ? (
                  <img 
                    src={userPhoto} 
                    alt="Foto do usuário" 
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-900">
                    {user?.username?.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              
              {/* Menu de opções de foto */}
              {showPhotoOptions && (
                <div className="absolute top-12 right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 min-w-[160px]">
                  <button
                    onClick={handleCameraCapture}
                    disabled={photoLoading}
                    className="w-full flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Tirar Foto
                  </button>
                  <button
                    onClick={handleFileUpload}
                    disabled={photoLoading}
                    className="w-full flex items-center px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {photoLoading ? 'Enviando...' : 'Carregar Foto'}
                  </button>
                  {userPhoto && (
                    <button
                      onClick={handleRemovePhoto}
                      disabled={photoLoading}
                      className="w-full flex items-center px-3 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4 mr-2" />
                      {photoLoading ? 'Removendo...' : 'Remover Foto'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-2 sm:p-4 md:p-6 bg-gray-950">
          <div className="max-w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Overlay para fechar menu de foto */}
      {showPhotoOptions && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setShowPhotoOptions(false)}
        />
      )}
    </div>
  )
} 