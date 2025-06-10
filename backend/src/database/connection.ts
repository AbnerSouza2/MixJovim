import mysql from 'mysql2/promise'
import bcrypt from 'bcryptjs'

let connection: mysql.Connection | null = null

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mixjovim',
  charset: 'utf8mb4'
}

export async function initializeDatabase(): Promise<mysql.Connection> {
  if (connection) return connection

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

    // Agora conectar ao database específico
    connection = await mysql.createConnection(dbConfig)

    console.log('MySQL connected successfully')

    // Criar tabelas
    await createTables()
    console.log('Tabelas criadas com sucesso')

    // Inserir dados iniciais
    await insertInitialData()
    console.log('Database initialized successfully')

    return connection
  } catch (error) {
    console.error('Erro ao conectar com MySQL:', error)
    throw error
  }
}

async function createTables() {
  if (!connection) throw new Error('Database not initialized')

  // Tabela de usuários
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      role ENUM('admin', 'funcionario') DEFAULT 'funcionario',
      permissions JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

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
      reports: true
    })

    await connection.execute(
      'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
      ['admin', adminPassword, 'admin', adminPermissions]
    )

    // Criar usuário funcionário com permissão apenas para PDV
    const funcionarioPassword = await bcrypt.hash('pdv123', 10)
    const funcionarioPermissions = JSON.stringify({
      pdv: true,
      products: false,
      dashboard: false,
      reports: false
    })

    await connection.execute(
      'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
      ['funcionario', funcionarioPassword, 'funcionario', funcionarioPermissions]
    )

    console.log('✅ Usuários criados:')
    console.log('   - Admin: admin / admin (todas as permissões)')
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

export function getDatabase(): mysql.Connection {
  if (!connection) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return connection
}

export async function closeDatabase() {
  if (connection) {
    await connection.end()
    connection = null
  }
} 