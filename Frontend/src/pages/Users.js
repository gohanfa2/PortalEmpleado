import React, {
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';
import PageTitle from '../components/common/PageTitle';
import { FetchContext } from '../context/FetchContext';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/common/Card';
import defaultAvatar from './../images/defaultAvatar.png';

const UserDetailLabel = ({ text }) => (
  <p className="mt-2 uppercase font-bold text-gray-500 text-xs">
    {text}
  </p>
);

const UserDetail = ({ user, onEdit, onDelete, isCurrentUser }) => (
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

      <div className="flex gap-2">
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
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await fetchContext.authAxios.get('users');
      setUsers(data.users || []);
    } catch (err) {
      console.log(err);
      setErrorMessage('No se pudieron cargar los usuarios');
    }
  }, [fetchContext.authAxios]);

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

  return (
    <>
      <PageTitle title="Usuarios" />
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

        {!!users.length ? (
          users.map(user => (
            <div key={user._id} className="m-2">
              <UserDetail
                user={user}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isCurrentUser={user._id === auth.authState.userInfo._id}
              />
            </div>
          ))
        ) : (
          <Card>
            <p className="text-gray-500">No hay usuarios registrados.</p>
          </Card>
        )}
      </div>
    </>
  );
};

export default Users;
