import React, { useState } from 'react';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
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

const ForgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email('Ingresa un correo electrónico válido')
    .required('El correo es obligatorio')
});

const ForgotPassword = () => {
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitForgotPassword = async ({ email }) => {
    try {
      setIsSubmitting(true);
      setErrorMessage('');
      setSuccessMessage('');

      const { data } = await publicFetch.post('auth/forgot-password', {
        email: email.trim().toLowerCase()
      });

      setSuccessMessage(data.message);
    } catch (error) {
      const message = error?.response?.data?.message || 'No se pudo enviar el enlace de recuperación.';
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
                Recupera tu contraseña
              </h2>
              <p className="text-gray-600 text-center">
                Ingresa tu correo para recibir un enlace de recuperación.
              </p>
            </div>

            <Formik
              initialValues={{ email: '' }}
              onSubmit={submitForgotPassword}
              validationSchema={ForgotPasswordSchema}
            >
              {() => (
                <Form className="mt-8">
                  {successMessage && <FormSuccess text={successMessage} />}
                  {errorMessage && <FormError text={errorMessage} />}

                  <div className="mb-4">
                    <div className="mb-1">
                      <Label text="Correo electrónico" />
                    </div>
                    <FormInput
                      ariaLabel="Email"
                      name="email"
                      type="email"
                      placeholder="Correo electrónico"
                    />
                  </div>

                  <div className="mt-6">
                    <GradientButton
                      type="submit"
                      text="Enviar enlace"
                      loading={isSubmitting}
                    />
                  </div>

                  <div className="mt-6 text-center text-sm">
                    <Hyperlink to="/login" text="Volver al inicio de sesión" />
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </Card>
    </section>
  );
};

export default ForgotPassword;
