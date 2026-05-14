import React, { useState, useContext, useEffect } from 'react';
import PageTitle from '../components/common/PageTitle';
import DashboardMetric from '../components/DashboardMetric';
import { FetchContext } from '../context/FetchContext';


const Employee = () => {
  const fetchContext = useContext(FetchContext);
  const [employeeData, setEmployeeData] = useState();
  const [errorMessage, setErrorMessage] = useState();

  useEffect(() => {
    const getEmployeeData = async () => {
      try {
        const { data } = await fetchContext.authAxios.get('employee');
        setEmployeeData(data);
      } catch (err) {
        console.error(err);
        setErrorMessage('No se pudo cargar la información del empleado.');
      }
    };

    getEmployeeData();
  }, [fetchContext]);

  return (
    <>
      <PageTitle title="Empleado" />
      {errorMessage ? (
        <p>{errorMessage}</p>
      ) : employeeData ? (
        <>
           <div className="mb-4 flex flex-col sm:flex-row">
            <div className="w-full sm:w-1/6 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Número Contrato"
                value={employeeData.EMP_CODIGO || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Nombres"
                value={employeeData.EMP_NOMBRE || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Apellidos"
                value={employeeData.EMP_APELLIDO || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Cargo"
                value={employeeData.CAR_DESC || '-'}
              />
            </div>
            
          </div>

          <div className="mb-4 flex flex-col sm:flex-row">
            <div className="w-full sm:w-1/4 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Inicio Contrato"
                value={new Date(employeeData.EMP_FECINICNT).toLocaleDateString('es-ES')}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Fin Contrato"
                value={new Date(employeeData.EMP_FECFINCNT).toLocaleDateString('es-ES') || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Sueldo"
                value={employeeData.EMP_SUELDO.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }) || '-'}
              />
            </div>
          </div>

          <div className="mb-4 flex flex-col sm:flex-row">
            <div className="w-full sm:w-1/4 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Dependencia"
                value={employeeData.DEP_NOMBRE || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Centro de Costos"
                value={employeeData.CDC_NOMBRE || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Subcentro de Costos"
                value={employeeData.SCC_NOMBRE || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Centro de Trabajo"
                value={employeeData.CDT_NOMBRE || '-'}
              />
            </div>
          </div>

          <div className="mb-4 flex flex-col sm:flex-row">
            <div className="w-full sm:w-1/4 sm:ml-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Tipo Cotizante"
                value={employeeData.COT_NOMBRE || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Subtipo Cotizante"
                value={employeeData.STC_NOMBRE || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Grupo Laboral"
                value={employeeData.GRP_NOMBRE || '-'}
              />
            </div>
          </div>


          <p><br /></p>
          Entidades
          <p><br /></p>

          <div className="mb-4 flex flex-col sm:flex-row">
            <div className="w-full sm:w-1/4 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="EPS"
                value={employeeData.EPS_NOMBRE || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="AFP"
                value={employeeData.AFP_NOMBRE || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="ARL"
                value={employeeData.ARP_NOMBRE || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Caja Compensación"
                value={employeeData.CCF_NOMBRE || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Cesantias"
                value={employeeData.AFP_CESANTIA || '-'}
              />
            </div>
            <div className="w-full sm:w-1/4 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
              <DashboardMetric
                title="Banco"
                value={employeeData.BAN_NOMBRE || '-'}
              />
            </div>
          </div>

        </>
      ) : (
        <p>Loading...</p>
      )}
    </>
  );
};

export default Employee;
