import { getDatabase } from '../database/connection'
import bcrypt from 'bcryptjs'

interface SecurityReport {
  timestamp: string
  status: 'PASS' | 'WARN' | 'FAIL'
  vulnerabilities: Array<{
    type: string
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    description: string
    recommendation: string
  }>
  statistics: {
    totalUsers: number
    adminUsers: number
    weakPasswords: number
    defaultPasswords: number
    inactiveUsers: number
  }
}

export async function performSecurityAudit(): Promise<SecurityReport> {
  const report: SecurityReport = {
    timestamp: new Date().toISOString(),
    status: 'PASS',
    vulnerabilities: [],
    statistics: {
      totalUsers: 0,
      adminUsers: 0,
      weakPasswords: 0,
      defaultPasswords: 0,
      inactiveUsers: 0
    }
  }

  try {
    const db = getDatabase()

    // 1. Verificar usuários e senhas
    const [userRows] = await db.execute(
      'SELECT id, username, password, role, created_at FROM users'
    )
    const users = userRows as any[]

    report.statistics.totalUsers = users.length
    report.statistics.adminUsers = users.filter(u => u.role === 'admin').length

    // 2. Verificar senhas padrão/fracas
    const defaultPasswords = ['admin', 'password', '123456', 'gerente123', 'pdv123']
    
    for (const user of users) {
      for (const defaultPass of defaultPasswords) {
        try {
          const isDefault = await bcrypt.compare(defaultPass, user.password)
          if (isDefault) {
            report.statistics.defaultPasswords++
            report.vulnerabilities.push({
              type: 'DEFAULT_PASSWORD',
              severity: 'CRITICAL',
              description: `Usuário '${user.username}' está usando senha padrão`,
              recommendation: 'Alterar senha imediatamente para uma senha forte'
            })
          }
        } catch (e) {
          // Erro na comparação - continuar
        }
      }
    }

    // 3. Verificar múltiplos admins
    if (report.statistics.adminUsers > 2) {
      report.vulnerabilities.push({
        type: 'EXCESSIVE_ADMINS',
        severity: 'MEDIUM',
        description: `Existem ${report.statistics.adminUsers} usuários admin`,
        recommendation: 'Reduzir o número de administradores para o mínimo necessário'
      })
    }

    // 4. Verificar configurações de ambiente
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('mixjovim_jwt_secret_key_2024')) {
      report.vulnerabilities.push({
        type: 'WEAK_JWT_SECRET',
        severity: 'HIGH',
        description: 'JWT Secret está usando valor padrão ou fraco',
        recommendation: 'Definir JWT_SECRET forte e único em produção'
      })
    }

    // 5. Verificar se está em produção sem HTTPS
    if (process.env.NODE_ENV === 'production') {
      report.vulnerabilities.push({
        type: 'NO_HTTPS',
        severity: 'HIGH',
        description: 'Sistema em produção deve usar HTTPS',
        recommendation: 'Configurar certificado SSL/TLS e forçar HTTPS'
      })
    }

    // 6. Verificar permissões inconsistentes
    for (const user of users) {
      try {
        const permissions = JSON.parse(user.permissions || '{}')
        
        if (user.role === 'funcionario' && permissions.funcionarios) {
          report.vulnerabilities.push({
            type: 'PRIVILEGE_ESCALATION',
            severity: 'HIGH',
            description: `Funcionário '${user.username}' tem permissão para gerenciar funcionários`,
            recommendation: 'Revisar e corrigir permissões de usuários'
          })
        }
      } catch (e) {
        report.vulnerabilities.push({
          type: 'CORRUPTED_PERMISSIONS',
          severity: 'MEDIUM',
          description: `Permissões corrompidas para usuário '${user.username}'`,
          recommendation: 'Executar script de correção de permissões'
        })
      }
    }

    // 7. Verificar estrutura do banco de dados
    const [tableRows] = await db.execute("SHOW TABLES LIKE 'users'")
    if ((tableRows as any[]).length === 0) {
      report.vulnerabilities.push({
        type: 'MISSING_USER_TABLE',
        severity: 'CRITICAL',
        description: 'Tabela de usuários não encontrada',
        recommendation: 'Executar script de inicialização do banco de dados'
      })
    }

    // Determinar status geral
    const criticalVulns = report.vulnerabilities.filter(v => v.severity === 'CRITICAL').length
    const highVulns = report.vulnerabilities.filter(v => v.severity === 'HIGH').length

    if (criticalVulns > 0) {
      report.status = 'FAIL'
    } else if (highVulns > 0) {
      report.status = 'WARN'
    }

  } catch (error: any) {
    report.vulnerabilities.push({
      type: 'AUDIT_ERROR',
      severity: 'HIGH',
      description: `Erro durante auditoria: ${error?.message || 'Erro desconhecido'}`,
      recommendation: 'Verificar conectividade com banco de dados e logs'
    })
    report.status = 'FAIL'
  }

  return report
}

export function printSecurityReport(report: SecurityReport) {
  console.log('\n🔒 ================ RELATÓRIO DE SEGURANÇA ================')
  console.log(`📅 Data: ${report.timestamp}`)
  console.log(`📊 Status: ${getStatusIcon(report.status)} ${report.status}`)
  
  console.log('\n📈 ESTATÍSTICAS:')
  console.log(`👥 Total de usuários: ${report.statistics.totalUsers}`)
  console.log(`🔑 Administradores: ${report.statistics.adminUsers}`)
  console.log(`⚠️  Senhas padrão: ${report.statistics.defaultPasswords}`)
  
  if (report.vulnerabilities.length > 0) {
    console.log('\n🚨 VULNERABILIDADES ENCONTRADAS:')
    
    const groupedVulns = {
      CRITICAL: report.vulnerabilities.filter(v => v.severity === 'CRITICAL'),
      HIGH: report.vulnerabilities.filter(v => v.severity === 'HIGH'),
      MEDIUM: report.vulnerabilities.filter(v => v.severity === 'MEDIUM'),
      LOW: report.vulnerabilities.filter(v => v.severity === 'LOW')
    }

    Object.entries(groupedVulns).forEach(([severity, vulns]) => {
      if (vulns.length > 0) {
        console.log(`\n${getSeverityIcon(severity as any)} ${severity} (${vulns.length}):`)
        vulns.forEach((vuln, index) => {
          console.log(`   ${index + 1}. ${vuln.description}`)
          console.log(`      💡 ${vuln.recommendation}`)
        })
      }
    })
  } else {
    console.log('\n✅ Nenhuma vulnerabilidade crítica encontrada!')
  }

  console.log('\n📋 RECOMENDAÇÕES GERAIS:')
  console.log('   • Mantenha senhas fortes e únicas')
  console.log('   • Revise permissões de usuários regularmente')
  console.log('   • Monitore logs de segurança')
  console.log('   • Mantenha o sistema atualizado')
  console.log('   • Use HTTPS em produção')
  console.log('   • Faça backups regulares')
  
  console.log('\n🔒 ================================================\n')
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'PASS': return '✅'
    case 'WARN': return '⚠️'
    case 'FAIL': return '❌'
    default: return '❓'
  }
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return '🔴'
    case 'HIGH': return '🟠'
    case 'MEDIUM': return '🟡'
    case 'LOW': return '🟢'
    default: return '⚪'
  }
}

// Função para executar auditoria via CLI
export async function runSecurityAudit() {
  console.log('🔍 Iniciando auditoria de segurança...\n')
  
  try {
    const report = await performSecurityAudit()
    printSecurityReport(report)
    
    // Salvar relatório em arquivo
    const fs = require('fs')
    const path = require('path')
    
    const reportsDir = path.join(__dirname, '../../security-reports')
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }
    
    const filename = `security-audit-${new Date().toISOString().split('T')[0]}.json`
    const filepath = path.join(reportsDir, filename)
    
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2))
    console.log(`📁 Relatório salvo em: ${filepath}`)
    
    // Exit code baseado no status
    process.exit(report.status === 'FAIL' ? 1 : 0)
    
  } catch (error: any) {
    console.error('❌ Erro durante auditoria:', error)
    process.exit(1)
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runSecurityAudit()
} 