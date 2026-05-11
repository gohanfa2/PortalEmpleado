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
const logger = require('./logger');
const { API_CONEXION } = require ('../frontend/configure');
const { JWT_JSON } = require('../frontend/configure');
const dashboardData = require('./data/dashboard');
const User = require('./data/User');
const InventoryItem = require('./data/InventoryItem');


const {
  createToken,
  hashPassword,
  verifyPassword
} = require('./util');
const { executeQuery, sql } = require('./db/connection');

const app = express();

app.use(cors());
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

const attachUser = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res
      .status(401)
      .json({ message: 'Authentication invalid' });
  }
  const decodedToken = jwtDecode(token.slice(7));

  if (!decodedToken) {
    return res.status(401).json({
      message: 'There was a problem authorizing the request'
    });
  } else {
    req.user = decodedToken;
    next();
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

app.get('/api/dashboard-data', requireAuth, (req, res) =>
  res.json(dashboardData)
);

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
  requireAdmin,
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
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const userId = req.user.sub;
      const input = Object.assign({}, req.body, {
        user: userId
      });
      const inventoryItem = new InventoryItem(input);
      await inventoryItem.save();
      res.status(201).json({
        message: 'Articulo cargado!',
        inventoryItem
      });
    } catch (err) {
      return res.status(400).json({
        message: 'Hubo un problema al cargar articulo'
      });
    }
  }
);

app.delete(
  '/api/inventory/:id',
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const deletedItem = await InventoryItem.findOneAndDelete(
        { _id: req.params.id, user: req.user.sub }
      );
      res.status(201).json({
        message: 'Inventory item deleted!',
        deletedItem
      });
    } catch (err) {
      return res.status(400).json({
        message: 'There was a problem deleting the item.'
      });
    }
  }
);

app.get('/api/users', requireAuth, async (req, res) => {
  try {
    const users = await User.find()
      .lean()
      .select('_id firstName lastName avatar bio');

    res.json({
      users
    });
  } catch (err) {
    return res.status(400).json({
      message: 'There was a problem getting the users'
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

app.get('/api/reports/:reportId', requireAuth, async (req, res) => {
  try {
    const { reportId } = req.params;
    const jasperPath = path.join(reportsFolder, `${reportId}.jasper`);

    if (!fs.existsSync(jasperPath)) {
      return res.status(404).json({
        message: 'Reporte no encontrado.'
      });
    }

    const outputPdf = path.join(reportsOutputFolder, `${reportId}.pdf`);
    const jasperStarterBinary = process.env.JASPER_STARTER_PATH || 'jasperstarter';

    await new Promise((resolve, reject) => {
      execFile(
        jasperStarterBinary,
        ['pr', jasperPath, '-o', reportsOutputFolder, '-f', 'pdf'],
        (error, stdout, stderr) => {
          if (error) {
            logger.error('Error al ejecutar reporte', { stderr, stdout, error });
            return reject(error);
          }
          resolve();
        }
      );
    });

    if (!fs.existsSync(outputPdf)) {
      return res.status(500).json({
        message: 'No se pudo generar el PDF del reporte.'
      });
    }

    res.sendFile(outputPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${reportId}.pdf"`
      }
    });
  } catch (err) {
    logger.error('Error al generar reporte con JasperStarter', err);
    res.status(500).json({
      message:
        'Error al generar el reporte. Verifica que JasperStarter esté instalado y accesible.'
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
