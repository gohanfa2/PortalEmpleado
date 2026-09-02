import React from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import Card from '../common/Card';
import { calculateDaysRange } from '../../services/payrollRequestService';

const buildValidationSchema = () =>
  Yup.object({
    requestType: Yup.string().required('El tipo de solicitud es obligatorio.'),
    startDate: Yup.date().required('La fecha de inicio es obligatoria.'),
    endDate: Yup.date()
      .required('La fecha final es obligatoria.')
      .min(Yup.ref('startDate'), 'La fecha final no puede ser anterior a la inicial.'),
    description: Yup.string()
      .trim()
      .min(10, 'La descripción debe tener al menos 10 caracteres.')
      .required('La descripción es obligatoria.')
  });

const BaseRequestForm = ({
  employeeName,
  type,
  title,
  onSubmit,
  helperText
}) => {
  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        {helperText && (
          <p className="mt-1 text-sm text-gray-600">{helperText}</p>
        )}
      </div>

      <Formik
        initialValues={{
          employeeName,
          requestType: type,
          startDate: '',
          endDate: '',
          description: ''
        }}
        validationSchema={buildValidationSchema()}
        onSubmit={async (values, { setSubmitting, resetForm }) => {
          try {
            await onSubmit({
              ...values,
              employeeName
            });
            resetForm();
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ values, isSubmitting }) => {
          const daysCount = calculateDaysRange(
            values.startDate,
            values.endDate
          );

          return (
            <Form className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del empleado
                </label>
                <Field
                  name="employeeName"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700"
                  disabled
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de solicitud
                </label>
                <Field
                  as="select"
                  name="requestType"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled
                >
                  <option value="vacaciones">Vacaciones</option>
                  <option value="permisos">Permisos</option>
                  <option value="incapacidades">Incapacidades</option>
                </Field>
                <ErrorMessage
                  name="requestType"
                  component="div"
                  className="text-red-500 text-sm mt-1"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha de inicio
                  </label>
                  <Field
                    type="date"
                    name="startDate"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <ErrorMessage
                    name="startDate"
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Fecha final
                  </label>
                  <Field
                    type="date"
                    name="endDate"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <ErrorMessage
                    name="endDate"
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Días calculados
                </label>
                <div className="text-2xl font-bold text-blue-700">
                  {daysCount}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción
                </label>
                <Field
                  as="textarea"
                  name="description"
                  rows="5"
                  placeholder="Describe el motivo, fechas, situación o detalle relevante de la solicitud..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <ErrorMessage
                  name="description"
                  component="div"
                  className="text-red-500 text-sm mt-1"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full md:w-auto px-5 py-3 rounded-md bg-gradient text-white font-semibold shadow-md hover:opacity-90 disabled:opacity-60"
              >
                {isSubmitting ? 'Enviando...' : `Enviar solicitud de ${title.toLowerCase()}`}
              </button>
            </Form>
          );
        }}
      </Formik>
    </Card>
  );
};

export default BaseRequestForm;
