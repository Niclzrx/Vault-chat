'use strict';

// Audit log middleware
const auditLog = (event, user, detail, ip) => {
  const timestamp = new Date().toISOString();
  console.log(`[AUDIT] ${timestamp} | ${event} | ${user} | ${detail} | IP: ${ip}`);
};

// Log all requests
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const user = req.session?.userId || req.session?.adminId || 'anonymous';
    const ip = req.ip || req.connection.remoteAddress;
    
    // Log only important events
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      auditLog(`${req.method} ${req.path}`, user, `Status: ${res.statusCode} | Duration: ${duration}ms`, ip);
    }
  });
  
  next();
};

// Log authentication events
const authLogger = (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = function(data) {
    const user = req.session?.userId || req.session?.adminId || 'anonymous';
    const ip = req.ip || req.connection.remoteAddress;
    
    if (req.path.includes('/login') || req.path.includes('/register')) {
      if (data.ok) {
        auditLog('AUTH_SUCCESS', user, req.path.includes('/register') ? 'Registro' : 'Login', ip);
      } else if (data.error) {
        auditLog('AUTH_FAIL', user, data.error, ip);
      }
    }
    
    return originalJson(data);
  };
  
  next();
};

module.exports = { auditLog, requestLogger, authLogger };
