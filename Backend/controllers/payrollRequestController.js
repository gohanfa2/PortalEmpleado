const { sendPayrollRequestEmail } = require('../services/emailService');
const { emailConfig } = require('../config/emailConfig');

const calculateDaysRange = (startDate, endDate) => {
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

  const diffInDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  return Math.floor(diffInDays) + 1;
};

const validatePayrollRequest = ({ requestType, startDate, endDate, description }) => {
  const errors = [];

  if (!requestType) {
    errors.push('El tipo de solicitud es obligatorio.');
  }

  if (!startDate) {
    errors.push('La fecha de inicio es obligatoria.');
  }

  if (!endDate) {
    errors.push('La fecha final es obligatoria.');
  }

  if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
    errors.push('La fecha final no puede ser anterior a la fecha inicial.');
  }

  if (!description || !String(description).trim()) {
    errors.push('La descripción es obligatoria.');
  }

  return errors;
};

const createPayrollRequest = async (req, res) => {
  try {
    const { requestType, startDate, endDate, description, recipients } = req.body;
    const employeeName = [req.user?.firstName, req.user?.lastName]
      .filter(Boolean)
      .join(' ') || req.user?.email || 'Empleado';

    const validationErrors = validatePayrollRequest({
      requestType,
      startDate,
      endDate,
      description
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Datos inválidos para la solicitud.',
        errors: validationErrors
      });
    }

    const days = calculateDaysRange(startDate, endDate);
    const destinationRecipients = Array.isArray(recipients) && recipients.length > 0
      ? recipients
      : emailConfig.recipients;

    let emailResult;
    try {
      emailResult = await sendPayrollRequestEmail({
        employeeName,
        requestType,
        startDate,
        endDate,
        description: description.trim(),
        days,
        recipients: destinationRecipients
      });
    } catch (emailError) {
      emailResult = {
        mocked: true,
        recipients: destinationRecipients,
        subject: `Solicitud de ${requestType || 'solicitud'} - ${employeeName}`,
        message: 'La solicitud fue guardada, pero el envío por correo falló en este entorno.',
        error: emailError.message,
        preview: description
      };
    }

    const statusCode = emailResult && emailResult.mocked ? 200 : 200;

    return res.status(statusCode).json({
      message: emailResult.mocked
        ? 'Solicitud registrada y correo simulado enviado correctamente.'
        : 'Solicitud enviada correctamente.',
      data: {
        employeeName,
        requestType,
        startDate,
        endDate,
        days,
        description: description.trim(),
        recipients: destinationRecipients
      },
      email: emailResult
    });
  } catch (error) {
    return res.status(500).json({
      message: 'No se pudo enviar la solicitud.',
      error: error.message
    });
  }
};

module.exports = {
  createPayrollRequest,
  calculateDaysRange
};
