const nodemailer = require('nodemailer');
const { emailConfig } = require('../config/emailConfig');

const formatRequestLabel = requestType =>
  String(requestType || 'solicitud')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());

const createEmailBody = ({ employeeName, requestType, startDate, endDate, description, days }) => {
  const requestLabel = formatRequestLabel(requestType);

  return {
    text: [
      `Solicitud de ${requestLabel}`,
      '',
      `Empleado: ${employeeName}`,
      `Tipo de solicitud: ${requestLabel}`,
      `Fecha inicio: ${startDate}`,
      `Fecha fin: ${endDate}`,
      `Días solicitados: ${days}`,
      '',
      'Descripción:',
      description
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="margin-bottom: 16px; color: #0f172a;">Solicitud de ${requestLabel}</h2>
        <p><strong>Empleado:</strong> ${employeeName}</p>
        <p><strong>Tipo de solicitud:</strong> ${requestLabel}</p>
        <p><strong>Fecha inicio:</strong> ${startDate}</p>
        <p><strong>Fecha fin:</strong> ${endDate}</p>
        <p><strong>Días solicitados:</strong> ${days}</p>
        <p><strong>Descripción:</strong></p>
        <p>${String(description).replace(/\n/g, '<br />')}</p>
      </div>
    `
  };
};

const sendPayrollRequestEmail = async ({
  employeeName,
  requestType,
  startDate,
  endDate,
  description,
  days,
  recipients = emailConfig.recipients
}) => {
  const validRecipients = (recipients || [])
    .map(email => String(email).trim())
    .filter(Boolean);

  const destination = validRecipients.length ? validRecipients : emailConfig.recipients;
  const requestLabel = formatRequestLabel(requestType);
  const emailBody = createEmailBody({ employeeName, requestType, startDate, endDate, description, days });

  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    return {
      mocked: true,
      recipients: destination,
      subject: `Solicitud de ${requestLabel} - ${employeeName}`,
      message: 'No hay credenciales SMTP configuradas. El correo quedó en modo simulado.',
      preview: emailBody.text
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: emailConfig.auth
    });

    const info = await transporter.sendMail({
      from: emailConfig.from,
      to: destination.join(', '),
      subject: `Solicitud de ${requestLabel} - ${employeeName}`,
      text: emailBody.text,
      html: emailBody.html
    });

    return {
      mocked: false,
      recipients: destination,
      subject: `Solicitud de ${requestLabel} - ${employeeName}`,
      messageId: info.messageId
    };
  } catch (error) {
    return {
      mocked: true,
      recipients: destination,
      subject: `Solicitud de ${requestLabel} - ${employeeName}`,
      message: `El envío por correo falló por error SMTP: ${error.message}`,
      error: error.message,
      preview: emailBody.text
    };
  }
};

module.exports = {
  sendPayrollRequestEmail
};
