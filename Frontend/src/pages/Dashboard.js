
import React, { useState, useEffect, useRef } from 'react';
import Card from '../components/common/Card';
import Navbar from '../components/Navbar';

const API = 'http://localhost:3100/api/blogs';
const UPLOADS = 'http://localhost:3100/uploads/';

const categorias = ['Todas', 'Tecnología', 'Salud', 'Educación', 'Cultura', 'Deportes'];

function BlogCard({ blog, onOpen }) {
  return (
    <div className="w-full sm:w-1/2 md:w-1/3 xl:w-1/4 p-2">
      <Card>
        {blog.imagen && (
          <img src={UPLOADS + blog.imagen} alt={blog.titulo} className="h-40 w-full object-cover rounded-t" />
        )}
        <div className="p-2">
          <h2 className="font-bold text-lg mb-1 cursor-pointer hover:text-blue-600" onClick={() => onOpen(blog)}>{blog.titulo}</h2>
          <div className="text-xs text-gray-500 mb-2">{blog.fecha}</div>
          <div className="mb-2 text-gray-700">{blog.resumen}</div>
          <button className="text-blue-600 hover:underline text-sm" onClick={() => onOpen(blog)}>Leer más</button>
        </div>
      </Card>
    </div>
  );
}

function BlogModal({ blog, onClose }) {
  if (!blog) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white max-w-lg w-full rounded-lg shadow-lg overflow-y-auto max-h-[90vh] p-6 relative">
        <button className="absolute top-2 right-2 text-gray-500 hover:text-red-500 text-xl" onClick={onClose}>&times;</button>
        <h2 className="text-2xl font-bold mb-2">{blog.titulo}</h2>
        <div className="text-xs text-gray-500 mb-4">{blog.fecha} | {blog.categoria}</div>
        {blog.imagen && <img src={UPLOADS + blog.imagen} alt={blog.titulo} className="mb-4 rounded" />}
        <div className="prose mb-4" dangerouslySetInnerHTML={{ __html: blog.contenido }} />
        {blog.video && (
          <video src={UPLOADS + blog.video} controls className="w-full mb-4 rounded" />
        )}
        {blog.enlaces && blog.enlaces.length > 0 && (
          <div className="mt-2">
            <div className="font-semibold">Enlaces:</div>
            <ul className="list-disc ml-6">
              {blog.enlaces.map((e, i) => (
                <li key={i}><a href={e} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{e}</a></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function BlogForm({ onUpload }) {
  const [form, setForm] = useState({ titulo: '', resumen: '', contenido: '', categoria: 'Tecnología', fecha: '', enlaces: '' });
  const [imagen, setImagen] = useState();
  const [video, setVideo] = useState();
  const [loading, setLoading] = useState(false);
  const fileImg = useRef();
  const fileVid = useRef();

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleFile = (e, type) => {
    if (type === 'imagen') setImagen(e.target.files[0]);
    else setVideo(e.target.files[0]);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => data.append(k, v));
    if (imagen) data.append('imagen', imagen);
    if (video) data.append('video', video);
    // Enlaces separados por coma
    data.set('enlaces', JSON.stringify(form.enlaces.split(',').map(e => e.trim()).filter(Boolean)));
    data.set('fecha', form.fecha || new Date().toISOString().slice(0, 10));
    try {
      const res = await fetch(API, { method: 'POST', body: data });
      if (!res.ok) throw new Error('Error al subir el blog');
      setForm({ titulo: '', resumen: '', contenido: '', categoria: 'Tecnología', fecha: '', enlaces: '' });
      setImagen(null); setVideo(null);
      if (fileImg.current) fileImg.current.value = '';
      if (fileVid.current) fileVid.current.value = '';
      onUpload();
    } catch (err) {
      console.error('Error al subir el blog:', err);
      alert('No se pudo subir el blog. Verifica la conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="bg-white rounded-lg shadow p-4 mb-6" onSubmit={handleSubmit}>
      <div className="flex flex-wrap gap-4">
        <input name="titulo" value={form.titulo} onChange={handleChange} required placeholder="Título" className="flex-1 p-2 border rounded" />
        <input name="resumen" value={form.resumen} onChange={handleChange} required placeholder="Resumen" className="flex-1 p-2 border rounded" />
        <select name="categoria" value={form.categoria} onChange={handleChange} className="p-2 border rounded">
          {categorias.filter(c => c !== 'Todas').map(c => <option key={c}>{c}</option>)}
        </select>
        <input name="fecha" type="date" value={form.fecha} onChange={handleChange} className="p-2 border rounded" />
      </div>
      <textarea name="contenido" value={form.contenido} onChange={handleChange} required placeholder="Contenido (HTML permitido)" className="w-full p-2 border rounded mt-2" rows={4} />
      <div className="flex flex-wrap gap-4 mt-2">
      <input name="enlaces" value={form.enlaces} onChange={handleChange} placeholder="Enlaces (separados por coma)" className="flex-1 p-2 border rounded" />
      </div>
      <div className="flex flex-wrap gap-4 mt-2">
        <label className="mt-4 px-6 py-2 bg-blue-400 text-white rounded">Imagen</label>
        <input type="file" accept="image/*" ref={fileImg} onChange={e => handleFile(e, 'imagen')} className="p-2 border rounded"  />
        <label className="mt-4 px-6 py-2 bg-blue-400 text-white rounded">Video</label>
        <input type="file" accept="video/*" ref={fileVid} onChange={e => handleFile(e, 'video')} className="p-2 border rounded" />
      </div>
      <br />
      <div className="flex justify-end">
      <button type="submit" className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 " disabled={loading}>{loading ? 'Subiendo...' : 'Publicar Blog'}</button>
      </div>
    </form>
  );
}

const Dashboard = () => {
  const [blogs, setBlogs] = useState([]);
  const [modal, setModal] = useState(null);
  const [categoria, setCategoria] = useState('Todas');
  const [busqueda, setBusqueda] = useState('');

  const cargarBlogs = async () => {
    try {
      const res = await fetch(API);
      if (!res.ok) throw new Error('Error al cargar blogs');
      const data = await res.json();
      setBlogs(data);
    } catch (err) {
      console.error('Error fetching blogs:', err);
      setBlogs([]); // Opcional: limpiar blogs o mostrar mensaje de error
    }
  };

  useEffect(() => {
    cargarBlogs();
  }, []);

  // Filtrado
  const blogsFiltrados = blogs.filter(b =>
    (categoria === 'Todas' || b.categoria === categoria) &&
    (b.titulo.toLowerCase().includes(busqueda.toLowerCase()) || b.resumen.toLowerCase().includes(busqueda.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white font-sans">
      
      <div className="max-w-6xl mx-auto px-2 sm:px-6 py-6">
        <h1 className="text-3xl font-extrabold mb-4 text-blue-500 tracking-tight">Portal de Blogs Multimedia</h1>
        {/* Formulario de carga (solo admin, aquí visible siempre por demo) */}
        <BlogForm onUpload={cargarBlogs} />
        {/* Barra de categorías y buscador */}
        <div className="flex flex-wrap gap-2 mb-6 items-center">
          <div className="flex gap-2 flex-wrap">
            {categorias.map(cat => (
              <button key={cat} onClick={() => setCategoria(cat)} className={`px-4 py-1 rounded-full border ${categoria === cat ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border-blue-600'} font-semibold text-sm transition`}>{cat}</button>
            ))}
          </div>
          {/* Buscador aquí, pero botón de cerrar sesión eliminado si estaba duplicado */}
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar blogs..." className="ml-auto p-2 border rounded w-48" />
        </div>
        {/* Grid de blogs */}
        <div className="flex flex-wrap -m-2">
          {blogsFiltrados.length === 0 && <div className="text-gray-500 p-8">No hay blogs para mostrar.</div>}
          {blogsFiltrados.map(blog => (
            <BlogCard key={blog.id} blog={blog} onOpen={setModal} />
          ))}
        </div>
        <BlogModal blog={modal} onClose={() => setModal(null)} />
      </div>
    </div>
  );
};

export default Dashboard;
