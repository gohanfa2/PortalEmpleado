import React, {
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';
import { useLocation } from 'react-router-dom';
import PageTitle from '../components/common/PageTitle';
import { FetchContext } from '../context/FetchContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/common/Card';
import defaultAvatar from './../images/defaultAvatar.png';

const statusOptions = [
  { value: 'pendiente', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'autorizada', label: 'Autorizada', color: 'bg-green-100 text-green-800' },
  { value: 'rechazada', label: 'Rechazada', color: 'bg-red-100 text-red-800' },
  { value: 'enviada', label: 'Enviada', color: 'bg-blue-100 text-blue-800' }
];

const getStatusBadge = (status) => {
  const opt = statusOptions.find(s => s.value === status) || { color: 'bg-gray-100 text-gray-800', label: status };
  return <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${opt.color}`}>{opt.label}</span>;
};

const UserDetailLabel = ({ text }) => (
  <p className="mt-2 uppercase font-bold text-gray-500 text-xs">
    {text}
  </p>
);

const UserDetail = ({ user, onEdit, onDelete, isCurrentUser, onViewProfile }) => (
  <Card>
    <div className="flex items-start justify-between gap-4">
      <div className="flex">
        <div className="w-24">
          <img
            src={user.avatar || defaultAvatar}
            alt="avatar"
            className="rounded-full"
          />
        </div>

        <div className="ml-4">
          <p className="font-bold text-lg">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-gray-600">{user.email}</p>
          <p className="text-sm text-gray-500 uppercase font-semibold">
            {user.role || 'user'}
          </p>

          {(user.contractNumber || user.documentNumber) && (
            <div className="mt-2 rounded bg-slate-50 p-2 text-sm text-slate-700">
              {user.contractNumber && (
                <p><span className="font-semibold">Contrato:</span> {user.contractNumber}</p>
              )}
              {user.documentNumber && (
                <p><span className="font-semibold">Documento:</span> {user.documentNumber}</p>
              )}
            </div>
          )}

          <div className="mt-2">
            <UserDetailLabel text="Bio" />
            {user.bio ? (
              <div
                dangerouslySetInnerHTML={{ __html: user.bio }}
              />
            ) : (
              <p className="text-gray-500 italic">
                No bio set
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onViewProfile && onViewProfile(user)}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Ver perfil
        </button>
        <button
          type="button"
          onClick={() => onEdit(user)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => onDelete(user._id)}
          disabled={user.role === 'admin' || isCurrentUser}
          className="px-4 py-2 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed bg-red-600 hover:bg-red-700"
        >
          {user.role === 'admin' || isCurrentUser ? 'No permitido' : 'Eliminar'}
        </button>
      </div>
    </div>
  </Card>
);

const emptyForm = () => ({
  firstName: '',
  lastName: '',
  email: '',
  role: 'user',
  bio: '',
  password: ''
});

const Users = () => {
  const fetchContext = useContext(FetchContext);
  const auth = useContext(AuthContext);
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    if (!auth.isAdmin()) {
      setUsers([]);
      return;
    }

    const params = new URLSearchParams(location.search);
    const searchTerm = (params.get('q') || '').trim();

    try {
      setIsLoading(true);
      const requestConfig = searchTerm ? { params: { q: searchTerm } } : {};
      const { data } = await fetchContext.authAxios.get(
        searchTerm ? 'admin/search-users' : 'users',
        requestConfig
      );
      setUsers(data.users || []);
      setErrorMessage('');
    } catch (err) {
      console.log(err);
      setErrorMessage(
        searchTerm
          ? 'No se encontraron usuarios con ese criterio de búsqueda.'
          : 'No se pudieron cargar los usuarios'
      );
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [auth, fetchContext.authAxios, location.search]);

  useEffect(() => {
    if (!auth.isAdmin()) {
      setUsers([]);
      return;
    }
    loadUsers();
  }, [auth, loadUsers]);

  const handleEdit = user => {
    setSelectedUserId(user._id);
    setFormData({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: user.role || 'user',
      bio: user.bio || '',
      password: ''
    });
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleChange = (field, value) => {
    setFormData(current => ({
      ...current,
      [field]: value
    }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const payload = { ...formData };
      if (!payload.password) {
        delete payload.password;
      }

      const { data } = await fetchContext.authAxios.patch(
        `users/${selectedUserId}`,
        payload
      );

      setUsers(currentUsers =>
        currentUsers.map(user =>
          user._id === selectedUserId
            ? { ...user, ...data.user }
            : user
        )
      );

      setSelectedUserId(null);
      setFormData(emptyForm());
      setSuccessMessage(data.message || 'Usuario actualizado');
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          'Hubo un problema al guardar el usuario'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async userId => {
    if (!window.confirm('¿Seguro que deseas eliminar este usuario?')) {
      return;
    }

    try {
      const { data } = await fetchContext.authAxios.delete(`users/${userId}`);
      setUsers(currentUsers =>
        currentUsers.filter(user => user._id !== userId)
      );
      setSuccessMessage(data.message || 'Usuario eliminado');
      setErrorMessage('');
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          'Hubo un problema al eliminar el usuario'
      );
      setSuccessMessage('');
    }
  };

  const loadUserProfile = useCallback(async email => {
    if (!email) {
      return;
    }

    try {
      setProfileLoading(true);
      setErrorMessage('');
      const [profileRes, payrollRes] = await Promise.all([
        fetchContext.authAxios.get('admin/user-profile', { params: { email } }),
        fetchContext.authAxios.get('admin/user-payroll-requests', { params: { email } })
      ]);
      setProfile({
        ...profileRes.data,
        payrollRequests: payrollRes.data.payrollRequests || []
      });
    } catch (err) {
      setProfile(null);
      setErrorMessage(
        err.response?.data?.message ||
          'No se pudo cargar el perfil del usuario seleccionado.'
      );
    } finally {
      setProfileLoading(false);
    }
  }, [fetchContext.authAxios]);

  const handleGenerateReport = async reportId => {
    try {
      const response = await fetchContext.authAxios.get(`/reports/${reportId}`, {
        responseType: 'blob'
      });

      const fileBlob = new Blob([response.data], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(fileBlob);
      window.open(pdfUrl, '_blank');
    } catch (err) {
      setErrorMessage(
        err.response?.data?.message ||
          'No se pudo generar el reporte para este usuario.'
      );
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-CO');
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleString('es-CO');
  };

  const renderProfileInfo = () => {
    if (!profile) {
      return null;
    }

    const employee = profile.employee || {};
    const curriculum = profile.curriculum || {};
    const inventory = Array.isArray(profile.inventory) ? profile.inventory : [];
    const reports = Array.isArray(profile.reports) ? profile.reports : [];
    const requestTypes = Array.isArray(profile.requestTypes) ? profile.requestTypes : [];
    const payrollRequests = Array.isArray(profile.payrollRequests) ? profile.payrollRequests : [];

    return (
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-gray-500">Perfil administrativo</p>
            <h3 className="text-xl font-bold">
              {profile.user?.firstName || ''} {profile.user?.lastName || ''}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setProfile(null)}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Cerrar
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase font-bold text-slate-600">Correo</p>
            <p className="mt-1 text-sm text-slate-700">{profile.user?.email}</p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase font-bold text-slate-600">Rol</p>
            <p className="mt-1 text-sm text-slate-700">{profile.user?.role || 'user'}</p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase font-bold text-slate-600">Contrato</p>
            <p className="mt-1 text-sm text-slate-700">{employee.EMP_CODIGO || '—'}</p>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase font-bold text-slate-600">Documento</p>
            <p className="mt-1 text-sm text-slate-700">{curriculum.hdv_documento || '—'}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <div className="rounded border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-slate-600">Empleado</h4>
            <div className="space-y-2 text-sm text-slate-700">
              <p><span className="font-semibold">Nombres:</span> {employee.EMP_NOMBRE || '—'}</p>
              <p><span className="font-semibold">Apellidos:</span> {employee.EMP_APELLIDO || '—'}</p>
              <p><span className="font-semibold">Cargo:</span> {employee.CAR_DESC || '—'}</p>
              <p><span className="font-semibold">Dependencia:</span> {employee.DEP_NOMBRE || '—'}</p>
              <p><span className="font-semibold">Sueldo:</span> {employee.EMP_SUELDO || '—'}</p>
            </div>
          </div>

          <div className="rounded border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-slate-600">Hoja de vida</h4>
            <div className="space-y-2 text-sm text-slate-700">
              <p><span className="font-semibold">Tipo doc:</span> {curriculum.hdv_doc || '—'}</p>
              <p><span className="font-semibold">Documento:</span> {curriculum.hdv_documento || '—'}</p>
              <p><span className="font-semibold">Dirección:</span> {curriculum.hdv_dir || '—'}</p>
              <p><span className="font-semibold">Teléfono:</span> {curriculum.hdv_telefono || '—'}</p>
              <p><span className="font-semibold">Correo:</span> {curriculum.hdv_correo || '—'}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-2">
          <div className="rounded border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-slate-600">Adjuntos</h4>
            {inventory.length ? (
              <ul className="space-y-2 text-sm text-slate-700">
                {inventory.map(item => (
                  <li key={item._id} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2 py-2">
                    <span>{item.name || item.itemNumber || 'Archivo'}</span>
                    {item.image && (
                      <a
                        href={
                          item.image.startsWith('/api/')
                            ? `${(process.env.REACT_APP_API_URL || '').replace(/\/api\/?$/, '')}${item.image}`
                            : item.image
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        Ver
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No hay adjuntos cargados.</p>
            )}
          </div>

          <div className="rounded border border-slate-200 p-4">
            <h4 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-slate-600">Reportes</h4>
            {reports.length ? (
              <div className="space-y-2">
                {reports.map(report => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => handleGenerateReport(report.id)}
                    className="block w-full rounded bg-blue-600 px-3 py-2 text-left text-sm font-medium text-white hover:bg-blue-700"
                  >
                    {report.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No hay reportes disponibles.</p>
            )}
          </div>
        </div>

        <div className="mt-6 rounded border border-slate-200 p-4">
          <h4 className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-slate-600">Solicitudes de nómina</h4>
          {payrollRequests.length ? (
            <ul className="space-y-3">
              {payrollRequests.map(request => (
                <li key={request._id} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase font-bold text-slate-600">Tipo</p>
                      <p className="text-sm text-slate-700 capitalize">{request.requestType}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-slate-600">Fecha inicio</p>
                      <p className="text-sm text-slate-700"> {formatDate(request.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-slate-600">Fecha fin</p>
                      <p className="text-sm text-slate-700">
                        {formatDate(request.endDate)}
                      </p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-xs uppercase font-bold text-slate-600">Descripción</p>
                      <p className="text-sm text-slate-700">{request.description}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-slate-600">Días</p>
                      <p className="text-sm text-slate-700">{request.days}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-slate-600">Estado</p>
                      {getStatusBadge(request.status || 'enviada')}
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-xs uppercase font-bold text-slate-600">Fecha solicitud</p>
                      <p className="text-sm text-slate-700">
                        {formatDateTime(request.createdAt)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No hay solicitudes registradas para este usuario.</p>
          )}
        </div>
      </Card>
    );
  };

  const handleUserClick = async user => {
    if (!user?.email) {
      return;
    }

    await loadUserProfile(user.email);
  };

  if (!auth.isAdmin()) {
    return (
      <>
        <PageTitle title="Usuarios" />
        <Card>
          <p className="text-red-600 font-semibold">
            No tienes permisos para administrar usuarios.
          </p>
        </Card>
      </>
    );
  }

  const searchTerm = (new URLSearchParams(location.search).get('q') || '').trim();

  return (
    <>
      <PageTitle title={searchTerm ? `Usuarios (${searchTerm})` : 'Usuarios'} />
      <div className="flex flex-col space-y-4">
        {selectedUserId && (
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">Editar usuario</h3>
              <button
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Cancelar
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={e => handleChange('firstName', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Apellido
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={e => handleChange('lastName', e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Rol
                </label>
                <select
                  value={formData.role}
                  onChange={e => handleChange('role', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Biografía
                </label>
                <textarea
                  value={formData.bio}
                  onChange={e => handleChange('bio', e.target.value)}
                  rows="4"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={e => handleChange('password', e.target.value)}
                  placeholder="Deja vacío para no cambiarla"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                />
              </div>

              {errorMessage && (
                <p className="text-red-600">{errorMessage}</p>
              )}

              {successMessage && (
                <p className="text-green-600">{successMessage}</p>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </form>
          </Card>
        )}

        {isLoading && (
          <Card>
            <p className="text-gray-500">Buscando usuarios...</p>
          </Card>
        )}

        {profileLoading && (
          <Card>
            <p className="text-gray-500">Cargando perfil del usuario...</p>
          </Card>
        )}

        {!isLoading && !!users.length ? (
          users.map(user => (
            <div key={user._id || `${user.email}-${user.contractNumber || 'sin-contrato'}`} className="m-2">
              <UserDetail
                user={user}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onViewProfile={handleUserClick}
                isCurrentUser={user._id === auth.authState.userInfo._id}
              />
            </div>
          ))
        ) : null}

        {!isLoading && !users.length && (
          <Card>
            <p className="text-gray-500">
              {searchTerm
                ? 'No se encontraron coincidencias para este criterio de búsqueda.'
                : 'No hay usuarios registrados.'}
            </p>
          </Card>
        )}

        {profile && renderProfileInfo()}
      </div>
    </>
  );
};

export default Users;
