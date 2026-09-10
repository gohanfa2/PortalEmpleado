import React, { useContext, useState, useEffect, useCallback } from 'react';
import PageTitle from '../components/common/PageTitle';
import VacationRequestForm from '../components/payrollRequest/VacationRequestForm';
import PermissionRequestForm from '../components/payrollRequest/PermissionRequestForm';
import MedicalLeaveRequestForm from '../components/payrollRequest/MedicalLeaveRequestForm';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import { AuthContext } from '../context/AuthContext';
import { FetchContext } from '../context/FetchContext';
import { submitPayrollRequest, fetchPayrollRequests } from '../services/payrollRequestService';

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

const requestTypes = [
  {
    id: 'vacaciones',
    label: 'Vacaciones',
    form: VacationRequestForm
  },
  {
    id: 'permisos',
    label: 'Permisos',
    form: PermissionRequestForm
  },
  {
    id: 'incapacidades',
    label: 'Incapacidades',
    form: MedicalLeaveRequestForm
  }
];

const initialPaginationState = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false
};

const PayrollRequests = () => {
  const auth = useContext(AuthContext);
  const fetchContext = useContext(FetchContext);
  const [selectedType, setSelectedType] = useState('vacaciones');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [historyData, setHistoryData] = useState({});
  const [isLoadingHistory, setIsLoadingHistory] = useState({});

  const employeeName = [
    auth.authState.userInfo.firstName,
    auth.authState.userInfo.lastName
  ]
    .filter(Boolean)
    .join(' ') || auth.authState.userInfo.email || 'Empleado';

  const loadHistoryForType = useCallback(async (typeId, page = 1, limit = 10) => {
    try {
      setIsLoadingHistory(prev => ({ ...prev, [typeId]: true }));
      const result = await fetchPayrollRequests(fetchContext.authAxios, {
        page,
        limit,
        requestType: typeId
      });
      setHistoryData(prev => ({
        ...prev,
        [typeId]: {
          requests: result.requests,
          pagination: result.pagination
        }
      }));
    } catch (err) {
      console.error(`Error cargando historial para ${typeId}:`, err);
      setHistoryData(prev => ({
        ...prev,
        [typeId]: {
          requests: [],
          pagination: initialPaginationState
        }
      }));
    } finally {
      setIsLoadingHistory(prev => ({ ...prev, [typeId]: false }));
    }
  }, [fetchContext.authAxios]);

  useEffect(() => {
    requestTypes.forEach(type => {
      loadHistoryForType(type.id, 1, 5);
    });
  }, [loadHistoryForType]);

  const handleSubmit = async values => {
    try {
      setSuccessMessage('');
      setErrorMessage('');

      const response = await submitPayrollRequest(fetchContext.authAxios, values);
      setSuccessMessage(response.message || 'Solicitud enviada correctamente.');

      const currentTypeData = historyData[selectedType];
      if (currentTypeData) {
        await loadHistoryForType(selectedType, currentTypeData.pagination.page, currentTypeData.pagination.limit);
      }
    } catch (err) {
      const responseError = err && err.response ? err.response.data : null;
      const backendErrors = responseError && responseError.errors
        ? responseError.errors.join(' ')
        : responseError && responseError.message
          ? responseError.message
          : 'Ocurrió un error al enviar la solicitud.';
      setErrorMessage(backendErrors);
    }
  };

  const SelectedForm = requestTypes.find(type => type.id === selectedType)?.form || VacationRequestForm;

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

  const handlePageChange = (typeId, newPage) => {
    const typeData = historyData[typeId];
    if (typeData && newPage >= 1 && newPage <= typeData.pagination.totalPages) {
      loadHistoryForType(typeId, newPage, typeData.pagination.limit);
    }
  };

  const handleLimitChange = (typeId, newLimit) => {
    const limit = parseInt(newLimit, 10);
    if (!isNaN(limit) && limit > 0 && limit <= 100) {
      loadHistoryForType(typeId, 1, limit);
    }
  };

  const renderPagination = (typeId) => {
    const typeData = historyData[typeId];
    if (!typeData || !typeData.requests.length) return null;

    const { page, totalPages, hasNextPage, hasPrevPage, limit, total } = typeData.pagination;

    return (
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded border border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-700">Registros por página:</label>
          <select
            value={limit}
            onChange={e => handleLimitChange(typeId, e.target.value)}
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
            Página {page} de {totalPages} ({total} registros)
          </span>
          <button
            onClick={() => handlePageChange(typeId, page - 1)}
            disabled={!hasPrevPage}
            className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Anterior
          </button>
          <button
            onClick={() => handlePageChange(typeId, page + 1)}
            disabled={!hasNextPage}
            className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Siguiente
          </button>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">Ir a página:</label>
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={e => handlePageChange(typeId, parseInt(e.target.value, 10))}
              className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>
    );
  };

  const renderHistorySection = (typeId, typeLabel) => {
    const typeData = historyData[typeId] || { requests: [], pagination: initialPaginationState };
    const { requests, pagination } = typeData;
    const loading = isLoadingHistory[typeId];

    if (loading) {
      return (
        <Card key={typeId} className="mt-6">
          <h3 className="mb-3 text-lg font-bold uppercase tracking-[0.12em] text-slate-600 flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-1 text-xs font-semibold">{typeLabel}</span>
            Historial
          </h3>
          <div className="text-center py-4">
            <p className="text-gray-500">Cargando...</p>
          </div>
        </Card>
      );
    }

    return (
      <Card key={typeId} className="mt-6">
        <h3 className="mb-3 text-lg font-medium uppercase tracking-[0.12em] text-gray-700 flex items-center gap-2">
          <span className="rounded-full bg-indigo-100 text-indigo-700 px-2 py-1 text-xs font-semibold">{typeLabel}</span>
          ({pagination.total})
        </h3>
        {requests.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No hay solicitudes de {typeLabel.toLowerCase()} registradas.</p>
        ) : (
          <>
            <div className="space-y-3">
              {requests.map(request => (
                <div key={request._id} className="rounded border border-slate-200 bg-slate-50 p-4">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div>
                      <p className="text-xs uppercase font-bold text-slate-600">Fecha inicio</p>
                      <p className="text-sm text-slate-700">{formatDate(request.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-slate-600">Fecha fin</p>
                      <p className="text-sm text-slate-700">{formatDate(request.endDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-slate-600">Días</p>
                      <p className="text-sm text-slate-700">{request.days}</p>
                    </div>
                    <div className="md:col-span-3">
                      <p className="text-xs uppercase font-bold text-slate-600">Descripción</p>
                      <p className="text-sm text-slate-700">{request.description}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-slate-600">Estado</p>
                      {getStatusBadge(request.status || 'enviada')}
                    </div>
                    <div>
                      <p className="text-xs uppercase font-bold text-slate-600">Fecha solicitud</p>
                      <p className="text-sm text-slate-700">{formatDateTime(request.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {renderPagination(typeId)}
          </>
        )}
      </Card>
    );
  };

  return (
    <>
      <PageTitle title="Solicitudes de Nómina" />

      <div className="mb-6 flex flex-wrap gap-3">
        {requestTypes.map(type => (
          <button
            key={type.id}
            type="button"
            onClick={() => setSelectedType(type.id)}
            className={`px-4 py-2 rounded-full font-semibold transition ${
              selectedType === type.id
                ? 'bg-gradient text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-300'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {successMessage && (
        <div className="mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-green-700">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {errorMessage}
        </div>
      )}

      <SelectedForm employeeName={employeeName} onSubmit={handleSubmit} />

      <div className="mt-8">
        <h2 className="mb-4 text-xl font-bold uppercase tracking-[0.12em] text-slate-700">Historial de solicitudes</h2>
        {requestTypes.map(type => renderHistorySection(type.id, type.label))}
      </div>
    </>
  );
};

export default PayrollRequests;