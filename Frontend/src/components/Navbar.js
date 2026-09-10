import React, { useEffect, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import AvatarDropdown from './AvatarDropdown';

const SearchInput = ({ value, onChange, onSubmit }) => (
  <form onSubmit={onSubmit} className="flex">
    <input
      className="py-2 px-4 border bg-gray-100 border-gray-300 rounded-full focus:outline-none w-32 sm:w-64"
      placeholder="Buscar por contrato, documento, nombres o apellidos"
      value={value}
      onChange={event => onChange(event.target.value)}
    />
    <button
      type="submit"
      className="rounded-full bg-gradient px-4 ml-2 text-white flex items-center text-xs focus:outline-none shadow-lg"
      aria-label="Buscar"
    >
      <FontAwesomeIcon icon={faArrowRight} />
    </button>
  </form>
);

const Navbar = () => {
  const history = useHistory();
  const location = useLocation();
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchValue(params.get('q') || '');
  }, [location.search]);

  const handleSubmit = event => {
    event.preventDefault();

    const cleanValue = searchValue.trim();
    const nextRoute = cleanValue
      ? `/users?q=${encodeURIComponent(cleanValue)}`
      : '/users';

    history.push(nextRoute);
  };

  return (
    <nav className="flex justify-between px-4">
      <div className="">
        <SearchInput
          value={searchValue}
          onChange={setSearchValue}
          onSubmit={handleSubmit}
        />
      </div>
      <div className="">
        <AvatarDropdown />
      </div>
    </nav>
  );
};

export default Navbar;
