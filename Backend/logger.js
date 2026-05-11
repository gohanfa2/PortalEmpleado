const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, 'logs');

// Crear directorio de logs si no existe
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Obtener fecha actual en formato YYYY-MM-DD
const getDateString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Obtener ruta del archivo de log del día
const getLogFilePath = () => {
  const dateString = getDateString();
  return path.join(logsDir, `${dateString}.log`);
};

// Obtener timestamp formateado
const getTimestamp = () => {
  return new Date().toISOString();
};

// Escribir en el archivo de log
const writeToLog = (level, message, data = null) => {
  const logFile = getLogFilePath();
  const timestamp = getTimestamp();
  
  let logEntry = `[${timestamp}] [${level}] ${message}`;
  
  if (data) {
    if (typeof data === 'object') {
      logEntry += `\n${JSON.stringify(data, null, 2)}`;
    } else {
      logEntry += `\n${data}`;
    }
  }
  
  logEntry += '\n' + '-'.repeat(80) + '\n';

  try {
    fs.appendFileSync(logFile, logEntry, 'utf8');
  } catch (err) {
    console.error('Error escribiendo en archivo de log:', err);
  }
};

// Logger con diferentes niveles
const logger = {
  info: (message, data) => {
    console.log(`[INFO] ${message}`);
    writeToLog('INFO', message, data);
  },

  warn: (message, data) => {
    console.warn(`[WARN] ${message}`);
    writeToLog('WARN', message, data);
  },

  error: (message, error) => {
    const errorData = error instanceof Error 
      ? {
          message: error.message,
          stack: error.stack,
          ...error
        }
      : error;
    
    console.error(`[ERROR] ${message}`);
    writeToLog('ERROR', message, errorData);
  },

  debug: (message, data) => {
    if (process.env.DEBUG_MODE === 'true') {
      console.log(`[DEBUG] ${message}`);
      writeToLog('DEBUG', message, data);
    }
  },

  request: (method, url, status, message = '') => {
    const logMessage = `${method} ${url} - Status: ${status}${message ? ' - ' + message : ''}`;
    writeToLog('REQUEST', logMessage);
  }
};

module.exports = logger;
