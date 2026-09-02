import React from 'react';
import BaseRequestForm from './BaseRequestForm';

const MedicalLeaveRequestForm = ({ employeeName, onSubmit }) => (
  <BaseRequestForm
    employeeName={employeeName}
    type="incapacidades"
    title="Incapacidades"
    helperText="Registra la incapacidad con la información necesaria para revisión y trámite."
    onSubmit={onSubmit}
  />
);

export default MedicalLeaveRequestForm;
