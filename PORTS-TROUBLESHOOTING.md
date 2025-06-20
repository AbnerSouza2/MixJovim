# 🔧 Solução de Problemas - Portas em Uso

## Problema Comum: "Port already in use"

Quando você vê a mensagem `Error: listen EADDRINUSE: address already in use :::5001`, significa que algum processo ainda está usando a porta 5001.

## 🚀 Soluções Rápidas

### 1. **Comando Automático (RECOMENDADO)**
```bash
npm run dev:clean
```
Este comando:
- ✅ Finaliza TODOS os processos Node.js
- ✅ Inicia o servidor limpo
- ✅ Funciona na maioria dos casos

### 2. **Limpeza Forçada (Para casos persistentes)**
```bash
npm run dev:force
```
Este comando:
- ✅ Mata processos Node.js
- ✅ Libera portas específicas (3000, 3001, 5001)
- ✅ Aguarda 2 segundos para estabilizar
- ✅ Inicia o servidor

### 3. **Arquivo Batch (Mais visual)**
Clique duplo no arquivo: `kill-ports.bat`
- ✅ Interface visual com progresso
- ✅ Mostra exatamente o que está fazendo
- ✅ Pausa no final para você ver o resultado

### 4. **Verificar Portas Manualmente**
```bash
npm run check:ports
```
Mostra quais portas estão sendo usadas.

### 5. **Reiniciar com Delay**
```bash
npm run restart
```
Mata processos, aguarda 3 segundos e reinicia.

## 🔍 Comandos de Diagnóstico

### Verificar o que está usando a porta 5001:
```bash
netstat -ano | findstr :5001
```

### Matar processo específico por PID:
```bash
taskkill /F /PID [NÚMERO_DO_PID]
```

### Listar todos os processos Node.js:
```bash
tasklist | findstr node.exe
```

## 🛠️ Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia normalmente |
| `npm run dev:clean` | Mata Node.js e inicia |
| `npm run dev:force` | Limpeza completa + inicia |
| `npm run kill:node` | Só mata processos Node.js |
| `npm run kill:ports` | Só libera portas específicas |
| `npm run check:ports` | Verifica portas em uso |
| `npm run restart` | Reinicia com delay |

## 🔄 Fluxo Recomendado

1. **Primeiro tente**: `npm run dev:clean`
2. **Se não funcionar**: `npm run dev:force`
3. **Para casos extremos**: Execute `kill-ports.bat`
4. **Se ainda persistir**: Reinicie o computador

## 💡 Dicas Preventivas

### Para evitar o problema:
- ✅ Sempre use `Ctrl+C` para parar o servidor
- ✅ Feche o terminal corretamente
- ✅ Use `npm run dev:clean` quando em dúvida
- ❌ Evite fechar o terminal bruscamente

### Se estiver desenvolvendo:
- Use `npm run restart` entre mudanças grandes
- Mantenha apenas uma instância do servidor rodando
- Verifique se não há outros projetos Node.js rodando

## 🆘 Solução de Emergência

Se NADA funcionar:

1. **Abra o Gerenciador de Tarefas** (`Ctrl+Shift+Esc`)
2. **Vá na aba "Detalhes"**
3. **Procure por "node.exe"**
4. **Selecione todos** e clique em **"Finalizar tarefa"**
5. **Execute**: `npm run dev`

## 📱 Portas Utilizadas

- **Frontend**: 3000, 3001, 3002... (Vite encontra automaticamente)
- **Backend**: 5001 (fixo)
- **MySQL**: 3306 (padrão)

---

💡 **Dica**: Salve este arquivo nos favoritos para consulta rápida! 