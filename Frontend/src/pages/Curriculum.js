import React, {
    useState,
    useContext,
    useEffect
  } from 'react';
  import PageTitle from '../components/common/PageTitle';
  import DashboardMetric from './../components/DashboardMetric';
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
  
  const Curriculum = () => {
  const fetchContext = useContext(FetchContext);
  const [curriculumData, setCurriculumData] = useState();


  useEffect(() => {
    const getCurriculumData = async () => {
      try {
        const { data } = await fetchContext.authAxios.get(
          'curriculum'
        );
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
          <>
            <div className="mb-4 flex flex-col sm:flex-row">
              <div className="w-full sm:w-1/6 sm:mr-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Tipo Documento"
                  value={curriculumData.hdv_doc}
                />
              </div>
              <div className="w-full sm:w-1/4 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Número Documento"
                  value={curriculumData.hdv_documento}
                />
              </div>
              <div className="w-full sm:w-1/4 sm:ml-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Ciudad Expedición"
                  value={curriculumData.hdv_ciudadexp}
                />
              </div>
              <div className="w-full sm:w-1/4 sm:ml-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Nacionalidad"
                  value={curriculumData.hdv_nacionalidad}
                />
              </div>
              <div className="w-full sm:w-1/6 sm:ml-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Es empleado?"
                  value={esEmpleado[curriculumData.hdv_estado] || curriculumData.hdv_estado}
                />
              </div>
              <div className="w-full sm:w-1/5 sm:ml-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Fecha Creación"
                  value={new Date(curriculumData.hdv_feccrea).toLocaleDateString('es-ES')}
                />
              </div>
            </div>

            <p>
              <br />
            </p>

            <div className="mb-4 flex flex-col sm:flex-row">
              <div className="w-full sm:w-2/3 sm:mr-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Nombres"
                  value={curriculumData.hdv_nombre}
                />
              </div>
              <div className="w-full sm:w-2/3 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Apellidos"
                  value={curriculumData.hdv_apellido}
                />
              </div>
              <div className="w-full sm:w-2/3 sm:ml-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Dirección"
                  value={curriculumData.hdv_dir}
                />
              </div>  
            </div>

            <p>
              <br />
            </p>

              <div className="mb-4 flex flex-col sm:flex-row">
              <div className="w-full sm:w-1/6 sm:ml-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Teléfono Casa"
                  value={curriculumData.hdv_telefono}
                />
              </div>
             <div className="w-full sm:w-1/6 sm:ml-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Teléfono Oficina"
                  value={curriculumData.hdv_telefono2}
                />
              </div>
             <div className="w-full sm:w-1/6 sm:ml-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Teléfono Celular"
                  value={curriculumData.hdv_telefono3}
                />
              </div>
            </div>

            <p>
              <br />
            </p>

            <div className="mb-4 flex flex-col sm:flex-row">
              <div className="w-full sm:w-1/6 sm:mr-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Genero"
                  value={generoMap[curriculumData.hdv_sexo] || curriculumData.hdv_sexo}
                />
              </div>
              <div className="w-full sm:w-1/6 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Fecha Nacimiento"
                  value={new Date(curriculumData.hdv_fnac).toLocaleDateString('es-ES')}
                />
              </div>
              <div className="w-full sm:w-1/6 sm:ml-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Estado Civil"
                  value={estadoCivilMap[curriculumData.hdv_estciv] || curriculumData.hdv_estciv}
                />
              </div>
              <div className="w-full sm:w-1/3 sm:ml-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Correo Electronico"
                  value={curriculumData.hdv_correo}
                />
              </div>
            </div> 

            <p>
              <br />
            </p>

          <div className="mb-4 flex flex-col sm:flex-row">
              <div className="w-full sm:w-3/3 sm:mr-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Notas y Comentarios"
                  value={curriculumData.hdv_coment}
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
  
export default Curriculum;