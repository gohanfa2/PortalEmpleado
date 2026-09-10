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

export const fetchPayrollRequests = async (authAxios, { page = 1, limit = 10, requestType = null } = {}) => {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('limit', limit.toString());
  if (requestType) params.set('requestType', requestType);

  const { data } = await authAxios.get(`/payroll-requests?${params.toString()}`);
  return {
    requests: data.payrollRequests || [],
    pagination: data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1, hasNextPage: false, hasPrevPage: false }
  };
};
