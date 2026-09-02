import React from 'react';
import BaseRequestForm from './BaseRequestForm';

const PermissionRequestForm = ({ employeeName, onSubmit }) => (
  <BaseRequestForm
    employeeName={employeeName}
    type="permisos"
    title="Permisos"
    helperText="Indica el motivo y el rango de fechas para la solicitud de permiso."
    onSubmit={onSubmit}
  />
);

export default PermissionRequestForm;
