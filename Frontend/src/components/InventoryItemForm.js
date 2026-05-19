import React from 'react';
import { Form, Formik } from 'formik';
import * as Yup from 'yup';
import Label from './../components/common/Label';
import FormInput from './../components/FormInput';
import GradientButton from './common/GradientButton';

const InventoryItemSchema = Yup.object().shape({
  name: Yup.string().required('Name is required'),
  itemNumber: Yup.mixed().required(
    'Seleccione un archivo valido'
  )
});

const InventoryItemForm = ({ onSubmit }) => {
  const handleFileChange = (e, setFieldValue) => {
    const file = e.currentTarget.files[0];
    if (file) {
      setFieldValue('itemNumber', file);
    }
  };

  return (
    <Formik
      initialValues={{
        name: '',
        itemNumber: null
      }}
      onSubmit={(values, { resetForm }) =>
        onSubmit(values, resetForm)
      }
      validationSchema={InventoryItemSchema}
      validateOnBlur={false}
    >
      {({ setFieldValue, values }) => (
        <Form>
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-1/2 mr-2 mb-2 sm:mb-0">
              <div className="mb-1">
                <Label text="Nombre Archivo" />
              </div>
              <FormInput
                ariaLabel="Name"
                name="name"
                type="text"
                placeholder="Nombre Archivo"
              />
            </div>
            <div className="w-full md:w-1/2 mr-2 mb-2 sm:mb-0">
              <div className="mb-1">
                <Label text="Cargar archivo" />
              </div>
              <input
                type="file"
                name="itemNumber"
                onChange={(e) => handleFileChange(e, setFieldValue)}
                className="w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:border-blue-500"
              />
              {values.itemNumber && (
                <small className="text-gray-600 block mt-1">
                  Archivo: {values.itemNumber.name}
                </small>
              )}
            </div>
          </div>
          <div className="flex">
            <div className="w-full sm:w-1/4 mt-4">
              <GradientButton type="submit" text="Cargar archivo" />
            </div>
          </div>
        </Form>
      )}
    </Formik>
  );
};

export default InventoryItemForm;
