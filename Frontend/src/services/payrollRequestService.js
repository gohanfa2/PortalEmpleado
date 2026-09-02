export const calculateDaysRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  if (end < start) {
    return 0;
  }

  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
};

export const submitPayrollRequest = async (authAxios, payload) => {
  const { data } = await authAxios.post('/payroll-requests', payload);
  return data;
};
