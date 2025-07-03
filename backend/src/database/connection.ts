import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

let pool: mysql.Pool | null = null
let connection: mysql.Connection | null = null

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'mixjovim_db',
  charset: 'utf8mb4',
  // Configurações do pool para maior robustez
  connectionLimit: 10,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  idleTimeout: 300000,
  // Configurações de retry
  maxReconnects: 3,
  reconnectDelay: 2000,
  timezone: 'America/Sao_Paulo'
}

export async function initializeDatabase(): Promise<mysql.Pool> {
  if (pool) return pool

  try {
    // Primeiro conectar sem especificar o database para criá-lo se não existir
    const tempConnection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      charset: dbConfig.charset
    })

    // Criar database se não existir
    await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await tempConnection.end()

    // Criar pool de conexões
    pool = mysql.createPool(dbConfig)

    // Testar a conexão
    const testConnection = await pool.getConnection()
    await testConnection.ping()
    testConnection.release()

    console.log('MySQL connected successfully')

    // Criar tabelas usando uma conexão temporária para setup inicial
    connection = await mysql.createConnection(dbConfig)
    await createTables()
    console.log('Tabelas criadas com sucesso')

    // Verificar se a coluna photo_path existe, se não, adicioná-la
    try {
      const [columns] = await connection.execute(
        "SHOW COLUMNS FROM users LIKE 'photo_path'"
      ) as any[]

      if (columns.length === 0) {
        console.log('🔄 Adicionando coluna photo_path na tabela users...')
        await connection.execute(
          "ALTER TABLE users ADD COLUMN photo_path VARCHAR(255) DEFAULT NULL"
        )
        console.log('✅ Coluna photo_path adicionada com sucesso')
      }
    } catch (error) {
      console.log('⚠️ Erro ao verificar/adicionar coluna photo_path:', error)
    }

    // Inserir dados iniciais
    await insertInitialData()
    console.log('Database initialized successfully')

    // Fechar conexão de setup e usar apenas o pool
    await connection.end()
    connection = null

    console.log('✅ Database and tables initialized successfully!')

    return pool
  } catch (error) {
    console.error('❌ Could not connect to the database:', error)
    throw error
  }
}

async function createTables() {
  if (!connection) throw new Error('Database not initialized')

  // Verificar e corrigir estrutura da tabela users
  console.log('🔍 Verificando estrutura da tabela users...')
  
  try {
    const [columns] = await connection.execute('DESCRIBE users')
    const columnInfo = columns as any[]
    const roleColumn = columnInfo.find(col => col.Field === 'role')
    
    console.log('📋 Estrutura atual da coluna role:', roleColumn)
    
    if (!roleColumn || !roleColumn.Type.includes('gerente')) {
      console.log('🔧 Corrigindo estrutura da tabela users...')
      await connection.execute(`
        ALTER TABLE users 
        MODIFY COLUMN role ENUM('admin', 'gerente', 'funcionario') DEFAULT 'funcionario'
      `)
      console.log('✅ Estrutura da tabela users corrigida!')
    }
  } catch (error) {
    console.log('⚠️ Erro ao verificar estrutura, criando tabela do zero...')
  }

  // Tabela de usuários
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'gerente', 'funcionario') DEFAULT 'funcionario',
      photo_path VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  // Tabela de produtos
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      descricao VARCHAR(500) NOT NULL,
      quantidade INT DEFAULT 0,
      valor_unitario DECIMAL(10,2) DEFAULT 0,
      valor_venda DECIMAL(10,2) DEFAULT 0,
      categoria VARCHAR(255) NOT NULL,
      codigo_barras_1 VARCHAR(255),
      codigo_barras_2 VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  // Tabela de vendas
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS sales (
      id INT AUTO_INCREMENT PRIMARY KEY,
      total DECIMAL(10,2) NOT NULL,
      discount DECIMAL(10,2) DEFAULT 0,
      payment_method VARCHAR(50) DEFAULT 'dinheiro',
      user_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )
  `)

  // Verificar se a coluna user_id já existe na tabela sales
  try {
    const [salesColumns] = await connection.execute('DESCRIBE sales')
    const salesColumnInfo = salesColumns as any[]
    const userIdColumn = salesColumnInfo.find(col => col.Field === 'user_id')
    
    if (!userIdColumn) {
      console.log('🔧 Adicionando coluna user_id na tabela sales...')
      await connection.execute(`
        ALTER TABLE sales 
        ADD COLUMN user_id INT,
        ADD FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      `)
      console.log('✅ Coluna user_id adicionada na tabela sales!')
    }
  } catch (error) {
    console.log('⚠️ Erro ao verificar/adicionar user_id na tabela sales:', error)
  }

  // Tabela de itens das vendas
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sale_id INT NOT NULL,
      produto_id INT NOT NULL,
      quantidade INT NOT NULL,
      valor_unitario DECIMAL(10,2) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE CASCADE,
      FOREIGN KEY (produto_id) REFERENCES products (id) ON DELETE CASCADE
    )
  `)

  // Tabela de estoque (conferências e perdas)
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS estoque (
      id INT AUTO_INCREMENT PRIMARY KEY,
      produto_id INT NOT NULL,
      tipo ENUM('conferido', 'perda') NOT NULL,
      quantidade INT NOT NULL,
      valor_unitario DECIMAL(10,2) NOT NULL,
      valor_total DECIMAL(10,2) NOT NULL,
      observacoes TEXT,
      usuario_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES products (id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES users (id) ON DELETE SET NULL
    )
  `)

  // Nova tabela para controlar vendas por produto
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS produto_vendas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      produto_id INT NOT NULL,
      quantidade_vendida INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (produto_id) REFERENCES products (id) ON DELETE CASCADE,
      UNIQUE KEY unique_produto (produto_id)
    )
  `)

  // Tabela de clientes
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome_completo VARCHAR(255) NOT NULL,
      cpf VARCHAR(14) NOT NULL UNIQUE,
      whatsapp VARCHAR(20) NOT NULL,
      data_inscricao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ativo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  // Verificar se a coluna cliente_id já existe na tabela sales
  try {
    const [salesColumns] = await connection.execute('DESCRIBE sales')
    const salesColumnInfo = salesColumns as any[]
    const clienteIdColumn = salesColumnInfo.find(col => col.Field === 'cliente_id')
    
    if (!clienteIdColumn) {
      console.log('🔧 Adicionando coluna cliente_id na tabela sales...')
      await connection.execute(`
        ALTER TABLE sales 
        ADD COLUMN cliente_id INT,
        ADD FOREIGN KEY (cliente_id) REFERENCES clientes (id) ON DELETE SET NULL
      `)
      console.log('✅ Coluna cliente_id adicionada na tabela sales!')
    }
  } catch (error) {
    console.log('⚠️ Erro ao verificar/adicionar cliente_id na tabela sales:', error)
  }
}

async function insertInitialData() {
  if (!connection) throw new Error('Database not initialized')

  // Verificar se já existem usuários
  const [userRows] = await connection.execute('SELECT COUNT(*) as count FROM users')
  const userCount = (userRows as any[])[0].count
  
  if (userCount === 0) {
    // Criar usuário admin
    const adminPassword = await bcrypt.hash('admin', 10)
    const adminPermissions = JSON.stringify({
      pdv: true,
      products: true,
      dashboard: true,
      reports: true,
      estoque: true,
      funcionarios: true,
      financeiro: true
    })

    await connection.execute(
      'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
      ['admin', adminPassword, 'admin', adminPermissions]
    )

    // Criar usuário gerente
    const gerentePassword = await bcrypt.hash('gerente123', 10)
    const gerentePermissions = JSON.stringify({
      pdv: true,
      products: true,
      dashboard: true,
      reports: true,
      estoque: true,
      funcionarios: false,
      financeiro: true
    })

    await connection.execute(
      'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
      ['gerente', gerentePassword, 'gerente', gerentePermissions]
    )

    // Criar usuário funcionário com permissão apenas para PDV
    const funcionarioPassword = await bcrypt.hash('pdv123', 10)
    const funcionarioPermissions = JSON.stringify({
      pdv: true,
      products: false,
      dashboard: false,
      reports: false,
      estoque: false,
      funcionarios: false,
      financeiro: false
    })

    await connection.execute(
      'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
      ['funcionario', funcionarioPassword, 'funcionario', funcionarioPermissions]
    )

    console.log('✅ Usuários criados:')
    console.log('   - Admin: admin / admin (todas as permissões)')
    console.log('   - Gerente: gerente / gerente123 (gerência completa)')
    console.log('   - Funcionário: funcionario / pdv123 (apenas PDV)')
  }

  // Verificar se já existem produtos
  const [productRows] = await connection.execute('SELECT COUNT(*) as count FROM products')
  const productCount = (productRows as any[])[0].count
  
  if (productCount === 0) {
    // Produtos temáticos do MixJovim
    const produtos = [
      {
        descricao: 'Açúcar Cristal União 1kg',
        quantidade: 50,
        valor_unitario: 3.50,
        valor_venda: 4.80,
        categoria: 'Alimentos Básicos',
        codigo_barras_1: '7891000100004',
        codigo_barras_2: '78910001'
      },
      {
        descricao: 'Feijão Carioca Camil 1kg',
        quantidade: 30,
        valor_unitario: 6.20,
        valor_venda: 8.50,
        categoria: 'Alimentos Básicos',
        codigo_barras_1: '7896006711506',
        codigo_barras_2: '78960067'
      },
      {
        descricao: 'Arroz Branco Tio João 1kg',
        quantidade: 40,
        valor_unitario: 4.80,
        valor_venda: 6.90,
        categoria: 'Alimentos Básicos',
        codigo_barras_1: '7896274900024',
        codigo_barras_2: '78962749'
      },
      {
        descricao: 'Óleo de Soja Soya 900ml',
        quantidade: 25,
        valor_unitario: 5.30,
        valor_venda: 7.20,
        categoria: 'Óleos e Condimentos',
        codigo_barras_1: '7891175014085',
        codigo_barras_2: '78911750'
      },
      {
        descricao: 'Sabão em Pó OMO 1kg',
        quantidade: 20,
        valor_unitario: 8.90,
        valor_venda: 12.50,
        categoria: 'Limpeza',
        codigo_barras_1: '7891150013636',
        codigo_barras_2: '78911500'
      },
      {
        descricao: 'Leite Condensado Moça 395g',
        quantidade: 35,
        valor_unitario: 4.20,
        valor_venda: 6.80,
        categoria: 'Doces e Sobremesas',
        codigo_barras_1: '7891000100912',
        codigo_barras_2: '78910001'
      },
      {
        descricao: 'Macarrão Espaguete Renata 500g',
        quantidade: 60,
        valor_unitario: 2.80,
        valor_venda: 4.20,
        categoria: 'Massas',
        codigo_barras_1: '7896333301234',
        codigo_barras_2: '78963333'
      },
      {
        descricao: 'Detergente Ypê Neutro 500ml',
        quantidade: 45,
        valor_unitario: 1.90,
        valor_venda: 3.50,
        categoria: 'Limpeza',
        codigo_barras_1: '7896098901014',
        codigo_barras_2: '78960989'
      },
      {
        descricao: 'Café Pilão Tradicional 250g',
        quantidade: 28,
        valor_unitario: 7.50,
        valor_venda: 10.80,
        categoria: 'Bebidas',
        codigo_barras_1: '7896089012721',
        codigo_barras_2: '78960890'
      },
      {
        descricao: 'Biscoito Cream Cracker Bauducco 400g',
        quantidade: 40,
        valor_unitario: 3.80,
        valor_venda: 5.90,
        categoria: 'Biscoitos e Bolachas',
        codigo_barras_1: '7891962058801',
        codigo_barras_2: '78919620'
      }
    ]

    for (const produto of produtos) {
      await connection.execute(
        `INSERT INTO products (descricao, quantidade, valor_unitario, valor_venda, categoria, codigo_barras_1, codigo_barras_2)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          produto.descricao,
          produto.quantidade,
          produto.valor_unitario,
          produto.valor_venda,
          produto.categoria,
          produto.codigo_barras_1,
          produto.codigo_barras_2
        ]
      )
    }

    console.log('✅ Produtos de exemplo criados')
  }
}

export function getDatabase(): mysql.Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return pool
}

export async function closeDatabase() {
  if (pool) {
    await pool.end()
    pool = null
  }
  if (connection) {
    await connection.end()
    connection = null
  }
} 