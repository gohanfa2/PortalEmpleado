import React, {
    useState,
    useContext,
    useEffect
  } from 'react';
  import PageTitle from '../components/common/PageTitle';
  import DashboardMetric from './../components/DashboardMetric';
  import { FetchContext } from '../context/FetchContext';
  
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
              <div className="w-full sm:w-1/3 sm:mr-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Tipo Documento"
                  value={curriculumData.hdv_doc}
                />
              </div>
              <div className="w-full sm:w-1/3 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Número Documento"
                  value={curriculumData.hdv_documento}
                />
              </div>
            </div>
            <div className="mb-4 flex flex-col sm:flex-row">
              <div className="w-full sm:w-1/3 sm:mr-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Nombres"
                  value={curriculumData.hdv_nombre}
                />
              </div>
              <div className="w-full sm:w-1/3 sm:ml-2 sm:mr-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Apellidos"
                  value={curriculumData.hdv_apellido}
                />
              </div>
              <div className="w-full sm:w-1/3 sm:ml-2 mb-4 sm:mb-0">
                <DashboardMetric
                  title="Correo Electronico"
                  value={curriculumData.hdv_correo}
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