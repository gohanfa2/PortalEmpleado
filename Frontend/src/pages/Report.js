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

  const handleGenerateReport = async () => {
    if (!selectedReport) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetchContext.authAxios.get(
        `/reports/${selectedReport}`,
        {
          responseType: 'blob'
        }
      );

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
        setErrorMessage('Error al generar el reporte.');
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
            onChange={(e) => setSelectedReport(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">Selecciona...</option>
            {reports.map((report) => (
              <option key={report.id} value={report.id}>
                {report.label}
              </option>
            ))}
          </select>
        </div>
        <GradientButton
          onClick={handleGenerateReport}
          disabled={!selectedReport}
          text="Generar Reporte"
        />

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
