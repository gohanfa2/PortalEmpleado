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
if (!fs.existsSync(reportsOutputFolder)) {
  fs.mkdirSync(reportsOutputFolder, { recursive: true });
}

app.get('/api/reports', requireAuth, async (req, res) => {
  try {
    const reportFiles = fs.readdirSync(reportsFolder).filter(file => file.endsWith('.jasper'));
    const reports = reportFiles.map(file => ({
      id: path.basename(file, '.jasper'),
      file,
      label: path.basename(file, '.jasper')
    }));

    res.json({
      reports
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
          jasperArgs.push('-P', `p_emp_codigo=${emp.p_emp_codigo || ''}`);
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
          const safeCode = String(emp.p_emp_codigo || '').replace(/'/g, "''");
          jasperArgs.push('-P', `p_emp_codigo=${safeCode}`);

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
          const safeCode = String(emp.p_emp_codigo || '').replace(/'/g, "''");
          jasperArgs.push('-P', `p_emp_codigo=${safeCode}`);
          // comentareo hdv_id para cuando mecesite validar varios contratos de un mismo empleado, se pueda pasar el hdv_id y que el reporte filtre por ese contrato
         /* if (emp.p_hdv_id || emp.p_hdv_id === 0) {
            jasperArgs.push('-P', `p_hdv_id=${emp.p_hdv_id}`);
          }
          */
        } else {
          logger.warn('No se encontró emp_codigo para el usuario; el reporte podría salir vacío');
        }

        // Pasar rango de fechas para el reporte en formato dd/MM/yyyy
       /* jasperArgs.push('-P', `p_fecha_ini=01/01/2025`);
        jasperArgs.push('-P', `p_fecha_fin=31/12/2025`);
       */
      } catch (err) {
        logger.error('Error al obtener emp_codigo para ingresosRetenciones2025E', err);
      }
    }



    // Log del comando JasperStarter que se va a ejecutar (útil para depuración)
    try {
      logger.info('JasperStarter command:', {
        binary: jasperStarterBinary,
        args: jasperArgs
      });
    } catch (logErr) {
      // no bloquear si el logger falla
      console.log('JasperStarter command:', jasperStarterBinary, jasperArgs.join(' '));
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
          logger.info('JasperStarter stdout:', stdout);
          if (stderr) logger.warn('JasperStarter stderr:', stderr);
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
          logger.info('Copia del PDF guardada para inspección', { copyPath });
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
