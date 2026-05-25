const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = 3100;

app.use(cors());
app.use(express.json());

const BLOGS_PATH = path.join(__dirname, '../Archivos/blogs.json');
const UPLOADS_PATH = path.join(__dirname, '../Archivos/uploads');

if (!fs.existsSync(UPLOADS_PATH)) fs.mkdirSync(UPLOADS_PATH);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_PATH);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Obtener todos los blogs
app.get('/api/blogs', (req, res) => {
  fs.readFile(BLOGS_PATH, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Error leyendo blogs' });
    res.json(JSON.parse(data));
  });
});

// Subir un nuevo blog
app.post('/api/blogs', upload.fields([
  { name: 'imagen', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), (req, res) => {
  const { titulo, resumen, contenido, enlaces, categoria, fecha } = req.body;
  const imagen = req.files['imagen'] ? req.files['imagen'][0].filename : null;
  const video = req.files['video'] ? req.files['video'][0].filename : null;

  fs.readFile(BLOGS_PATH, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Error leyendo blogs' });
    const blogs = JSON.parse(data);
    const id = Date.now();
    blogs.unshift({ id, titulo, resumen, contenido, imagen, video, enlaces: JSON.parse(enlaces || '[]'), categoria, fecha });
    fs.writeFile(BLOGS_PATH, JSON.stringify(blogs, null, 2), err => {
      if (err) return res.status(500).json({ error: 'Error guardando blog' });
      res.json({ success: true });
    });
  });
});

// Servir archivos multimedia
app.use('/uploads', express.static(UPLOADS_PATH));

app.listen(PORT, () => {
  console.log('Blog backend running on port', PORT);
});
