import React, {
  useContext,
  useEffect,
  useState
} from 'react';
import PageTitle from '../components/common/PageTitle';
import { FetchContext } from '../context/FetchContext';
import InventoryItemForm from './../components/InventoryItemForm';
import DangerButton from './../components/common/DangerButton';
import FormError from './../components/FormError';
import FormSuccess from './../components/FormSuccess';

const InventoryItemContainer = ({ children }) => (
  <div className="bg-white rounded shadow-md mb-4 p-4">
    {children}
  </div>
);

const InventoryItem = ({ item, onDelete }) => {
  const handleDownload = () => {
    try {
      // Si image es una ruta del servidor, descargar directamente
      if (item.image && item.image.startsWith('/api/attachments')) {
        const link = document.createElement('a');
        // Construir URL sin duplicar /api
        const baseURL = process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '');
        link.href = baseURL + item.image;
        link.download = item.name || item.itemNumber || 'archivo';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (item.image && item.image.startsWith('data:')) {
        // Si es base64, usar el método anterior
        const link = document.createElement('a');
        link.href = item.image;
        link.download = item.name || 'archivo';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Error al descargar archivo:', err);
      alert('Error al descargar el archivo');
    }
  };

  return (
    <div className="flex">
      
      <div className="flex justify-between w-full">
        <div className="flex flex-col ml-4 justify-between">
          <div>
            <p className="font-bold text-xl text-gray-900">
              {item.name}
            </p>
            <p className="text-sm text-gray-600">
              {item.itemNumber}
            </p>
          </div>

        </div>
        <div className="self-end flex gap-2">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 focus:outline-none shadow-lg"
            onClick={handleDownload}
            title="Descargar archivo"
          >
            Descargar
          </button>
          <DangerButton
            text="Eliminar"
            onClick={() => onDelete(item)}
          />
        </div>
      </div>
    </div>
  );
};

const NewInventoryItem = ({ onSubmit }) => {
  return (
    <section className="bg-white p-4 shadow-md rounded-md">
      <p className="font-bold mb-2">Cargar nuevo Archivo</p>
      <InventoryItemForm onSubmit={onSubmit} />
    </section>
  );
};

const Inventory = () => {
  const fetchContext = useContext(FetchContext);
  const [inventory, setInventory] = useState([]);
  const [successMessage, setSuccessMessage] = useState();
  const [errorMessage, setErrorMessage] = useState();

  useEffect(() => {
    const getInventory = async () => {
      try {
        const { data } = await fetchContext.authAxios.get(
          'inventory'
        );
        setInventory(data);
      } catch (err) {
        console.log('the err', err);
      }
    };

    getInventory();
  }, [fetchContext]);

  const onSubmit = async (values, resetForm) => {
    try {
      const formData = new FormData();
      formData.append('name', values.name);
      formData.append('itemNumber', values.itemNumber);

      const { data } = await fetchContext.authAxios.post(
        'inventory',
        formData
      );
      setInventory([...inventory, data.inventoryItem]);
      resetForm();
      setSuccessMessage(data.message);
      setErrorMessage(null);
    } catch (err) {
      const { data } = err.response;
      setSuccessMessage(null);
      setErrorMessage(data.message);
    }
  };

  const onDelete = async item => {
    try {
      if (
        window.confirm(
          '¿Esta seguro de que quiere eliminar este archivo?'
        )
      ) {
        const {
          data
        } = await fetchContext.authAxios.delete(
          `inventory/${item._id}`
        );
        setInventory(
          inventory.filter(
            item => item._id !== data.deletedItem._id
          )
        );
      }
    } catch (err) {
      const { data } = err.response;
      setErrorMessage(data.message);
    }
  };

  return (
    <>
      <PageTitle title="Adjuntos" />
      {successMessage && (
        <FormSuccess text={successMessage} />
      )}
      {errorMessage && <FormError text={errorMessage} />}
      <div className="mb-4">
        <NewInventoryItem onSubmit={onSubmit} />
      </div>
      {inventory && inventory.length
        ? inventory.map(item => (
            <InventoryItemContainer key={item._id}>
              <InventoryItem
                item={item}
                onDelete={onDelete}
              />
            </InventoryItemContainer>
          ))
        : 'No Inventory Items'}
    </>
  );
};

export default Inventory;
