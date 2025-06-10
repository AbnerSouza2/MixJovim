# Configuração do MySQL para MixJovim

## 📋 Pré-requisitos

1. **MySQL Server** instalado e funcionando
2. **Node.js** com npm

## 🚀 Configuração Rápida

### 1. Instalar MySQL Server

**Windows:**
```bash
# Baixar de: https://dev.mysql.com/downloads/mysql/
# Ou via Chocolatey:
choco install mysql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install mysql-server
sudo mysql_secure_installation
```

**macOS:**
```bash
brew install mysql
brew services start mysql
```

### 2. Configurar Banco de Dados

Entre no MySQL como root:
```bash
mysql -u root -p
```

Crie um usuário e banco para o projeto:
```sql
CREATE DATABASE mixjovim CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'mixjovim_user'@'localhost' IDENTIFIED BY 'sua_senha_aqui';
GRANT ALL PRIVILEGES ON mixjovim.* TO 'mixjovim_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 3. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo:
```bash
cp config.example.env .env
```

Edite o arquivo `.env` com suas configurações:
```env
# Configurações do Banco de Dados MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=mixjovim_user
DB_PASSWORD=sua_senha_aqui
DB_NAME=mixjovim

# JWT Secret
JWT_SECRET=mixjovim_jwt_secret_key_2024

# Configurações do Mercado Livre (opcional)
ML_APP_ID=
ML_CLIENT_SECRET=
ML_ACCESS_TOKEN=
ML_REFRESH_TOKEN=
```

### 4. Instalar Dependências e Executar

```bash
npm install
npm run dev
```

## 🔧 Configurações Avançadas

### Configuração de Performance MySQL

Adicione ao arquivo `my.cnf` ou `my.ini`:
```ini
[mysqld]
innodb_buffer_pool_size = 256M
max_connections = 100
query_cache_size = 64M
```

### Backup do Banco de Dados

```bash
# Criar backup
mysqldump -u mixjovim_user -p mixjovim > backup_mixjovim.sql

# Restaurar backup
mysql -u mixjovim_user -p mixjovim < backup_mixjovim.sql
```

## 🐛 Solução de Problemas

### Erro de Conexão
- Verifique se o MySQL está rodando: `sudo service mysql status`
- Confirme as credenciais no arquivo `.env`
- Teste a conexão: `mysql -u mixjovim_user -p -h localhost`

### Erro de Permissões
```sql
GRANT ALL PRIVILEGES ON mixjovim.* TO 'mixjovim_user'@'%';
FLUSH PRIVILEGES;
```

### Erro de Charset
```sql
ALTER DATABASE mixjovim CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 📊 Estrutura das Tabelas

O sistema criará automaticamente as seguintes tabelas:

- `users` - Usuários do sistema
- `products` - Produtos do estoque
- `sales` - Vendas realizadas
- `sale_items` - Itens das vendas

## 🔄 Migração do SQLite

Se você está migrando do SQLite, as tabelas e dados serão criados automaticamente na primeira execução.

## 🆘 Suporte

Em caso de problemas:
1. Verifique os logs do servidor
2. Confirme as configurações do MySQL
3. Teste a conectividade manual ao banco 