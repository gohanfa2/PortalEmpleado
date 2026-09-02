import React, { useContext, useState } from 'react';
import PageTitle from '../components/common/PageTitle';
import VacationRequestForm from '../components/payrollRequest/VacationRequestForm';
import PermissionRequestForm from '../components/payrollRequest/PermissionRequestForm';
import MedicalLeaveRequestForm from '../components/payrollRequest/MedicalLeaveRequestForm';
import { AuthContext } from '../context/AuthContext';
import { FetchContext } from '../context/FetchContext';
import { submitPayrollRequest } from '../services/payrollRequestService';

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

const PayrollRequests = () => {
  const auth = useContext(AuthContext);
  const fetchContext = useContext(FetchContext);
  const [selectedType, setSelectedType] = useState('vacaciones');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const employeeName = [
    auth.authState.userInfo.firstName,
    auth.authState.userInfo.lastName
  ]
    .filter(Boolean)
    .join(' ') || auth.authState.userInfo.email || 'Empleado';

  const handleSubmit = async values => {
    try {
      setSuccessMessage('');
      setErrorMessage('');

      const response = await submitPayrollRequest(fetchContext.authAxios, values);
      setSuccessMessage(response.message || 'Solicitud enviada correctamente.');
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
    </>
  );
};

export default PayrollRequests;
