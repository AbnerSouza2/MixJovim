import rateLimit from 'express-rate-limit'
import { Request, Response, NextFunction } from 'express'
import { validationResult, body, param, query } from 'express-validator'
import xss from 'xss'

// Rate Limiting - Proteção contra ataques de força bruta
export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por janela
  message: {
    error: 'Muitas tentativas. Tente novamente em 15 minutos.',
    type: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Pular rate limit para health check
    return req.path === '/api/health'
  }
})

// Rate Limiting mais restritivo para login
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas de login por IP
  message: {
    error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    type: 'LOGIN_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Não contar tentativas bem-sucedidas
})

// Rate Limiting para criação de usuários (mais permissivo)
export const userCreationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // máximo 50 criações de usuário por IP por 15 minutos
  message: {
    error: 'Muitas criações de usuário. Tente novamente em 15 minutos.',
    type: 'USER_CREATION_RATE_LIMIT_EXCEEDED'
  }
})

// Validação e sanitização de entrada
export function validateAndSanitize(validations: any[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Executar validações
    await Promise.all(validations.map(validation => validation.run(req)))
    
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Dados de entrada inválidos',
        details: errors.array().map((err: any) => ({
          field: err.path,
          message: err.msg,
          value: err.value
        }))
      })
    }

    // Sanitizar dados de entrada contra XSS
    sanitizeRequest(req)
    next()
  }
}

// Sanitização XSS
function sanitizeRequest(req: Request) {
  function sanitizeObject(obj: any): any {
    if (typeof obj === 'string') {
      return xss(obj, {
        whiteList: {}, // Não permitir nenhuma tag HTML
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script']
      })
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject)
    }
    
    if (obj !== null && typeof obj === 'object') {
      const sanitized: any = {}
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          sanitized[key] = sanitizeObject(obj[key])
        }
      }
      return sanitized
    }
    
    return obj
  }

  if (req.body) {
    req.body = sanitizeObject(req.body)
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query)
  }
  
  if (req.params) {
    req.params = sanitizeObject(req.params)
  }
}

// Validações específicas para diferentes endpoints
export const loginValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9_.-]+$/)
    .withMessage('Username deve ter entre 3-50 caracteres e conter apenas letras, números, _, . e -'),
  body('password')
    .isLength({ min: 3, max: 100 })
    .withMessage('Senha deve ter entre 3-100 caracteres')
]

export const userCreationValidation = [
  body('username')
    .isLength({ min: 1, max: 50 })
    .trim()
    .withMessage('Username é obrigatório'),
  body('password')
    .isLength({ min: 1, max: 100 })
    .withMessage('Senha é obrigatória'),
  body('role')
    .optional()
    .isIn(['admin', 'gerente', 'funcionario'])
    .withMessage('Role inválido')
]

export const productValidation = [
  body('descricao')
    .isLength({ min: 1, max: 255 })
    .trim()
    .withMessage('Descrição é obrigatória e deve ter até 255 caracteres'),
  body('valor_unitario')
    .isFloat({ min: 0 })
    .withMessage('Valor unitário deve ser um número positivo'),
  body('valor_venda')
    .isFloat({ min: 0 })
    .withMessage('Valor de venda deve ser um número positivo'),
  body('categoria')
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Categoria é obrigatória'),
  body('codigo_barras_1')
    .optional()
    .isLength({ max: 50 })
    .matches(/^[0-9]*$/)
    .withMessage('Código de barras deve conter apenas números'),
  body('codigo_barras_2')
    .optional()
    .isLength({ max: 50 })
    .matches(/^[0-9]*$/)
    .withMessage('Código de barras deve conter apenas números')
]

export const saleValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Deve haver pelo menos um item na venda'),
  body('items.*.produto_id')
    .isInt({ min: 1 })
    .withMessage('ID do produto deve ser um número positivo'),
  body('items.*.quantidade')
    .isFloat({ min: 0.01 })
    .withMessage('Quantidade deve ser positiva'),
  body('items.*.valor_unitario')
    .isFloat({ min: 0 })
    .withMessage('Valor unitário deve ser positivo'),
  body('total')
    .isFloat({ min: 0.01 })
    .withMessage('Total deve ser positivo'),
  body('forma_pagamento')
    .isIn(['dinheiro', 'cartao_credito', 'cartao_debito', 'pix', 'transferencia'])
    .withMessage('Forma de pagamento inválida'),
  body('parcelas')
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage('Parcelas deve ser entre 1 e 12')
]

// Validação de parâmetros de ID
export const idValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('ID deve ser um número positivo')
]

// Validação de query parameters para paginação
export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Página deve ser entre 1 e 1000'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit deve ser entre 1 e 100'),
  query('search')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Busca deve ter no máximo 100 caracteres')
]

// Validação de datas
export const dateValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Data inicial deve estar no formato ISO8601'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Data final deve estar no formato ISO8601')
]

// Middleware para log de segurança
export function securityLogger(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.get('User-Agent') || 'Unknown'
  const ip = req.ip || req.connection.remoteAddress || 'Unknown'
  const timestamp = new Date().toISOString()
  
  // Log de tentativas suspeitas
  const suspiciousPatterns = [
    /script/i,
    /union.*select/i,
    /exec.*xp_/i,
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /onload=/i,
    /onerror=/i
  ]
  
  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
    url: req.url
  })
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(requestData))
  
  if (isSuspicious) {
    console.log(`🚨 [SECURITY ALERT] ${timestamp} - Suspicious request detected`)
    console.log(`📍 IP: ${ip}`)
    console.log(`🔗 URL: ${req.method} ${req.originalUrl}`)
    console.log(`🕵️ User-Agent: ${userAgent}`)
    console.log(`📋 Data: ${requestData}`)
  }
  
  next()
}

// Middleware para verificar tamanho do payload
export function payloadSizeLimit(maxSize: number = 1024 * 1024) { // 1MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('content-length') || '0')
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Payload muito grande',
        maxSize: `${maxSize / 1024 / 1024}MB`
      })
    }
    
    next()
  }
}

// Middleware para verificar headers obrigatórios de segurança
export function requireSecurityHeaders(req: Request, res: Response, next: NextFunction) {
  const contentType = req.get('content-type')
  
  // Verificar Content-Type para requests com body
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    if (!contentType) {
      return res.status(400).json({
        error: 'Content-Type é obrigatório'
      })
    }
    
    // Permitir application/json e multipart/form-data (para uploads)
    const isValidContentType = 
      contentType.includes('application/json') || 
      contentType.includes('multipart/form-data')
    
    if (!isValidContentType) {
      return res.status(400).json({
        error: 'Content-Type deve ser application/json ou multipart/form-data'
      })
    }
  }
  
  next()
}

// Middleware para prevenção de timing attacks em comparações sensíveis
export function constantTimeResponse(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now()
  
  const originalSend = res.send
  res.send = function(data) {
    const elapsed = Date.now() - startTime
    const minTime = 100 // Mínimo 100ms de resposta para endpoints sensíveis
    
    if (req.path.includes('/auth/') && elapsed < minTime) {
      setTimeout(() => {
        originalSend.call(this, data)
      }, minTime - elapsed)
    } else {
      originalSend.call(this, data)
    }
    
    return this
  }
  
  next()
} 