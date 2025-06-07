import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'
import path from 'path'
import bcrypt from 'bcryptjs'

let db: Database | null = null

export async function initializeDatabase(): Promise<Database> {
  if (db) return db

  try {
    const dbPath = path.join(__dirname, '../../../database.sqlite')
    
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    })

    console.log('SQLite connected successfully')

    // Criar tabelas
    await createTables()
    console.log('Tabelas criadas com sucesso')

    // Inserir dados iniciais
    await insertInitialData()
    console.log('Database initialized successfully')

    return db
  } catch (error) {
    console.error('Erro ao conectar com SQLite:', error)
    throw error
  }
}

async function createTables() {
  if (!db) throw new Error('Database not initialized')

  // Tabela de usuários
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'funcionario')) DEFAULT 'funcionario',
      permissions TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Tabela de produtos
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      descricao TEXT NOT NULL,
      quantidade INTEGER DEFAULT 0,
      valor_unitario REAL DEFAULT 0,
      valor_venda REAL DEFAULT 0,
      categoria TEXT NOT NULL,
      codigo_barras_1 TEXT,
      codigo_barras_2 TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Tabela de vendas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total REAL NOT NULL,
      discount REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'dinheiro',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Tabela de itens das vendas
  await db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      produto_id INTEGER NOT NULL,
      quantidade INTEGER NOT NULL,
      valor_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales (id),
      FOREIGN KEY (produto_id) REFERENCES products (id)
    )
  `)

  // Verificar se precisa adicionar colunas discount e payment_method na tabela sales
  try {
    const tableInfo = await db.all("PRAGMA table_info(sales)")
    const hasDiscount = tableInfo.some((col: any) => col.name === 'discount')
    const hasPaymentMethod = tableInfo.some((col: any) => col.name === 'payment_method')
    
    if (!hasDiscount) {
      await db.exec('ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0')
    }
    
    if (!hasPaymentMethod) {
      await db.exec('ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT "dinheiro"')
    }
  } catch (error) {
    console.log('Colunas já existem ou erro ao verificar:', error)
  }
}

async function insertInitialData() {
  if (!db) throw new Error('Database not initialized')

  // Verificar se já existem usuários
  const userCount = await db.get('SELECT COUNT(*) as count FROM users')
  
  if (userCount.count === 0) {
    // Criar usuário admin
    const adminPassword = await bcrypt.hash('admin', 10)
    const adminPermissions = JSON.stringify({
      pdv: true,
      products: true,
      dashboard: true,
      reports: true
    })

    await db.run(
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

    await db.run(
      'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
      ['funcionario', funcionarioPassword, 'funcionario', funcionarioPermissions]
    )

    console.log('✅ Usuários criados:')
    console.log('   - Admin: admin / admin (todas as permissões)')
    console.log('   - Funcionário: funcionario / pdv123 (apenas PDV)')
  }

  // Verificar se já existem produtos
  const productCount = await db.get('SELECT COUNT(*) as count FROM products')
  
  if (productCount.count === 0) {
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
      await db.run(
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

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return db
}

export async function closeDatabase() {
  if (db) {
    await db.close()
  }
} 