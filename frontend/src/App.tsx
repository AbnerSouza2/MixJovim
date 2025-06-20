import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AddProduct from './pages/AddProduct'
import PDV from './pages/PDV'
import Financeiro from './pages/Financeiro'
import Funcionarios from './pages/Funcionarios'
import Estoque from './pages/Estoque'
import RelatorioVendas from './pages/RelatorioVendas'
import RelatorioProdutos from './pages/RelatorioProdutos'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

function AppRoutes() {
  const { isAuthenticated, getDefaultRoute } = useAuth()

  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to={getDefaultRoute()} /> : <Login />} 
      />
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute requiredPermission="dashboard">
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/adicionar-produto" 
        element={
          <ProtectedRoute requiredPermission="products">
            <Layout>
              <AddProduct />
            </Layout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/pdv" 
        element={
          <ProtectedRoute requiredPermission="pdv">
            <PDV />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/estoque" 
        element={
          <ProtectedRoute requiredPermission="products">
            <Layout>
              <Estoque />
            </Layout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/financeiro" 
        element={
          <ProtectedRoute requiredPermission="reports">
            <Layout>
              <Financeiro />
            </Layout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/funcionarios" 
        element={
          <ProtectedRoute requiredPermission="funcionarios">
            <Layout>
              <Funcionarios />
            </Layout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/relatorios/vendas" 
        element={
          <ProtectedRoute requiredPermission="reports">
            <Layout>
              <RelatorioVendas />
            </Layout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/relatorios/produtos" 
        element={
          <ProtectedRoute requiredPermission="reports">
            <Layout>
              <RelatorioProdutos />
            </Layout>
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/" 
        element={
          isAuthenticated ? 
            <Navigate to={getDefaultRoute()} /> : 
            <Navigate to="/login" />
        } 
      />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-950">
          <AppRoutes />
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App 