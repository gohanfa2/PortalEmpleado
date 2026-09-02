import React from 'react';
import BaseRequestForm from './BaseRequestForm';

const VacationRequestForm = ({ employeeName, onSubmit }) => (
  <BaseRequestForm
    employeeName={employeeName}
    type="vacaciones"
    title="Vacaciones"
    helperText="Solicita el periodo de descanso correspondiente al empleado."
    onSubmit={onSubmit}
  />
);

export default VacationRequestForm;
