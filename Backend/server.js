require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('express-jwt');
const jwtDecode = require('jwt-decode');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const multer = require('multer');
const logger = require('./logger');
const { API_CONEXION } = require ('../frontend/configure');
const { JWT_JSON } = require('../frontend/configure');
const dashboardData = require('./data/dashboard');
const User = require('./data/User');
const InventoryItem = require('./data/InventoryItem');
const { executeQuery, sql } = require('./db/connection');
const { createPayrollRequest } = require('./controllers/payrollRequestController');
const { forgotPassword, resetPassword } = require('./controllers/authController');
const PayrollRequest = require('./data/PayrollRequest');


const {
  createToken,
  hashPassword,
  verifyPassword
} = require('./util');

const app = express();

app.use(cors());

// Configurar multer para cargar archivos ANTES de body parsers
const attachmentsFolder = path.join(__dirname, 'attachments');
if (!fs.existsSync(attachmentsFolder)) {
  fs.mkdirSync(attachmentsFolder, { recursive: true });
}

const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });

// Middleware personalizado para guardar archivos en carpeta de usuario
const saveFileToUserFolder = (req, res, next) => {
  if (!req.file) {
    return next();
  }
  
  try {
    const userEmail = req.user?.email?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'unknown';
    const userFolder = path.join(attachmentsFolder, userEmail);
    
    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = uniqueSuffix + path.extname(req.file.originalname);
    const filepath = path.join(userFolder, filename);
    
    fs.writeFileSync(filepath, req.file.buffer);
    
    req.file.filename = filename;
    req.file.userFolder = userEmail;
    req.file.pathname = filepath;
    
    next();
  } catch (err) {
    logger.error('Error saving file', err);
    res.status(500).json({ message: 'Error al guardar archivo' });
  }
};

// Servir archivos estáticos de attachments
app.use('/api/attachments', express.static(attachmentsFolder));

// Body parsers DESPUÉS de multer
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Middleware de logging para todas las requests
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.request(req.method, req.path, res.statusCode, `${duration}ms`);
  });

  next();
});

logger.info('Servidor iniciado');

app.post('/api/authenticate', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email
    }).lean();

    if (!user) {
      return res.status(403).json({
        message: 'Wrong email or password.'
      });
    }

    const passwordValid = await verifyPassword(
      password,
      user.password
    );

    if (passwordValid) {
      const { password, bio, ...rest } = user;
      const userInfo = Object.assign({}, { ...rest });

      const token = createToken(userInfo);

      const decodedToken = jwtDecode(token);
      const expiresAt = decodedToken.exp;

      res.json({
        message: '¡Autenticación exitosa!',
        token,
        userInfo,
        expiresAt
      });
    } else {
      res.status(403).json({
        message: 'Correo o contraseña erronea'
      });
    }
  } catch (err) {
    logger.error('Error en endpoint de autenticación', err);
    return res
      .status(400)
      .json({ message: 'Something went wrong.' });
  }
});

app.post('/api/signup', async (req, res) => {
  try {
    const { email, firstName, lastName } = req.body;

    const hashedPassword = await hashPassword(
      req.body.password
    );

    const userData = {
      email: email.toLowerCase(),
      firstName,
      lastName,
      password: hashedPassword,
      role: 'user'
    };

    const existingEmail = await User.findOne({
      email: userData.email
    }).lean();

    if (existingEmail) {
      return res
        .status(400)
        .json({ message: 'Email already exists' });
    }

    const newUser = new User(userData);
    const savedUser = await newUser.save();

    if (savedUser) {
      const token = createToken(savedUser);
      const decodedToken = jwtDecode(token);
      const expiresAt = decodedToken.exp;

      const {
        firstName,
        lastName,
        email,
        role
      } = savedUser;

      const userInfo = {
        firstName,
        lastName,
        email,
        role
      };

      return res.json({
        message: 'User created!',
        token,
        userInfo,
        expiresAt
      });
    } else {
      return res.status(400).json({
        message: 'There was a problem creating your account'
      });
    }
  } catch (err) {
    return res.status(400).json({
      message: 'There was a problem creating your account'
    });
  }
});

app.post('/api/auth/forgot-password', forgotPassword);
app.post('/api/auth/reset-password', resetPassword);

const attachUser = (req, res, next) => {
  // Permitir acceso sin decodificar para rutas que manejan archivos sin validación de token aún
  if (req.path.startsWith('/api/attachments')) {
    return next();
  }
  
  const token = req.headers.authorization;
  if (!token) {
    return res
      .status(401)
      .json({ message: 'Authentication invalid' });
  }
  
  try {
    const decodedToken = jwtDecode(token.slice(7));
    if (!decodedToken) {
      return res.status(401).json({
        message: 'There was a problem authorizing the request'
      });
    }
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({
      message: 'There was a problem authorizing the request'
    });
  }
};

app.use(attachUser);

const requireAuth = jwt({
  secret: JWT_JSON,
  audience: 'api.orbit',
  issuer: 'api.orbit'
});

const requireAdmin = (req, res, next) => {
  const { role } = req.user;
  if (role !== 'admin') {
    return res
      .status(401)
      .json({ message: 'Insufficient role' });
  }
  next();
};

const getEmployeeByEmail = async email => {
  const query = `
    SELECT TOP 1
      e.EMP_CODIGO AS EMP_CODIGO,
      e.EMP_NOMBRE AS EMP_NOMBRE,
      e.EMP_APELLIDO AS EMP_APELLIDO,
      C.CAR_DESC AS CAR_DESC,
      D.DEP_NOMBRE AS DEP_NOMBRE,
      CC.CDC_NOMBRE AS CDC_NOMBRE,
      S.SCC_NOMBRE AS SCC_NOMBRE,
      CT.CDT_NOMBRE AS CDT_NOMBRE,
      COT.COT_NOMBRE AS COT_NOMBRE,
      STC.STC_NOMBRE AS STC_NOMBRE,
      GL.GRP_NOMBRE AS GRP_NOMBRE,
      e.EMP_FECINICNT AS EMP_FECINICNT,
      e.EMP_FECFINCNT AS EMP_FECFINCNT,
      e.CTR_CODIGO AS CTR_CODIGO,
      e.EMP_SUELDO AS EMP_SUELDO,
      EPS.EPS_NOMBRE AS EPS_NOMBRE,
      AFP.AFP_NOMBRE AS AFP_NOMBRE,
      ARP.ARP_NOMBRE AS ARP_NOMBRE,
      CCF.CCF_NOMBRE AS CCF_NOMBRE,
      CES.AFP_NOMBRE AS AFP_CESANTIA,
      BAN.BAN_NOMBRE AS BAN_NOMBRE
    FROM BAN_ENTIDAD BAN,
      EPS_ENTIDAD EPS,
      AFP_ENTIDAD AFP,
      AFP_ENTIDAD CES,
      ARP_ENTIDAD ARP,
      CCF_ENTIDAD CCF,
      GRP_GRUPOLAB GL,
      STC_SUBTIPOCOT STC,
      COT_TIPOCOT COT,
      CDT_CENTROTRA CT,
      SCC_SUBCENTRO S,
      CDC_CENTROCOSTO CC,
      DEP_DEPENDENCIA D,
      CAR_CARGO C,
      EMP_EMPLEADO e
    LEFT JOIN HDV_HOJAVIDA h
      ON e.hdv_doc = h.hdv_doc
     AND e.hdv_documento = h.hdv_documento
    WHERE h.HDV_CORREO = @email
      AND C.CAR_CODIGO = e.CAR_CODIGO
      AND D.DEP_CODIGO = e.DEP_CODIGO
      AND CC.CDC_CODIGO = e.CDC_CODIGO
      AND S.SCC_CODIGO = e.SCC_CODIGO
      AND CT.CDT_CODIGO = e.CDT_CODIGO
      AND COT.COT_CODIGO = e.COT_CODIGO
      AND STC.STC_CODIGO = e.STC_CODIGO
      AND GL.GRP_CODIGO = e.GRP_CODIGO
      AND EPS.EPS_CODIGO = e.EPS_CODIGO
      AND AFP.AFP_CODIGO = e.AFP_CODIGO
      AND ARP.ARP_CODIGO = e.ARP_CODIGO
      AND CCF.CCF_CODIGO = e.CCF_CODIGO
      AND BAN.BAN_CODIGO = e.BAN_CODIGO
      AND CES.AFP_CODIGO = e.EMP_CESANTIA;
  `;

  const result = await executeQuery(query, [
    { name: 'email', type: sql.VarChar, value: email }
  ]);

  return result.recordset && result.recordset[0] ? result.recordset[0] : null;
};

/**
 * Resuelve el emp_codigo del usuario en sesión. Es la llave con la que planilla
 * identifica al empleado (planilla.empleado).
 */
const getEmpCodigoByEmail = async email => {
  const result = await executeQuery(
    `SELECT TOP 1 e.EMP_CODIGO
     FROM EMP_EMPLEADO e
     LEFT JOIN HDV_HOJAVIDA h
       ON e.hdv_doc = h.hdv_doc
      AND e.hdv_documento = h.hdv_documento
     WHERE h.HDV_CORREO = @email`,
    [{ name: 'email', type: sql.VarChar, value: email }]
  );

  return result.recordset && result.recordset[0] ? result.recordset[0].EMP_CODIGO : null;
};

/**
 * Resuelve el juego de parámetros de un reporte desde la tabla rep_parametros.
 *
 * Se combinan dos fuentes: los parámetros globales (rep_id = 0) y los del
 * reporte (rep_id del archivo .jasper, último consecutivo registrado). Los
 * globales aportan lo que no es específico de un reporte, por ejemplo JNDI,
 * p_nit y p_nombre_empresa; los del reporte pisan esos valores.
 *
 * Los parámetros tipo 'S' se ignoran porque su valor es dinámico (ej.
 * p_emp_codigo, cuyo valor real es el nombre del parámetro) y se inyectan
 * por sesión.
 */
const getReportParams = async repId => {
  const query = `
    SELECT rp.rep_id, rp.rpa_parametro, rp.rpa_tipo, rp.rpa_descripcion
    FROM rep_parametros rp
    WHERE rp.rep_id = 0 OR rp.rep_id = @repId
  `;

  const result = await executeQuery(query, [
    { name: 'repId', type: sql.Decimal(18, 0), value: repId }
  ]);

  const params = {};
  (result.recordset || []).forEach(row => {
    const name = (row.rpa_parametro || '').trim();
    if (!name) return;
    if ((row.rpa_tipo || '').trim().toUpperCase() === 'S') return;
    const value = row.rpa_descripcion == null ? '' : String(row.rpa_descripcion);
    if (value === '') return;
    params[name] = value;
  });

  return params;
};

/**
 * Obtiene el rep_id vigente de un reporte a partir de rep_reporte, usando el
 * nombre del archivo .jasper. Si no hay coincidencia exacta se recurre al
 * último rep_id registrado.
 */
const getReportId = async reportFileName => {
  const baseName = path.basename(String(reportFileName || '')).toLowerCase();

  const byName = await executeQuery(
    `SELECT TOP 1 rep_id FROM rep_reporte WHERE LOWER(rep_nombre) = @name`,
    [{ name: 'name', type: sql.VarChar, value: baseName }]
  );
  if (byName.recordset && byName.recordset[0]) {
    return byName.recordset[0].rep_id;
  }

  const latest = await executeQuery(`SELECT MAX(rep_id) AS rep_id FROM rep_reporte`);
  return latest.recordset && latest.recordset[0] ? latest.recordset[0].rep_id : null;
};

/**
 * Normaliza un parámetro recibido por query string antes de enviarlo a
 * JasperStarter.
 *
 * JasperStarter reinterpreta el texto que sigue a -P: separa por espacios y
 * respeta comillas dobles. Un valor con comillas dobles rompería ese
 * parseo y, con él, todos los parámetros del reporte, así que se eliminan.
 * También se recorta y se colapsan los espacios para evitar que el valor
 * injecte pares extra (por ejemplo "1 p_emp_codigo=99").
 */
const sanitizeReportParam = value => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/["`]/g, '').replace(/\s+/g, ' ').trim();
};

const getCurriculumByEmail = async email => {
  const query = `
    SELECT TOP 1
      HDV_DOC AS hdv_doc,
      HDV_DOCUMENTO AS hdv_documento,
      HDV_NOMBRE AS hdv_nombre,
      HDV_APELLIDO AS hdv_apellido,
      HDV_CORREO AS hdv_correo,
      hdv_ciudadexp as hdv_ciudadexp,
      hdv_nacionalidad as hdv_nacionalidad,
      hdv_estado as hdv_estado,
      hdv_feccrea as hdv_feccrea,
      hdv_dir as hdv_dir,
      hdv_telefono as hdv_telefono,
      hdv_telefono2 as hdv_telefono2,
      hdv_telefono3 as hdv_telefono3,
      hdv_sexo as hdv_sexo,
      hdv_fnac as hdv_fnac,
      hdv_estciv as hdv_estciv,
      hdv_coment as hdv_coment
    FROM HDV_HOJAVIDA
    WHERE HDV_CORREO = @email;
  `;

  const result = await executeQuery(query, [
    { name: 'email', type: sql.VarChar, value: email }
  ]);

  return result.recordset && result.recordset[0] ? result.recordset[0] : null;
};

app.get('/api/dashboard-data', requireAuth, (req, res) =>
  res.json(dashboardData)
);

app.get('/api/admin/user-profile', requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetEmail = String(req.query.email || '').trim().toLowerCase();

    if (!targetEmail) {
      return res.status(400).json({ message: 'Debe indicar el correo del usuario.' });
    }

    const user = await User.findOne({ email: targetEmail }).lean();
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const [employee, curriculum, inventory] = await Promise.all([
      getEmployeeByEmail(targetEmail),
      getCurriculumByEmail(targetEmail),
      InventoryItem.find({ user: user._id }).lean()
    ]);

    const reportFiles = fs.existsSync(reportsFolder)
      ? fs.readdirSync(reportsFolder).filter(file => file.endsWith('.jasper')).map(file => ({
          id: path.basename(file, '.jasper'),
          label: path.basename(file, '.jasper')
        }))
      : [];

    res.json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio
      },
      employee,
      curriculum,
      inventory,
      reports: reportFiles,
      requestTypes: ['vacaciones', 'permisos', 'incapacidades']
    });
  } catch (err) {
    logger.error('Error al consultar perfil administrativo del usuario', err);
    return res.status(400).json({
      message: 'No se pudo cargar la información solicitada.'
    });
  }
});

app.get('/api/admin/user-payroll-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetEmail = String(req.query.email || '').trim().toLowerCase();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(1000, Math.max(1, parseInt(req.query.limit) || 1000));
    const requestType = req.query.requestType || null;
    const skip = (page - 1) * limit;

    if (!targetEmail) {
      return res.status(400).json({ message: 'Debe indicar el correo del usuario.' });
    }

    const user = await User.findOne({ email: targetEmail }).lean();
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const filter = { email: targetEmail };
    if (requestType) {
      filter.requestType = requestType;
    }

    const [payrollRequests, total] = await Promise.all([
      PayrollRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PayrollRequest.countDocuments(filter)
    ]);

    // Fallback: extraer firstName y lastName de employeeName si no existen
    const enrichedRequests = payrollRequests.map(req => {
      if (!req.firstName && !req.lastName && req.employeeName) {
        const parts = req.employeeName.trim().split(' ');
        if (parts.length >= 2) {
          return {
            ...req,
            firstName: parts[0],
            lastName: parts.slice(1).join(' ')
          };
        } else if (parts.length === 1) {
          return {
            ...req,
            firstName: parts[0],
            lastName: ''
          };
        }
      }
      return req;
    });

    res.json({
      payrollRequests: enrichedRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    logger.error('Error al consultar solicitudes de nómina del usuario', err);
    return res.status(400).json({
      message: 'No se pudo cargar las solicitudes de nómina.'
    });
  }
});

app.get('/api/payroll-requests', requireAuth, async (req, res) => {
  try {
    const userEmail = req.user.email;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const requestType = req.query.requestType || null;
    const skip = (page - 1) * limit;

    const filter = { email: userEmail };
    if (requestType) {
      filter.requestType = requestType;
    }

    const [payrollRequests, total] = await Promise.all([
      PayrollRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PayrollRequest.countDocuments(filter)
    ]);

    // Fallback: extraer firstName y lastName de employeeName si no existen
    const enrichedRequests = payrollRequests.map(req => {
      if (!req.firstName && !req.lastName && req.employeeName) {
        const parts = req.employeeName.trim().split(' ');
        if (parts.length >= 2) {
          return {
            ...req,
            firstName: parts[0],
            lastName: parts.slice(1).join(' ')
          };
        } else if (parts.length === 1) {
          return {
            ...req,
            firstName: parts[0],
            lastName: ''
          };
        }
      }
      return req;
    });

    res.json({
      payrollRequests: enrichedRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    logger.error('Error al consultar solicitudes de nómina del usuario actual', err);
    return res.status(400).json({
      message: 'No se pudo cargar las solicitudes de nómina.'
    });
  }
});

app.post('/api/payroll-requests', requireAuth, createPayrollRequest);

app.get('/api/admin/payroll-requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const requestType = req.query.requestType || null;
    const status = req.query.status || null;
    const startDate = req.query.startDate || null;
    const endDate = req.query.endDate || null;

    const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safeSearch = escapeRegex(search);

    const filter = {};
    if (requestType) filter.requestType = requestType;
    if (status) filter.status = status;

    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { employeeName: { $regex: safeSearch, $options: 'i' } },
        { firstName: { $regex: safeSearch, $options: 'i' } },
        { lastName: { $regex: safeSearch, $options: 'i' } },
        { email: { $regex: safeSearch, $options: 'i' } },
        { requestType: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { status: { $regex: safeSearch, $options: 'i' } }
      ];
    }


    const [payrollRequests, total] = await Promise.all([
      PayrollRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PayrollRequest.countDocuments(filter)
    ]);

    // Fallback: extraer firstName y lastName de employeeName si no existen
    const enrichedRequests = payrollRequests.map(req => {
      if (!req.firstName && !req.lastName && req.employeeName) {
        const parts = req.employeeName.trim().split(' ');
        if (parts.length >= 2) {
          return {
            ...req,
            firstName: parts[0],
            lastName: parts.slice(1).join(' ')
          };
        } else if (parts.length === 1) {
          return {
            ...req,
            firstName: parts[0],
            lastName: ''
          };
        }
      }
      return req;
    });

    res.json({
      payrollRequests: enrichedRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    logger.error('Error al consultar todas las solicitudes de nómina (admin)', err);
    return res.status(400).json({
      message: 'No se pudo cargar las solicitudes de nómina.'
    });
  }
});

app.patch('/api/admin/payroll-requests/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ['pendiente', 'autorizada', 'rechazada', 'enviada'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Estado no válido' });
    }

    const updatedRequest = await PayrollRequest.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).lean();

    if (!updatedRequest) {
      return res.status(404).json({ message: 'Solicitud no encontrada' });
    }

    res.json({
      message: `Solicitud ${status} correctamente`,
      payrollRequest: updatedRequest
    });
  } catch (err) {
    logger.error('Error al actualizar estado de solicitud', err);
    return res.status(400).json({
      message: 'No se pudo actualizar el estado de la solicitud.'
    });
  }
});

app.patch('/api/user-role', async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ['user', 'admin'];

    if (!allowedRoles.includes(role)) {
      return res
        .status(400)
        .json({ message: 'Role not allowed' });
    }
    await User.findOneAndUpdate(
      { _id: req.user.sub },
      { role }
    );
    res.json({
      message:
        'User role updated. You must log in again for the changes to take effect.'
    });
  } catch (err) {
    return res.status(400).json({ error: err });
  }
});

app.get(
  '/api/inventory',
  requireAuth,
  
  async (req, res) => {
    try {
      const user = req.user.sub;
      const inventoryItems = await InventoryItem.find({
        user
      });
      res.json(inventoryItems);
    } catch (err) {
      return res.status(400).json({ error: err });
    }
  }
);

app.post(
  '/api/inventory',
  uploadMemory.single('itemNumber'),
  saveFileToUserFolder,
  requireAuth,
  
  async (req, res) => {
    try {
      logger.info('POST /api/inventory - req.file:', req.file);
      logger.info('POST /api/inventory - req.body:', req.body);
      
      const userId = req.user.sub;
      const { name } = req.body;
      const userEmail = req.user?.email?.replace(/[^a-zA-Z0-9.-]/g, '_') || 'unknown';

      if (!req.file) {
        logger.error('No file received in inventory upload', {
          body: req.body,
          file: req.file,
          headers: req.headers
        });
        return res.status(400).json({
          message: 'No se seleccionó archivo - req.file es undefined'
        });
      }

      const filePath = `/api/attachments/${userEmail}/${req.file.filename}`;

      const input = {
        user: userId,
        name,
        itemNumber: req.file.originalname,
        image: filePath
      };

      const inventoryItem = new InventoryItem(input);
      await inventoryItem.save();
      res.status(201).json({
        message: 'Archivo cargado!',
        inventoryItem
      });
    } catch (err) {
      logger.error('Error al cargar archivo', err);
      return res.status(400).json({
        message: 'Hubo un problema al cargar archivo'
      });
    }
  }
);

app.delete(
  '/api/inventory/:id',
  requireAuth,

  async (req, res) => {
    try {
      const deletedItem = await InventoryItem.findOneAndDelete(
        { _id: req.params.id, user: req.user.sub }
      );
      res.status(201).json({
        message: 'Archivo eliminado!',
        deletedItem
      });
    } catch (err) {
      return res.status(400).json({
        message: 'There was a problem deleting the item.'
      });
    }
  }
);

app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .lean()
      .select('_id firstName lastName email role avatar bio');

    res.json({
      users
    });
  } catch (err) {
    return res.status(400).json({
      message: 'There was a problem getting the users'
    });
  }
});

app.patch('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, role, bio, password } = req.body || {};
    const update = {};

    if (firstName !== undefined) {
      update.firstName = String(firstName).trim();
    }

    if (lastName !== undefined) {
      update.lastName = String(lastName).trim();
    }

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({
          message: 'El correo es obligatorio'
        });
      }

      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: id }
      }).lean();

      if (existingUser) {
        return res.status(400).json({
          message: 'Ya existe un usuario con ese correo electrónico'
        });
      }

      update.email = normalizedEmail;
    }

    if (role !== undefined) {
      const allowedRoles = ['user', 'admin'];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          message: 'Rol no permitido'
        });
      }
      update.role = role;
    }

    if (bio !== undefined) {
      update.bio = bio;
    }

    if (password !== undefined && String(password).trim()) {
      update.password = await hashPassword(String(password).trim());
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        message: 'No se enviaron campos para actualizar'
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      update,
      { new: true }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }

    const { password: _password, ...userWithoutPassword } = updatedUser;

    res.json({
      message: 'Usuario actualizado correctamente',
      user: userWithoutPassword
    });
  } catch (err) {
    logger.error('Error actualizando usuario', err);
    return res.status(400).json({
      message: 'Hubo un problema al actualizar el usuario'
    });
  }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const targetUser = await User.findById(id).lean();

    if (!targetUser) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }

    if (targetUser.role === 'admin' || targetUser._id.toString() === req.user.sub) {
      return res.status(400).json({
        message: 'No se puede eliminar un administrador'
      });
    }

    const deletedUser = await User.findByIdAndDelete(id).lean();

    if (!deletedUser) {
      return res.status(404).json({
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      message: 'Usuario eliminado correctamente',
      userId: id
    });
  } catch (err) {
    logger.error('Error eliminando usuario', err);
    return res.status(400).json({
      message: 'Hubo un problema al eliminar el usuario'
    });
  }
});

app.get('/api/bio', requireAuth, async (req, res) => {
  try {
    const { sub } = req.user;
    const user = await User.findOne({
      _id: sub
    })
      .lean()
      .select('bio');

    res.json({
      bio: user.bio
    });
  } catch (err) {
    return res.status(400).json({
      message: 'There was a problem updating your bio'
    });
  }
});

app.patch('/api/bio', requireAuth, async (req, res) => {
  try {
    const { sub } = req.user;
    const { bio } = req.body;
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: sub
      },
      {
        bio
      },
      {
        new: true
      }
    );

    res.json({
      message: 'Bio updated!',
      bio: updatedUser.bio
    });
  } catch (err) {
    return res.status(400).json({
      message: 'There was a problem updating your bio'
    });
  }
});

const reportsFolder = path.join(__dirname, 'Reports');
const reportsOutputFolder = path.join(reportsFolder, 'output');
// Carpeta con GnosisJndi.jar (el InitialContextFactory para JasperStarter).
const jndiFolder = path.join(__dirname, 'jndi');
const jndiFactoryJar = path.join(jndiFolder, 'GnosisJndi.jar');
if (!fs.existsSync(reportsOutputFolder)) {
  fs.mkdirSync(reportsOutputFolder, { recursive: true });
}

/**
 * Marca de rep_reporte.rep_adicional que declara que el reporte necesita los
 * filtros de planilla. El valor admite varios indicadores separados por coma,
 * por ejemplo "inc_esquema_periodo,inc_hdv_id".
 */
const FLAG_PLANILLA_FILTROS = 'inc_esquema_periodo';

/**
 * Traduce rep_adicional a la lista de filtros que el portal debe mostrar. El
 * frontend decide qué selects pintar a partir de esta lista, así que agregar un
 * filtro nuevo es agregar el $P en el .jasper, el parámetro desde la consulta de
 * reportId y el indicador acá.
 */
const parseReportFilters = repAdicional => {
  const flags = String(repAdicional == null ? '' : repAdicional)
    .toLowerCase()
    .split(',')
    .map(flag => flag.trim());

  return flags.indexOf(FLAG_PLANILLA_FILTROS) !== -1 ? ['esquema', 'periodo'] : [];
};

/**
 * Reportes que el portal ofrece, tomados de rep_reporte y filtrados por los
 * .jasper que existen realmente en Reports/.
 *
 * Antes se listaba el contenido de la carpeta, pero ahí también viven los
 * subreportes (volantepago_deducidos, volantepago_devengados,
 * Infoadicional_subreport) que solo existen para que otro reporte los incruste.
 * rep_reporte es el catálogo del sistema, así que un reporte no aparece a menos
 * que esté registrado ahí.
 *
 * Si el nombre del catálogo no coincide con un archivo de Reports/ se omite y se
 * avisa al log: casi siempre significa que el .jasper se renombró o que la fila
 * quedó con el nombre de otro reporte.
 *
 * Cuando hay varias filas para el mismo archivo (por ejemplo el mismo .jasper
 * registrado dos veces con distinta descripción) gana la de rep_id más alto,
 * que es la última versión registrada.
 */
const listAvailableReports = async () => {
  const reportFiles = fs.readdirSync(reportsFolder).filter(file => file.endsWith('.jasper'));

  const result = await executeQuery(`
    SELECT rep_id, rep_nombre, rep_descripcion, rep_adicional
    FROM rep_reporte
    WHERE rep_id > 0
    ORDER BY rep_id
  `);

  const byFileName = new Map();
  const sinArchivo = [];

  (result.recordset || []).forEach(row => {
    const fileName = path.basename(String(row.rep_nombre || '').trim());
    const id = path.basename(fileName, '.jasper');

    if (!id) return;

    if (!reportFiles.includes(fileName)) {
      sinArchivo.push(`${row.rep_id}:${fileName}`);
      return;
    }

    byFileName.set(fileName.toLowerCase(), {
      id,
      file: fileName,
      label: row.rep_descripcion && row.rep_descripcion.trim() ? row.rep_descripcion.trim() : id,
      filters: parseReportFilters(row.rep_adicional)
    });
  });

  // El catálogo tiene reportes históricos que no están en Reports/, así que el
  // aviso se agrupa para no escribir una línea por registro en cada petición.
  if (sinArchivo.length > 0) {
    const detalle = sinArchivo.slice(0, 10).join(', ');
    /*logger.warn(
      `${sinArchivo.length} registro(s) de rep_reporte no tienen su .jasper en Reports y se omiten: ${detalle}${sinArchivo.length > 10 ? ', ...' : ''}`
    )
    */;
  }

  return Array.from(byFileName.values());
};

/**
 * Filtros declarados para un reporte, o lista vacía si no está en rep_reporte.
 */
const getReportFilters = async reportId => {
  const id = String(reportId || '').toLowerCase();

  try {
    const result = await executeQuery(
      `SELECT TOP 1 rep_adicional
       FROM rep_reporte
       WHERE LOWER(rep_nombre) = @nombre`,
      [{ name: 'nombre', type: sql.VarChar, value: `${id}.jasper` }]
    );

    const row = result.recordset && result.recordset[0];
    return row ? parseReportFilters(row.rep_adicional) : [];
  } catch (err) {
    logger.error(`No se pudieron leer los filtros de ${reportId} desde rep_reporte`, err);
    return [];
  }
};

/**
 * Escribe jndi.properties con la configuracion JDBC y devuelve la carpeta que
 * lo contiene. Esa carpeta se agrega al classpath de JasperStarter para que
 * JNDI registre GnosisJndiFactory y los scripts que hacen lookup obtengan un
 * DataSource real en vez de fallar con NoInitialContextException.
 *
 * El archivo se regenera en cada generación porque las credenciales provienen
 * de .env y así nunca quedan desactualizadas.
 */
const ensureJndiProperties = (jdbcUrl, user, password) => {
  try {
    if (!fs.existsSync(jndiFolder)) {
      fs.mkdirSync(jndiFolder, { recursive: true });
    }
    const driver = 'com.microsoft.sqlserver.jdbc.SQLServerDriver';
    const lines = [
      '# Generado automáticamente por server.js. No editar a mano.',
      'java.naming.factory.initial=com.colsin.gnosis.jndi.GnosisJndiFactory',
      `colsin.jdbc.url=${jdbcUrl}`,
      `colsin.jdbc.user=${user}`,
      `colsin.jdbc.password=${password}`,
      `colsin.jdbc.driver=${driver}`
    ];
    fs.writeFileSync(path.join(jndiFolder, 'jndi.properties'), lines.join('\n') + '\n', 'utf8');
    return jndiFolder;
  } catch (err) {
    logger.warn('No se pudo generar jndi.properties para el factory JNDI de Gnosis', err);
    return null;
  }
};

app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    res.json({
      reports: await listAvailableReports()
    });
  } catch (err) {
    logger.error('Error al listar los reportes disponibles', err);
    res.status(500).json({
      message: 'Error al listar los reportes disponibles.'
    });
  }
});

// Devuelve el PDF más reciente generado en Reports/output
app.get('/api/reports/latest', requireAuth, async (req, res) => {
  try {
    if (!fs.existsSync(reportsOutputFolder)) {
      return res.status(404).json({ message: 'No hay reportes generados.' });
    }

    const files = [];
    const walk = (dir) => {
      fs.readdirSync(dir).forEach(file => {
        const p = path.join(dir, file);
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          walk(p);
        } else if (file.toLowerCase().endsWith('.pdf')) {
          files.push({ path: p, mtime: stat.mtimeMs });
        }
      });
    };

    walk(reportsOutputFolder);

    if (!files.length) {
      return res.status(404).json({ message: 'No hay reportes PDF disponibles.' });
    }

    files.sort((a, b) => b.mtime - a.mtime);
    const latest = files[0].path;

    res.sendFile(latest, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="latest.pdf"`
      }
    }, (err) => {
      if (err) logger.error('Error al enviar último PDF', err);
    });
  } catch (err) {
    logger.error('Error al obtener último reporte', err);
    res.status(500).json({ message: 'Error al obtener último reporte.' });
  }
});

/**
 * Devuelve los esquemas y periodos del empleado en sesión para alimentar los
 * filtros de planilla de los reportes que los declaran en reports.config.json
 * (Volante_pago: p_esquema / p_periodo).
 *
 * Las consultas están acotadas por planilla.empleado a propósito: la tabla
 * tiene ~173.000 filas de 499 columnas con el PK clustered en (empleado,
 * esquema, periodo), así que un DISTINCT sobre la tabla completa obliga a
 * escanear todas las filas y revienta el timeout de 15 s de mssql (se midió
 * más de 120 s). Filtrando por empleado el seek del PK clustered resuelve en
 * milisegundos, y además es lo correcto: el reporte se genera para el empleado
 * de la sesión.
 *
 * Sin esquema devuelve los esquemas del empleado; con esquema, los periodos de
 * ese esquema ordenados del más reciente al más antiguo.
 */
app.get('/api/reports/filtros/planilla', requireAuth, async (req, res) => {
  const esquema = req.query.esquema == null ? '' : String(req.query.esquema).trim();

  try {
    const empCodigo = await getEmpCodigoByEmail(req.user.email);

    if (!empCodigo) {
      logger.warn('No se encontró emp_codigo para el usuario; no hay filtros de planilla', {
        email: req.user.email
      });
      return res.json({ esquemas: [], periodos: [] });
    }

    let periodosResult = { recordset: [] };
    if (esquema) {
      periodosResult = await executeQuery(
        `SELECT DISTINCT periodo
         FROM planilla
         WHERE empleado = @empleado AND esquema = @esquema
         ORDER BY periodo DESC`,
        [
          { name: 'empleado', type: sql.VarChar(20), value: empCodigo },
          { name: 'esquema', type: sql.VarChar, value: esquema }
        ]
      );
    }

    // Los esquemas solo hacen falta cuando aún no se eligió uno; después el
    // frontend ya los tiene y solo necesita la lista de periodos. Por la misma
    // razón los periodos solo se consultan con esquema: sin él serían cientos
    // de filas de todos los esquemas y el selector aún no los puede usar.
    let esquemas = [];
    if (!esquema) {
      const esquemasResult = await executeQuery(
        `SELECT DISTINCT CAST(esquema AS VARCHAR(2)) AS esquema
         FROM planilla
         WHERE empleado = @empleado
         ORDER BY esquema`,
        [{ name: 'empleado', type: sql.VarChar(20), value: empCodigo }]
      );
      esquemas = (esquemasResult.recordset || [])
        .map(row => row.esquema)
        .filter(value => value != null && value !== '');
    }

    res.json({
      esquemas,
      periodos: (periodosResult.recordset || [])
        .map(row => row.periodo)
        .filter(value => value != null && value !== '')
    });
  } catch (err) {
    logger.error('Error al obtener los filtros de planilla', err);
    res.status(500).json({
      message: 'Error al obtener los filtros de planilla.'
    });
  }
});

app.get('/api/reports/:reportId', requireAuth, async (req, res) => {
  try {
    const { reportId } = req.params;
    const jasperPath = path.join(reportsFolder, `${reportId}.jasper`);

    if (!fs.existsSync(jasperPath)) {
      return res.status(404).json({
        message: 'Reporte no encontrado.'
      });
    }

    // Usar una carpeta de salida única por petición para evitar colisiones/locks
    const tempOutputFolder = path.join(reportsOutputFolder, `${reportId}_${Date.now()}`);
    const outputPdf = path.join(tempOutputFolder, `${reportId}.pdf`);
    const jasperStarterBinary = process.env.JASPER_STARTER_PATH || 'jasperstarter';
    const jasperResourceConfig = process.env.JASPER_REPORT_RESOURCE;
    const jasperResourcePaths = [];
    const defaultJarPath = path.join(reportsFolder, 'GnosisObject-1.0-SNAPSHOT.jar');

    if (jasperResourceConfig) {
      const jasperResourcePath = path.resolve(__dirname, jasperResourceConfig);
      if (fs.existsSync(jasperResourcePath)) {
        jasperResourcePaths.push(jasperResourcePath);
      } else {
        logger.warn('Ruta de recurso Jasper no encontrada:', jasperResourcePath);
      }
    } else {
      jasperResourcePaths.push(reportsFolder);
    }

    if (fs.existsSync(defaultJarPath)) {
      jasperResourcePaths.push(defaultJarPath);
    }

    const jasperArgs = ['pr', jasperPath, '-o', tempOutputFolder, '-f', 'pdf'];
    jasperResourcePaths.forEach(resourcePath => jasperArgs.push('-r', resourcePath));

    // Acumular los parámetros del reporte para emitirlos juntos en un único
    // grupo -P (ver emisión más abajo).
    const reportParams = {};
    const setReportParam = (name, value) => {
      if (name === null || name === undefined) return;
      const strValue = String(value);
      if (strValue === '') return;
      reportParams[name] = strValue.replace(/'/g, "''");
    };

    // Si hay credenciales SQL en .env, construir URL JDBC y pasarla a JasperStarter
    try {
      const { SQL_USER, SQL_PASSWORD, SQL_SERVER, SQL_PORT, SQL_DATABASE, SQL_ENCRYPT, SQL_TRUST_SERVER_CERTIFICATE } = process.env;
      if (SQL_USER && SQL_PASSWORD && SQL_SERVER && SQL_DATABASE) {
        // Soportar SQL Server (jdbc:sqlserver://host:port;databaseName=...)
        const port = SQL_PORT || '1433';
        const encrypt = (SQL_ENCRYPT || 'false').toLowerCase();
        const trustCert = (SQL_TRUST_SERVER_CERTIFICATE || 'true').toLowerCase();
        const jdbcUrl = `jdbc:sqlserver://${SQL_SERVER}:${port};databaseName=${SQL_DATABASE};encrypt=${encrypt};trustServerCertificate=${trustCert}`;

        // Añadir driver JAR si existe en Reports
        const sqlDriverJar = path.join(reportsFolder, 'sqljdbc4.jar');
        if (fs.existsSync(sqlDriverJar)) {
          jasperArgs.push('-r', sqlDriverJar);
        }

        // Pasar opciones JDBC a JasperStarter usando tipo 'generic' y --jdbc-dir
        jasperArgs.push('-t', 'generic');
        jasperArgs.push('--db-driver', 'com.microsoft.sqlserver.jdbc.SQLServerDriver');
        jasperArgs.push('--db-url', jdbcUrl);
        // Indicar directorio donde está el JAR JDBC para que JasperStarter lo cargue
        jasperArgs.push('--jdbc-dir', reportsFolder);
        // Usar flags compatibles con -t generic para usuario/contraseña
        jasperArgs.push('-u', SQL_USER);
        jasperArgs.push('-p', SQL_PASSWORD);

        const jndiConfigDir = ensureJndiProperties(jdbcUrl, SQL_USER, SQL_PASSWORD);

        // Los scripts de Gnosis (NumerosALetrasScriptlet.f_acumulado,
        // f_retorna_empresa) resuelven su conexion con
        // new InitialContext().lookup(<nombre JNDI>). JasperStarter corre
        // fuera de un contenedor Java EE, asi que sin un InitialContextFactory
        // registrado ese lookup falla con NoInitialContextException y el script
        // devuelve 0 silenciosamente.
        //
        // GnosisJndiFactory resuelve esa situacion: se registra como
        // java.naming.factory.initial y entrega un DataSource JDBC usando las
        // mismas credenciales de este bloque.
        if (fs.existsSync(jndiFactoryJar)) {
          // JasperStarter solo carga jars del --jdbc-dir (y solohonra el ultimo
          // valor), asi que el factory debe convivir con el driver en Reports.
          fs.copyFileSync(jndiFactoryJar, path.join(reportsFolder, 'GnosisJndi.jar'));
        } else {
          logger.warn(
            `No se encontro GnosisJndi.jar en ${jndiFolder}; los scripts que usan JNDI devolveran 0`,
            { jndiFolder }
          );
        }

        if (jndiConfigDir) {
          // La carpeta debe estar en el classpath para que JNDI encuentre
          // jndi.properties.
          jasperArgs.push('-r', jndiConfigDir);
        }
      }
    } catch (e) {
      logger.warn('No se pudieron añadir parámetros JDBC a JasperStarter', e);
    }

    // Si el reporte es Certificacion, obtener información del empleado en sesión
    // y pasarla como parámetros al reporte Jasper.
    if (reportId.toLowerCase() === 'certificacion') {
      try {
        const query = `
          SELECT TOP 1
            e.EMP_CODIGO AS p_emp_codigo,
            e.EMP_NOMBRE AS p_emp_nombre,
            e.EMP_APELLIDO AS p_emp_apellido
          FROM EMP_EMPLEADO e
          LEFT JOIN HDV_HOJAVIDA h
            ON e.hdv_doc = h.hdv_doc
            AND e.hdv_documento = h.hdv_documento
          WHERE h.HDV_CORREO = @email
        `;

        const result = await executeQuery(query, [
          { name: 'email', type: sql.VarChar, value: req.user.email }
        ]);

        const emp = result.recordset && result.recordset[0];
        if (emp) {
          // Pasar parámetros tanto con prefijo p_ como sin él (algunas plantillas usan distinto nombre)
          setReportParam('p_emp_codigo', emp.p_emp_codigo);
        } else {
          logger.warn('No se encontró información del empleado para el reporte Certificacion');
        }
      } catch (err) {
        logger.error('Error al obtener datos de empleado para reporte', err);
      }
    }

// Si el reporte es ireport_prueba, obtener información del empleado en sesión
    // y pasarla como parámetros al reporte Jasper.
    if (reportId.toLowerCase() === 'ireport_prueba') {
      try {
        const query = `
          SELECT TOP 1
            e.EMP_CODIGO AS p_emp_codigo,
            e.EMP_NOMBRE AS emp_nombre,
            e.EMP_APELLIDO AS emp_apellido
          FROM EMP_EMPLEADO e
          LEFT JOIN HDV_HOJAVIDA h
            ON e.hdv_doc = h.hdv_doc
            AND e.hdv_documento = h.hdv_documento
          WHERE h.HDV_CORREO = @email
        `;

        const result = await executeQuery(query, [
          { name: 'email', type: sql.VarChar, value: req.user.email }
        ]);

        const emp = result.recordset && result.recordset[0];
        if (emp) {
          // Enviar p_emp_codigo sin comillas (JDBC binding espera el valor crudo)
          setReportParam('p_emp_codigo', emp.p_emp_codigo);

          // No enviar emp_nombre/emp_apellido: son fields retornados por la consulta del .jrxml
        } else {
          logger.warn('No se encontró información del empleado para el reporte Certificacion');
        }
      } catch (err) {
        logger.error('Error al obtener datos de empleado para reporte', err);
      }
    }

    // Si el reporte es ingresosRetenciones2025E, obtener emp_codigo desde HDV_HOJAVIDA
    if (reportId.toLowerCase() === 'ingresosretenciones2025e') {
      try {
        // Cargar los parámetros estáticos (JNDI, p_fecha_ini, p_fecha_fin, etc.)
        // desde rep_parametros usando el último rep_id vigente.
        const repId = await getReportId(`${reportId}.jasper`);
        if (repId !== null && repId !== undefined) {
          const dbParams = await getReportParams(repId);
          Object.keys(dbParams).forEach(name => setReportParam(name, dbParams[name]));
      
        } else {
          logger.warn('No se encontró rep_id en rep_reporte; se usarán los valores por defecto del .jasper');
        }

        const query = `
          SELECT TOP 1
            e.EMP_CODIGO AS p_emp_codigo,
            e.hdv_id AS p_hdv_id
          FROM EMP_EMPLEADO e
          LEFT JOIN HDV_HOJAVIDA h
            ON e.hdv_doc = h.hdv_doc
            AND e.hdv_documento = h.hdv_documento
          WHERE h.HDV_CORREO = @email
        `;

        const result = await executeQuery(query, [
          { name: 'email', type: sql.VarChar, value: req.user.email }
        ]);

        const emp = result.recordset && result.recordset[0];
        if (emp) {
          setReportParam('p_emp_codigo', emp.p_emp_codigo);
          // comentareo hdv_id para cuando mecesite validar varios contratos de un mismo empleado, se pueda pasar el hdv_id y que el reporte filtre por ese contrato
         /* if (emp.p_hdv_id || emp.p_hdv_id === 0) {
            setReportParam('p_hdv_id', emp.p_hdv_id);
          }
          */
        } else {
          logger.warn('No se encontró emp_codigo para el usuario; el reporte podría salir vacío');
        }
      } catch (err) {
        logger.error('Error al obtener emp_codigo para ingresosRetenciones2025E', err);
      }
    }



    // Reportes que declaran filtros de planilla en rep_reporte.rep_adicional
    // (inc_esquema_periodo, por ejemplo Volante_pago). El esquema y el periodo
    // llegan como query params, seleccionados por el usuario, y se inyectan
    // como p_esquema / p_periodo, que son los $P del .jasper.
    const reportFilters = await getReportFilters(reportId);

    if (reportFilters.indexOf('esquema') !== -1) {
      try {
        // Cargar los parámetros estáticos (JNDI, p_nombre_empresa, etc.) desde
        // rep_parametros para no perderlos al pasar los filtros.
        const repId = await getReportId(`${reportId}.jasper`);
        if (repId !== null && repId !== undefined) {
          const dbParams = await getReportParams(repId);
          Object.keys(dbParams).forEach(name => setReportParam(name, dbParams[name]));
        } else {
          logger.warn(`No se encontró rep_id en rep_reporte para ${reportId}; se usarán los valores por defecto del .jasper`);
        }

        const esquema = sanitizeReportParam(req.query.esquema);
        const periodo = sanitizeReportParam(req.query.periodo);

        if (!esquema || !periodo) {
          return res.status(400).json({
            message: 'Debe seleccionar esquema y periodo para generar el reporte.'
          });
        }

        // Se asignan después de rep_parametros para que la selección del usuario
        // tenga prioridad sobre cualquier valor guardado en la base.
        setReportParam('p_esquema', esquema);
        setReportParam('p_periodo', periodo);

        // Obtener el emp_codigo del empleado en sesión para que el reporte
        // muestre únicamente su propio volante de pago.
        const query = `
          SELECT TOP 1
            e.EMP_CODIGO AS p_emp_codigo,
            e.hdv_id AS p_hdv_id
          FROM EMP_EMPLEADO e
          LEFT JOIN HDV_HOJAVIDA h
            ON e.hdv_doc = h.hdv_doc
            AND e.hdv_documento = h.hdv_documento
          WHERE h.HDV_CORREO = @email
        `;

        const result = await executeQuery(query, [
          { name: 'email', type: sql.VarChar, value: req.user.email }
        ]);

        const emp = result.recordset && result.recordset[0];
        if (emp) {
          setReportParam('p_emp_codigo', emp.p_emp_codigo);
          // comentareo hdv_id para cuando necesites validar varios contratos de
          // un mismo empleado y el reporte pueda filtrar por ese contrato
         /* if (emp.p_hdv_id || emp.p_hdv_id === 0) {
            setReportParam('p_hdv_id', emp.p_hdv_id);
          }
          */
        } else {
          logger.warn('No se encontró emp_codigo para el usuario; el volante de pago podría salir vacío');
        }
      } catch (err) {
        logger.error('Error al preparar los parámetros de Volante_pago', err);
        return res.status(500).json({
          message: 'Error al preparar los parámetros del reporte.'
        });
      }
    }

    // Emitir todos los parámetros del reporte en una sola bandera -P.
    //
    // JasperStarter reparte por espacios el texto que sigue a -P, así que cada
    // par debe viajar como un argumento propio. Si se unen todos con
    // espacios en un solo argv, se interpreta como un único parámetro llamado
    // "p_fecha_fin" cuyo valor es "31/12/2025 p_fecha_ini=... p_emp_codigo=...":
    // las fechas nunca se asignan y el reporte se genera vacío (PDF de 961 B).
    //
    // Los valores que contienen espacios (p_nombre_empresa) deben ir entre
    // comillas internas para que JasperStarter no los desarme en varios
    // parámetros; sin ellas el proceso falla y no se genera PDF.
    const paramPairs = Object.keys(reportParams).map(name => {
      const value = reportParams[name];
      return /\s/.test(value) ? `${name}="${value}"` : `${name}=${value}`;
    });
    if (paramPairs.length > 0) {
      jasperArgs.push('-P', ...paramPairs);
    }


    // Asegurar que la carpeta de salida existe y es escribible
    try {
      if (!fs.existsSync(reportsOutputFolder)) {
        fs.mkdirSync(reportsOutputFolder, { recursive: true });
      }
      const testPath = path.join(reportsOutputFolder, `.write_test_${Date.now()}`);
      fs.writeFileSync(testPath, 'ok');
      fs.unlinkSync(testPath);
    } catch (permErr) {
      logger.error('No hay permiso de escritura en la carpeta de salida de reportes', permErr);
      throw permErr;
    }

    // JasperStarter no crea la carpeta de destino: si no existe, escribe el PDF
    // en el directorio padre y la búsqueda posterior falla con 500.
    try {
      if (!fs.existsSync(tempOutputFolder)) {
        fs.mkdirSync(tempOutputFolder, { recursive: true });
      }
    } catch (mkdirErr) {
      logger.error('No se pudo crear la carpeta de salida del reporte', mkdirErr);
      throw mkdirErr;
    }

    // Eliminar PDF existente para evitar bloqueos
    try {
      if (fs.existsSync(outputPdf)) fs.unlinkSync(outputPdf);
    } catch (unlinkErr) {
      logger.warn('No se pudo eliminar PDF previo, continuando:', unlinkErr);
    }

    // Ejecutar JasperStarter con cwd en la carpeta de Reports para consistencia
    await new Promise((resolve, reject) => {
      execFile(
        jasperStarterBinary,
        jasperArgs,
        { cwd: reportsFolder },
        (error, stdout, stderr) => {
          if (error) {
            logger.error('Error al ejecutar reporte', { stderr, stdout, error });
            return reject(error);
          }
          resolve();
        }
      );
    });

    // Buscar cualquier PDF generado dentro de la carpeta temporal (JasperStarter suele añadir un sufijo/timestamp)
    let generatedPdfPath = null;
    try {
      if (!fs.existsSync(tempOutputFolder)) {
        return res.status(500).json({ message: 'No se pudo generar el PDF del reporte.' });
      }

      const outFiles = fs.readdirSync(tempOutputFolder).filter(f => f.toLowerCase().endsWith('.pdf'));
      if (!outFiles || outFiles.length === 0) {
        return res.status(500).json({ message: 'No se pudo generar el PDF del reporte.' });
      }

      // Elegir el más reciente por fecha de modificación por si hay varios
      outFiles.sort((a, b) => {
        const aStat = fs.statSync(path.join(tempOutputFolder, a));
        const bStat = fs.statSync(path.join(tempOutputFolder, b));
        return bStat.mtimeMs - aStat.mtimeMs;
      });

      generatedPdfPath = path.join(tempOutputFolder, outFiles[0]);

      // Log información del PDF generado para depuración
      try {
        const stat = fs.statSync(generatedPdfPath);
        logger.info('PDF generado - info', {
          path: generatedPdfPath,
          size: stat.size,
          mtime: stat.mtime
        });
        // Guardar una copia en Reports/output raíz para inspección manual
        try {
          const copyPath = path.join(reportsOutputFolder, `${reportId}_${Date.now()}.pdf`);
          fs.copyFileSync(generatedPdfPath, copyPath);
          
        } catch (copyErr) {
          logger.warn('No se pudo copiar el PDF a la carpeta de salida principal', copyErr);
        }
      } catch (statErr) {
        logger.warn('No se pudo obtener información del PDF generado', statErr);
      }

      res.sendFile(generatedPdfPath, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${reportId}.pdf"`
        }
      }, (sendErr) => {
        // Intentar limpiar la carpeta temporal después de enviar (no bloquear la respuesta)
        try {
          if (generatedPdfPath && fs.existsSync(generatedPdfPath)) fs.unlinkSync(generatedPdfPath);
          // Eliminar la carpeta temporal si está vacía
          const remaining = fs.existsSync(tempOutputFolder) ? fs.readdirSync(tempOutputFolder) : [];
          if (remaining.length === 0 && fs.existsSync(tempOutputFolder)) fs.rmdirSync(tempOutputFolder);
        } catch (cleanupErr) {
          logger.warn('Error al limpiar carpeta temporal de reportes', cleanupErr);
        }

        if (sendErr) logger.error('Error al enviar el PDF al cliente', sendErr);
      });
      return;
    } catch (checkErr) {
      logger.error('Error verificando archivo PDF generado', checkErr);
      return res.status(500).json({ message: 'No se pudo generar el PDF del reporte.' });
    }
  } catch (err) {
    logger.error('Error al generar reporte con JasperStarter', err);
    res.status(500).json({
      message:
        'Error al generar el reporte. Verifica que JasperStarter esté instalado y accesible.'
    });
  }
});

app.get('/api/employee', requireAuth, async (req, res) => {
  try {
    const { email } = req.user;
    const query = `
      SELECT TOP 1
        e.EMP_CODIGO AS EMP_CODIGO,
        e.EMP_NOMBRE AS EMP_NOMBRE,
        e.EMP_APELLIDO AS EMP_APELLIDO,
        C.CAR_DESC AS CAR_DESC,
        D.DEP_NOMBRE AS DEP_NOMBRE,
        CC.CDC_NOMBRE AS CDC_NOMBRE,
        S.SCC_NOMBRE AS SCC_NOMBRE,
        CT.CDT_NOMBRE AS CDT_NOMBRE,
        COT.COT_NOMBRE AS COT_NOMBRE,
        STC.STC_NOMBRE AS STC_NOMBRE,
        GL.GRP_NOMBRE AS GRP_NOMBRE,
        e.EMP_FECINICNT AS EMP_FECINICNT,
        e.EMP_FECFINCNT AS EMP_FECFINCNT,
        e.CTR_CODIGO AS CTR_CODIGO,
        e.EMP_SUELDO AS EMP_SUELDO,
        EPS.EPS_NOMBRE AS EPS_NOMBRE,
        AFP.AFP_NOMBRE AS AFP_NOMBRE,
        ARP.ARP_NOMBRE AS ARP_NOMBRE,
        CCF.CCF_NOMBRE AS CCF_NOMBRE,
        CES.AFP_NOMBRE AS AFP_CESANTIA,
        BAN.BAN_NOMBRE AS BAN_NOMBRE
      FROM BAN_ENTIDAD BAN, 
      EPS_ENTIDAD EPS, 
      AFP_ENTIDAD AFP, 
      AFP_ENTIDAD CES,
      ARP_ENTIDAD ARP, 
      CCF_ENTIDAD CCF, 
      GRP_GRUPOLAB GL,  
      STC_SUBTIPOCOT STC, 
      COT_TIPOCOT COT, 
      CDT_CENTROTRA CT, 
      SCC_SUBCENTRO S, 
      CDC_CENTROCOSTO CC, 
      DEP_DEPENDENCIA D, 
      CAR_CARGO C, 
      EMP_EMPLEADO e
      LEFT JOIN HDV_HOJAVIDA h
        ON e.hdv_doc = h.hdv_doc
        AND e.hdv_documento = h.hdv_documento
      WHERE h.HDV_CORREO = @email
      AND C.CAR_CODIGO = e.CAR_CODIGO
      AND D.DEP_CODIGO = e.DEP_CODIGO
      AND CC.CDC_CODIGO = e.CDC_CODIGO
      AND S.SCC_CODIGO = e.SCC_CODIGO
      AND CT.CDT_CODIGO = e.CDT_CODIGO
      AND COT.COT_CODIGO = e.COT_CODIGO
      AND STC.STC_CODIGO = e.STC_CODIGO
      AND GL.GRP_CODIGO = e.GRP_CODIGO
      AND EPS.EPS_CODIGO = e.EPS_CODIGO
      AND AFP.AFP_CODIGO = e.AFP_CODIGO
      AND ARP.ARP_CODIGO = e.ARP_CODIGO
      AND CCF.CCF_CODIGO = e.CCF_CODIGO
      AND BAN.BAN_CODIGO = e.BAN_CODIGO
      AND CES.AFP_CODIGO = e.EMP_CESANTIA
      `;

    const result = await executeQuery(query, [
      { name: 'email', type: sql.VarChar, value: email }
    ]);

    const record = result.recordset && result.recordset[0];

    if (!record) {
      return res.status(404).json({
        message: 'No se encontró información del empleado.'
      });
    }

    res.json(record);
  } catch (err) {
    logger.error('Error al obtener la información del empleado', err);
    return res.status(400).json({
      message: 'Error al obtener la información del empleado.'
    });
  }
});

app.get('/api/curriculum', requireAuth, async (req, res) => {
  try {
    const { email } = req.user;
    logger.debug('Curriculum request for email:', email);
    const query = `
      SELECT TOP 1
        HDV_DOC AS hdv_doc,
        HDV_DOCUMENTO AS hdv_documento,
        HDV_NOMBRE AS hdv_nombre,
        HDV_APELLIDO AS hdv_apellido,
        HDV_CORREO AS hdv_correo,
        hdv_ciudadexp as hdv_ciudadexp,
        hdv_nacionalidad as hdv_nacionalidad,
        hdv_estado as hdv_estado,
        hdv_feccrea as hdv_feccrea,  
        hdv_dir as hdv_dir,
        hdv_telefono as hdv_telefono,
        hdv_telefono2 as hdv_telefono2,
        hdv_telefono3 as hdv_telefono3,
        hdv_sexo as hdv_sexo,
        hdv_fnac as hdv_fnac,
        hdv_estciv as hdv_estciv,
        hdv_coment as hdv_coment
      FROM HDV_HOJAVIDA
      WHERE HDV_CORREO = @email;
    `;

    const result = await executeQuery(query, [
      { name: 'email', type: sql.VarChar, value: email }
    ]);

    const record = result.recordset && result.recordset[0];

    if (!record) {
      return res.status(404).json({
        message: 'No se encontró información de currículum.'
      });
    }

    res.json(record);
  } catch (err) {
    logger.error('Error al obtener el currículum', err);
    return res.status(400).json({
      message: 'Error al obtener el currículum.'
    });
  }
});

// Ruta para solicitar el cambio de contraseña (enviar email)
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    // Lógica para manejar el olvido de contraseña
    await forgotPassword(email);
    res.json({ message: 'Instrucciones para restablecer la contraseña enviadas a tu correo.' });
  } catch (err) {
    logger.error('Error en forgot-password', err);
    res.status(500).json({ message: 'Error al procesar la solicitud de contraseña olvidada.' });
  }
});

// Ruta para restablecer la contraseña
app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    // Lógica para restablecer la contraseña
    await resetPassword(token, newPassword);
    res.json({ message: 'Contraseña restablecida exitosamente.' });
  } catch (err) {
    logger.error('Error en reset-password', err);
    res.status(500).json({ message: 'Error al restablecer la contraseña.' });
  }
});

app.get('/api/admin/search-users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const searchTerm = String(req.query.q || '').trim();

    if (!searchTerm) {
      return res.json({ users: [] });
    }

    const query = `
      SELECT TOP 50
        CAST(e.EMP_CODIGO AS NVARCHAR(100)) AS contractNumber,
        CAST(h.HDV_DOCUMENTO AS NVARCHAR(100)) AS documentNumber,
        h.HDV_DOC AS documentType,
        h.HDV_NOMBRE AS firstName,
        h.HDV_APELLIDO AS lastName,
        h.HDV_CORREO AS email
      FROM EMP_EMPLEADO e
      LEFT JOIN HDV_HOJAVIDA h
        ON e.hdv_doc = h.hdv_doc
       AND e.hdv_documento = h.hdv_documento
      WHERE
        CAST(e.EMP_CODIGO AS NVARCHAR(100)) LIKE @searchTerm
        OR CAST(h.HDV_DOCUMENTO AS NVARCHAR(100)) LIKE @searchTerm
        OR h.HDV_NOMBRE LIKE @searchTerm
        OR h.HDV_APELLIDO LIKE @searchTerm
        OR CONCAT(h.HDV_NOMBRE, ' ', h.HDV_APELLIDO) LIKE @searchTerm
        OR h.HDV_CORREO LIKE @searchTerm
      ORDER BY e.EMP_CODIGO;
    `;

    const result = await executeQuery(query, [{
      name: 'searchTerm',
      type: sql.VarChar,
      value: `%${searchTerm}%`
    }]);

    const employeeMatches = result.recordset || [];
    const emails = [...new Set(
      employeeMatches
        .map(item => String(item.email || '').trim().toLowerCase())
        .filter(Boolean)
    )];

    const mongoUsers = emails.length
      ? await User.find({ email: { $in: emails } })
          .lean()
          .select('_id firstName lastName email role avatar bio')
      : [];

    const mongoUsersByEmail = new Map(
      mongoUsers.map(user => [String(user.email).trim().toLowerCase(), user])
    );

    const users = employeeMatches.map(item => {
      const normalizedEmail = String(item.email || '').trim().toLowerCase();
      const mongoUser = mongoUsersByEmail.get(normalizedEmail);

      return {
        _id: mongoUser?._id || null,
        firstName: mongoUser?.firstName || item.firstName || '',
        lastName: mongoUser?.lastName || item.lastName || '',
        email: mongoUser?.email || item.email || '',
        role: mongoUser?.role || 'user',
        avatar: mongoUser?.avatar || '',
        bio: mongoUser?.bio || '',
        contractNumber: item.contractNumber || null,
        documentNumber: item.documentNumber || null,
        documentType: item.documentType || null
      };
    });

    const directUserMatches = await User.find({
      $or: [
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
        { email: { $regex: searchTerm, $options: 'i' } }
      ]
    })
      .lean()
      .select('_id firstName lastName email role avatar bio');

    const mergedUsers = new Map();

    users.forEach(user => {
      if (user.email) {
        mergedUsers.set(String(user.email).trim().toLowerCase(), user);
      }
    });

    directUserMatches.forEach(user => {
      const key = String(user.email).trim().toLowerCase();
      const existing = mergedUsers.get(key);
      if (!existing) {
        mergedUsers.set(key, {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role || 'user',
          avatar: user.avatar || '',
          bio: user.bio || '',
          contractNumber: null,
          documentNumber: null,
          documentType: null
        });
      }
    });

    return res.json({
      users: [...mergedUsers.values()]
    });
  } catch (err) {
    logger.error('Error buscando usuarios por admin', err);
    return res.status(400).json({
      message: 'Hubo un problema al buscar usuarios.'
    });
  }
});

const PORT = process.env.PORT || 3002;

async function connect() {
  try {
    mongoose.Promise = global.Promise;
    await mongoose.connect(API_CONEXION).then(() => {
      logger.info('Conexión a MongoDB exitosa');
    });
  } catch (err) {
    logger.error('Error de conexión a MongoDB', err);
  }
  app.listen(PORT);
  logger.info(`API escuchando en localhost:${PORT}`);
}

//Modificado Johan 26-03-2027
/*async function connect() {
  try {
    mongoose.Promise = global.Promise;
    await mongoose.connect(API_CONEXION, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false,
    }) .then(()=>{logger.info('Conexión a MongoDB exitosa')});
  } catch (err) {
    logger.error('Error de conexión a MongoDB', err);
  }
  app.listen(3001);
  logger.info('API escuchando en localhost:3001');
}*/

// Middleware global de manejo de errores
app.use((err, req, res, next) => {
  logger.error(`Error en ${req.method} ${req.path}`, {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });

  res.status(err.status || 500).json({
    message: err.message || 'Error interno del servidor'
  });
});

connect();
