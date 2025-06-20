@echo off
echo ========================================
echo     LIMPEZA DE PORTAS - MIXJOVIM
echo ========================================
echo.

echo [1/4] Verificando portas em uso...
netstat -ano | findstr ":3000 :3001 :5001" && (
    echo.
    echo [2/4] Finalizando processos Node.js...
    taskkill /F /IM node.exe 2>nul && echo ✓ Processos Node.js finalizados || echo ✓ Nenhum processo Node.js ativo
    
    echo.
    echo [3/4] Liberando portas específicas...
    
    REM Porta 3000
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 2^>nul') do (
        taskkill /F /PID %%a 2>nul && echo ✓ Porta 3000 liberada
    )
    
    REM Porta 3001  
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 2^>nul') do (
        taskkill /F /PID %%a 2>nul && echo ✓ Porta 3001 liberada
    )
    
    REM Porta 5001
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5001 2^>nul') do (
        taskkill /F /PID %%a 2>nul && echo ✓ Porta 5001 liberada
    )
    
    echo.
    echo [4/4] Aguardando estabilização...
    timeout /t 2 /nobreak >nul
    
) || (
    echo ✓ Todas as portas já estão livres!
)

echo.
echo ========================================
echo     PORTAS LIBERADAS COM SUCESSO!
echo ========================================
echo.
echo Agora você pode executar: npm run dev
echo.
pause 