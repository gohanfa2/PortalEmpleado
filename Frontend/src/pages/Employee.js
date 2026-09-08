import React, { useState, useContext, useEffect } from 'react';
import PageTitle from '../components/common/PageTitle';
import { FetchContext } from '../context/FetchContext';

const formatDate = (value) => {
  if (!value) return '—';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString('es-ES');
};

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '—';

  const number = Number(value);
  if (Number.isNaN(number)) return value;

  return number.toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  });
};

const InfoField = ({ label, value, className = '' }) => (
  <div className={`rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 ${className}`}>
    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-600">
      {label}
    </p>
    <p className="mt-1 text-sm font-normal text-slate-700 break-words leading-relaxed">
      {value || '—'}
    </p>
  </div>
);

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
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : employeeData ? (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
           

            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-6">
              <InfoField label="N° contrato" value={employeeData.EMP_CODIGO} />
              <InfoField label="Nombres" value={employeeData.EMP_NOMBRE} className="sm:col-span-2" />
              <InfoField label="Apellidos" value={employeeData.EMP_APELLIDO} className="sm:col-span-2" />
              <InfoField label="Cargo" value={employeeData.CAR_DESC} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">
                Contrato y remuneración
              </h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <InfoField label="Inicio contrato" value={formatDate(employeeData.EMP_FECINICNT)} />
              <InfoField label="Fin contrato" value={formatDate(employeeData.EMP_FECFINCNT)} />
              <InfoField label="Sueldo" value={formatCurrency(employeeData.EMP_SUELDO)} />
              <InfoField label="Dependencia" value={employeeData.DEP_NOMBRE} className="xl:col-span-2" />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">
                Organización
              </h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoField label="Centro de costos" value={employeeData.CDC_NOMBRE} />
              <InfoField label="Subcentro" value={employeeData.SCC_NOMBRE} />
              <InfoField label="Centro de trabajo" value={employeeData.CDT_NOMBRE} />
              <InfoField label="Grupo laboral" value={employeeData.GRP_NOMBRE} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">
                Cotizante y entidades
              </h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <InfoField label="Tipo cotizante" value={employeeData.COT_NOMBRE} />
              <InfoField label="Subtipo" value={employeeData.STC_NOMBRE} />
              <InfoField label="EPS" value={employeeData.EPS_NOMBRE} />
              <InfoField label="AFP" value={employeeData.AFP_NOMBRE} />
              <InfoField label="ARL" value={employeeData.ARP_NOMBRE} />
              <InfoField label="Banco" value={employeeData.BAN_NOMBRE} />
              <InfoField label="Caja comp." value={employeeData.CCF_NOMBRE} />
              <InfoField label="Cesantías" value={employeeData.AFP_CESANTIA} />
            </div>
          </section>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
          Cargando información...
        </div>
      )}
    </>
  );
};

export default Employee;
