import React, {
  useState,
  useContext,
  useEffect
} from 'react';
import PageTitle from '../components/common/PageTitle';
import { FetchContext } from '../context/FetchContext';

const estadoCivilMap = {
  1: 'Soltero',
  2: 'Casado',
  3: 'Divorciado',
  4: 'Viudo',
  5: 'Unión Libre',
  6: 'Separado'
};

const esEmpleado = {
  1: 'SI',
  2: 'NO'
};

const generoMap = {
  M: 'Masculino',
  F: 'Femenino'
};

const formatDate = (value) => {
  if (!value) return '—';

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleDateString('es-ES');
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

const Curriculum = () => {
  const fetchContext = useContext(FetchContext);
  const [curriculumData, setCurriculumData] = useState(null);

  useEffect(() => {
    const getCurriculumData = async () => {
      try {
        const { data } = await fetchContext.authAxios.get('curriculum');
        setCurriculumData(data);
      } catch (err) {
        console.log(err);
      }
    };

    getCurriculumData();
  }, [fetchContext]);

  return (
    <>
      <PageTitle title="Hoja de Vida" />

      {curriculumData ? (
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        
            <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-6">
              <InfoField label="Tipo doc." value={curriculumData.hdv_doc} />
              <InfoField label="N° documento" value={curriculumData.hdv_documento} />
              <InfoField label="Expedición" value={curriculumData.hdv_ciudadexp} />
              <InfoField label="Nacionalidad" value={curriculumData.hdv_nacionalidad} />
              <InfoField label="Fecha creación" value={formatDate(curriculumData.hdv_feccrea)} />
              <InfoField label="Género" value={generoMap[curriculumData.hdv_sexo] || curriculumData.hdv_sexo} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">
                Datos personales
              </h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoField label="Nombres" value={curriculumData.hdv_nombre} className="md:col-span-2" />
              <InfoField label="Apellidos" value={curriculumData.hdv_apellido} className="md:col-span-2" />
              <InfoField label="Dirección" value={curriculumData.hdv_dir} className="md:col-span-2 xl:col-span-2" />
              <InfoField label="Fecha nacimiento" value={formatDate(curriculumData.hdv_fnac)} />
              <InfoField label="Estado civil" value={estadoCivilMap[curriculumData.hdv_estciv] || curriculumData.hdv_estciv} />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">
                Contacto y documentación
              </h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <InfoField label="Tel. casa" value={curriculumData.hdv_telefono} />
              <InfoField label="Tel. oficina" value={curriculumData.hdv_telefono2} />
              <InfoField label="Celular" value={curriculumData.hdv_telefono3} />
              <InfoField label="Correo" value={curriculumData.hdv_correo} className="xl:col-span-2" />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">
                Notas y comentarios
              </h3>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm leading-relaxed text-slate-700">
                {curriculumData.hdv_coment || 'Sin comentarios registrados.'}
              </p>
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

export default Curriculum;