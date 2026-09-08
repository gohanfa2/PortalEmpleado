import React, { useState } from 'react';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import { useLocation } from 'react-router-dom';
import Card from '../components/common/Card';
import Hyperlink from '../components/common/Hyperlink';
import Label from '../components/common/Label';
import FormInput from '../components/FormInput';
import FormSuccess from '../components/FormSuccess';
import FormError from '../components/FormError';
import GradientBar from '../components/common/GradientBar';
import GradientButton from '../components/common/GradientButton';
import { publicFetch } from '../util/fetch';
import logo from '../images/logo.png';

const ResetPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .required('La contraseña es obligatoria')
    .min(6, 'La contraseña debe tener al menos 6 caracteres')
    .matches(/[A-Z]/, 'Debe incluir al menos una mayúscula')
    .matches(/\d/, 'Debe incluir al menos un número')
    .matches(/[^A-Za-z0-9]/, 'Debe incluir al menos un símbolo')
});

const ResetPassword = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');

  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitResetPassword = async ({ password }) => {
    if (!token) {
      setErrorMessage('El token de recuperación no es válido o está ausente.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      setSuccessMessage('');

      const { data } = await publicFetch.post('auth/reset-password', {
        token,
        password
      });

      setSuccessMessage(data.message);
    } catch (error) {
      const message = error?.response?.data?.message || 'No se pudo actualizar la contraseña.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="w-full sm:w-1/2 h-screen m-auto p-8 sm:pt-10">
      <GradientBar />
      <Card>
        <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full">
            <div>
              <div className="w-32 m-auto mb-6">
                <img src={logo} alt="Logo" />
              </div>
              <h2 className="mb-2 text-center text-3xl leading-9 font-extrabold text-gray-900">
                Establece tu nueva contraseña
              </h2>
              <p className="text-gray-600 text-center">
                Usa una contraseña segura con al menos 6 caracteres, mayúscula, número y símbolo.
              </p>
            </div>

            {!token && (
              <div className="mt-6">
                <FormError text="El enlace de recuperación no es válido. Solicita uno nuevo." />
              </div>
            )}

            {token && (
              <Formik
                initialValues={{ password: '' }}
                onSubmit={submitResetPassword}
                validationSchema={ResetPasswordSchema}
              >
                {() => (
                  <Form className="mt-8">
                    {successMessage && <FormSuccess text={successMessage} />}
                    {errorMessage && <FormError text={errorMessage} />}

                    <div className="mb-4">
                      <div className="mb-1">
                        <Label text="Nueva contraseña" />
                      </div>
                      <FormInput
                        ariaLabel="New password"
                        name="password"
                        type="password"
                        placeholder="Nueva contraseña"
                      />
                    </div>

                    <div className="mt-6">
                      <GradientButton
                        type="submit"
                        text="Guardar contraseña"
                        loading={isSubmitting}
                      />
                    </div>

                    <div className="mt-6 text-center text-sm">
                      <Hyperlink to="/login" text="Volver al inicio de sesión" />
                    </div>
                  </Form>
                )}
              </Formik>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
};

export default ResetPassword;
