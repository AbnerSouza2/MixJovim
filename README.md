# MixJovim SaaS - Sistema de Gestão de Estoque

Sistema completo de gestão de estoque com PDV integrado para MixJovim Atacado e Varejo.

## 🚀 Funcionalidades

- **Autenticação completa** com sistema de permissões
- **Dashboard** com gráficos e analytics em tempo real
- **Gestão de Produtos** com import/export Excel
- **PDV (Ponto de Venda)** com código de barras
- **Módulo Financeiro** com relatórios de vendas
- **Sistema de Usuários** com roles e permissões
- **Design responsivo** com tema escuro

## 🔧 Tecnologias

### Frontend
- React 18 + TypeScript
- TailwindCSS (modo escuro)
- React Router Dom
- React Hook Form
- Recharts (gráficos)
- Axios
- React Hot Toast
- Lucide React (ícones)

### Backend
- Node.js + TypeScript
- Express.js
- SQLite3 com sqlite
- JWT (autenticação)
- bcryptjs (hash senhas)
- Multer (upload arquivos)
- XLSX (processamento Excel)

## 📥 Instalação

```bash
# Clonar repositório
git clone <url-do-repositorio>
cd MixJovim

# Instalar dependências
npm install

# Iniciar desenvolvimento
npm run dev
```

## 🔑 Credenciais de Teste

O sistema vem com dois usuários pré-configurados para teste:

### Administrador (Acesso Total)
- **Usuário:** `admin`
- **Senha:** `admin`
- **Permissões:** Todas (Dashboard, Produtos, PDV, Financeiro, Usuários)

### Funcionário PDV (Acesso Limitado)
- **Usuário:** `funcionario`
- **Senha:** `pdv123`
- **Permissões:** Apenas PDV

## 🌐 URLs do Sistema

- **Frontend:** http://localhost:3001/
- **Backend API:** http://localhost:5001/api
- **Health Check:** http://localhost:5001/api/health

## 📋 Estrutura de Permissões

O sistema possui um controle granular de permissões:

- **PDV:** Acesso ao ponto de venda
- **PRODUCTS:** Gestão de produtos (adicionar, editar, deletar)
- **DASHBOARD:** Visualização do painel principal
- **REPORTS:** Acesso aos relatórios financeiros

### Redirecionamento Inteligente

O sistema redireciona automaticamente os usuários para a primeira página disponível baseada em suas permissões:

1. **PDV** (prioridade alta)
2. **Dashboard**
3. **Produtos**
4. **Financeiro**

## 📁 Estrutura do Projeto

```
MixJovim/
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── contexts/       # Contextos React (Auth)
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── services/       # Configurações API
│   │   └── styles/         # Estilos CSS
│   └── package.json
├── backend/                # Node.js backend
│   ├── src/
│   │   ├── database/       # Configuração banco
│   │   ├── middleware/     # Middlewares Express
│   │   ├── routes/         # Rotas da API
│   │   └── index.ts        # Entrada principal
│   └── package.json
├── database.sqlite         # Banco SQLite
└── package.json           # Scripts principais
```

## 🛠️ Scripts Disponíveis

```bash
# Desenvolvimento completo (frontend + backend)
npm run dev

# Apenas frontend
npm run dev:frontend

# Apenas backend
npm run dev:backend

# Build produção
npm run build

# Instalar dependências em ambos
npm run install:all
```

## 🎨 Temas e Design

- **Paleta de cores personalizada MixJovim**
- **Modo escuro por padrão**
- **Design responsivo para mobile/desktop**
- **Componentes estilizados com TailwindCSS**
- **Gradientes dourados característicos da marca**

## 📊 Funcionalidades Específicas

### PDV (Ponto de Venda)
- Busca por código de barras ou nome
- Carrinho de compras em tempo real
- Cálculo automático de totais
- Suporte a desconto
- Múltiplas formas de pagamento
- Modal de finalização simplificado

### Dashboard Analytics
- Vendas do dia/mês
- Gráficos de vendas por período
- Vendas por categoria
- Status do estoque (baixo/normal/alto)
- Cards informativos

### Gestão de Produtos
- CRUD completo
- Import/export Excel
- Código de barras duplo
- Controle de estoque
- Busca avançada
- Paginação

### Módulo Financeiro
- Relatório de vendas por data
- Filtros avançados
- Paginação de resultados
- Modal detalhado de vendas
- Cards de resumo financeiro

## 🔒 Segurança

- **Autenticação JWT**
- **Hash de senhas com bcryptjs**
- **Middlewares de autorização**
- **Controle de permissões granular**
- **Proteção de rotas sensíveis**

## 📝 Desenvolvimento

Para desenvolvimento, o sistema possui:

- **Hot reload** no frontend e backend
- **TypeScript** para tipagem estática
- **ESLint** para qualidade de código
- **Configuração automática** do banco de dados
- **Dados de exemplo** para teste

## 🤝 Contribuição

1. Faça um fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

---

**© 2024 MixJovim - Atacado e Varejo | Sistema de Gestão de Estoque** 