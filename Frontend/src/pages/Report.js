import React, {
  useContext,
  useState,
  useEffect
} from 'react';
import PageTitle from '../components/common/PageTitle';
import Card from '../components/common/Card';
import GradientButton from '../components/common/GradientButton';
import { FetchContext } from '../context/FetchContext';
import FormError from '../components/FormError';
import FormSuccess from '../components/FormSuccess';

const Report = () => {
  const fetchContext = useContext(FetchContext);
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [esquemas, setEsquemas] = useState([]);
  const [periodos, setPeriodos] = useState([]);
  const [selectedEsquema, setSelectedEsquema] = useState('');
  const [selectedPeriodo, setSelectedPeriodo] = useState('');
  const [loadingFiltros, setLoadingFiltros] = useState(false);
  const [generating, setGenerating] = useState(false);

  // El backend declara en reports.config.json qué reportes piden esquema y
  // periodo, así que los filtros se muestran según el reporte elegido y no
  // según su nombre.
  const selectedReportData = reports.find(report => report.id === selectedReport);
  const needsPlanillaFilters = ((selectedReportData && selectedReportData.filters) || []).indexOf('esquema') !== -1;

  useEffect(() => {
    const loadReports = async () => {
      try {
        const { data } = await fetchContext.authAxios.get('/reports');
        setReports(data.reports || []);
      } catch (err) {
        console.error(err);
        setErrorMessage('No se pudieron cargar los reportes disponibles.');
      }
    };

    loadReports();
  }, [fetchContext.authAxios]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  useEffect(() => {
    if (!needsPlanillaFilters) {
      return undefined;
    }

    let cancelled = false;

    const loadFiltros = async () => {
      setLoadingFiltros(true);

      try {
        const { data } = await fetchContext.authAxios.get('/reports/filtros/planilla', {
          params: selectedEsquema ? { esquema: selectedEsquema } : {}
        });

        if (cancelled) return;

        // El backend solo consulta los esquemas cuando aún no hay uno
        // seleccionado y en ese caso devuelve lista vacía, por eso se mira el
        // contenido y no solo que el campo exista: una lista vacía borraría la
        // selección del esquema.
        if (Array.isArray(data.esquemas) && data.esquemas.length > 0) {
          setEsquemas(data.esquemas);
        }
        setPeriodos(data.periodos || []);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setEsquemas([]);
        setPeriodos([]);
        setErrorMessage('No se pudieron cargar los esquemas y periodos de planilla.');
      } finally {
        if (!cancelled) {
          setLoadingFiltros(false);
        }
      }
    };

    loadFiltros();

    return () => {
      cancelled = true;
    };
  }, [fetchContext.authAxios, needsPlanillaFilters, selectedEsquema]);

  const handleReportChange = (e) => {
    setSelectedReport(e.target.value);
    setSelectedEsquema('');
    setSelectedPeriodo('');
    setEsquemas([]);
    setPeriodos([]);
    setSuccessMessage('');
    setErrorMessage('');
    setPdfUrl('');
  };

  const handleEsquemaChange = (e) => {
    setSelectedEsquema(e.target.value);
    setSelectedPeriodo('');
  };

  const handleGenerateReport = async () => {
    if (!selectedReport) {
      return;
    }

    if (needsPlanillaFilters && (!selectedEsquema || !selectedPeriodo)) {
      setSuccessMessage('');
      setErrorMessage('Debe seleccionar el esquema y el periodo del reporte.');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setGenerating(true);

    try {
      const params = {};
      if (needsPlanillaFilters) {
        params.esquema = selectedEsquema;
        params.periodo = selectedPeriodo;
      }

      const endpoint = `/reports/${selectedReport}`;
      const response = await fetchContext.authAxios.get(endpoint, { responseType: 'blob', params });

      const fileBlob = new Blob([response.data], {
        type: 'application/pdf'
      });
      const url = URL.createObjectURL(fileBlob);
      setPdfUrl(url);
      setSuccessMessage('Reporte generado correctamente.');
    } catch (err) {
      console.error(err);
      setPdfUrl('');

      // Con responseType blob los errores llegan como Blob, así que el mensaje
      // JSON del backend hay que leerlo como texto.
      if (err.response && err.response.data) {
        const data = err.response.data;
        const raw = typeof data.text === 'function' ? await data.text() : data;
        let message = '';
        try {
          message = JSON.parse(raw).message || '';
        } catch (parseErr) {
          message = '';
        }
        setErrorMessage(message || 'No se pudo generar el reporte solicitado.');
      } else {
        setErrorMessage('Error de conexión al servidor de reportes.');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateLatestReport = async () => {
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetchContext.authAxios.get('/reports/latest', { responseType: 'blob' });

      const fileBlob = new Blob([response.data], {
        type: 'application/pdf'
      });
      const url = URL.createObjectURL(fileBlob);
      setPdfUrl(url);
      setSuccessMessage('Reporte generado correctamente.');
    } catch (err) {
      console.error(err);
      setPdfUrl('');

      if (err.response && err.response.data) {
        setErrorMessage('Error al generar el último reporte.');
      } else {
        setErrorMessage('Error de conexión al servidor de reportes.');
      }
    }
  };

  return (
    <>
      <PageTitle title="Reportes" />
      <Card>
        <h2 className="font-bold mb-2">Consulta tus reportes aquí</h2>
        {successMessage && <FormSuccess text={successMessage} />}
        {errorMessage && <FormError text={errorMessage} />}
        <div className="mb-4">
          <label htmlFor="reportSelect" className="block text-sm font-medium text-gray-700 mb-2">
            Selecciona un reporte:
          </label>
          <select
            id="reportSelect"
            value={selectedReport}
            onChange={handleReportChange}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          
          >
                  <option value="">Selecciona...</option>
                  {reports.map((report) => (
                    <option key={report.id} value={report.id}>
                      {report.label}
                    </option>
                  ))}
          </select>

          {needsPlanillaFilters && (
            <div className="mt-4">
              <div className="mb-4">
                <label htmlFor="esquemaSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  Esquema:
                </label>
                <select
                  id="esquemaSelect"
                  value={selectedEsquema}
                  onChange={handleEsquemaChange}
                  disabled={loadingFiltros}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">{loadingFiltros ? 'Cargando...' : 'Selecciona...'}</option>
                  {esquemas.map((esquema) => (
                    <option key={esquema} value={esquema}>
                      {esquema}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="periodoSelect" className="block text-sm font-medium text-gray-700 mb-2">
                  Periodo:
                </label>
                <select
                  id="periodoSelect"
                  value={selectedPeriodo}
                  onChange={(e) => setSelectedPeriodo(e.target.value)}
                  disabled={loadingFiltros || !selectedEsquema}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="">
                    {loadingFiltros ? 'Cargando...' : 'Selecciona...'}
                  </option>
                  {periodos.map((periodo) => (
                    <option key={periodo} value={periodo}>
                      {periodo}
                    </option>
                  ))}
                </select>
                {!selectedEsquema && (
                  <p className="mt-1 text-xs text-gray-500">Selecciona primero el esquema.</p>
                )}
              </div>
            </div>
          )}

          <GradientButton
            onClick={handleGenerateReport}
            disabled={!selectedReport || generating}
            text={generating ? 'Generando...' : 'Solicitar'}
          />
        </div>
{/*      Se coemntara la opción de generar el último reporte, ya que no es necesario en este momento 01-10-2026

        <div className="flex space-x-2">
          <GradientButton
            onClick={handleGenerateLatestReport}
            text="Generar reporte PDF"
          />
        </div>
*/}
        {pdfUrl && (
          <div className="mt-6">
            <h3 className="font-bold mb-2">Visor de PDF</h3>
            <iframe
              src={pdfUrl}
              width="100%"
              height="600px"
              style={{ border: '1px solid #ccc' }}
              title="Visor de Reporte PDF"
            />
          </div>
        )}
      </Card>
    </>
  );
};

export default Report;
