import React, { useContext, useState, useEffect, useCallback } from 'react';
import PageTitle from '../components/common/PageTitle';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import { FetchContext } from '../context/FetchContext';
import { AuthContext } from '../context/AuthContext';

const initialPaginationState = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false
};

const statusOptions = [
  { value: 'pendiente', label: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'autorizada', label: 'Autorizada', color: 'bg-green-100 text-green-800' },
  { value: 'rechazada', label: 'Rechazada', color: 'bg-red-100 text-red-800' },
  { value: 'enviada', label: 'Enviada', color: 'bg-blue-100 text-blue-800' }
];

const requestTypeOptions = [
  { value: 'vacaciones', label: 'Vacaciones' },
  { value: 'permisos', label: 'Permisos' },
  { value: 'incapacidades', label: 'Incapacidades' }
];

const AdminPayrollRequests = () => {
  const fetchContext = useContext(FetchContext);
  const auth = useContext(AuthContext);

  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState(initialPaginationState);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const [filters, setFilters] = useState({
    search: '',
    requestType: '',
    status: '',
    startDate: '',
    endDate: ''
  });

  const loadRequests = useCallback(async (page = 1) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', pagination.limit.toString());
      if (filters.search) params.set('search', filters.search);
      if (filters.requestType) params.set('requestType', filters.requestType);
      if (filters.status) params.set('status', filters.status);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const { data } = await fetchContext.authAxios.get(`/admin/payroll-requests?${params.toString()}`);
      setRequests(data.payrollRequests || []);
      setPagination(data.pagination || initialPaginationState);
    } catch (err) {
      console.error('Error cargando solicitudes:', err);
      setRequests([]);
      setPagination(initialPaginationState);
    } finally {
      setIsLoading(false);
    }
  }, [fetchContext.authAxios, pagination.limit, filters]);

  useEffect(() => {
    loadRequests(1);
  }, [loadRequests]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadRequests(1);
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      requestType: '',
      status: '',
      startDate: '',
      endDate: ''
    });
    loadRequests(1);
  };

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      setUpdatingId(requestId);
      const { data } = await fetchContext.authAxios.patch(`/admin/payroll-requests/${requestId}/status`, { status: newStatus });
      setRequests(prev => prev.map(r => r._id === requestId ? data.payrollRequest : r));
    } catch (err) {
      console.error('Error actualizando estado:', err);
      alert(err.response?.data?.message || 'No se pudo actualizar el estado');
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      loadRequests(newPage);
    }
  };

  const handleLimitChange = (newLimit) => {
    const limit = parseInt(newLimit, 10);
    if (!isNaN(limit) && limit > 0 && limit <= 100) {
      setPagination(prev => ({ ...prev, limit }));
      loadRequests(1);
    }
  };

  const getStatusBadge = (status) => {
    const opt = statusOptions.find(s => s.value === status) || { color: 'bg-gray-100 text-gray-800', label: status };
    return <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${opt.color}`}>{opt.label}</span>;
  };

  const getTypeBadge = (type) => {
    const opt = requestTypeOptions.find(t => t.value === type) || { label: type };
    return <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 capitalize">{opt.label}</span>;
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

  if (!auth.isAdmin()) {
    return (
      <>
        <PageTitle title="Panel de Solicitudes" />
        <Card>
          <p className="text-red-600 font-semibold">No tienes permisos de administrador.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Panel de Control - Solicitudes de Nómina" />

      <Card className="mb-6">
        <h3 className="mb-4 text-lg font-bold uppercase tracking-[0.12em] text-slate-600">Filtros de búsqueda</h3>
        <form onSubmit={handleSearch} className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 items-end">
          <div className="md:col-span-2 lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar (nombre, email, tipo, descripción, estado)</label>
            <Input
              type="text"
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
              placeholder="Escribe para buscar..."
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de solicitud</label>
            <select
              value={filters.requestType}
              onChange={e => handleFilterChange('requestType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Todos</option>
              {requestTypeOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={filters.status}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Todos</option>
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

         {/* Se comentarea codigo ya que no filtra fecha, si se requiere se debe revisar funcionalidad 10-09-2026

         <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha desde</label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={e => handleFilterChange('startDate', e.target.value)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha hasta</label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={e => handleFilterChange('endDate', e.target.value)}
              className="w-full"
            />
          </div>

         */}

          <div className="md:col-span-2 lg:col-span-3 flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              Buscar
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              Limpiar
            </button>
          </div>
        </form>
      </Card>

      <Card>
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Cargando solicitudes...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No se encontraron solicitudes con los filtros actuales.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Empleado</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Tipo</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Fechas</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Días</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Descripción</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Fecha solicitud</th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.12em] text-slate-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {requests.map(request => (
                    <tr key={request._id} className="hover:bg-slate-50">
                      <td className="px-1 py-3 text-sm text-slate-700 font-medium">
                      {request.employeeName || `${request.firstName || ''} ${request.lastName || ''}`.trim() || request.email || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {request.email}
                      </td>
                      <td className="px-4 py-3 text-sm">{getTypeBadge(request.requestType)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <div>{formatDate(request.startDate)} - {formatDate(request.endDate)}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{request.days}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate" title={request.description}>{request.description}</td>
                      <td className="px-4 py-3 text-sm">{getStatusBadge(request.status || 'enviada')}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDateTime(request.createdAt)}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          {statusOptions
                            .filter(opt => opt.value !== (request.status || 'enviada'))
                            .map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => handleStatusChange(request._id, opt.value)}
                                disabled={updatingId === request._id}
                                className={`px-2 py-1 text-xs font-semibold rounded ${opt.color} hover:opacity-80 disabled:opacity-50`}
                              >
                                {updatingId === request._id ? '...' : opt.label}
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.totalPages > 1 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">Registros por página:</label>
                  <select
                    value={pagination.limit}
                    onChange={e => handleLimitChange(e.target.value)}
                    className="px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">
                    Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={!pagination.hasNextPage}
                    className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Siguiente
                  </button>
                </div>

              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
};

export default AdminPayrollRequests;