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

const createPasswordResetEmailBody = ({ name, resetLink }) => {
  const recipientName = name || 'usuario';

  return {
    text: [
      `Hola ${recipientName},`,
      '',
      'Hemos recibido una solicitud para recuperar la contraseña de tu cuenta.',
      'Haz clic en el siguiente enlace para restablecerla:',
      resetLink,
      '',
      'Si tú no solicitaste este cambio, puedes ignorar este correo de forma segura.',
      '',
      'Este enlace expirará en 1 hora.'
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="margin-bottom: 16px; color: #0f172a;">Recuperación de contraseña</h2>
        <p>Hola <strong>${recipientName}</strong>,</p>
        <p>Hemos recibido una solicitud para recuperar la contraseña de tu cuenta.</p>
        <p>Haz clic en el siguiente enlace para restablecerla:</p>
        <p><a href="${resetLink}" style="color: #2563eb;">Restablecer contraseña</a></p>
        <p>Si tú no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
        <p>Este enlace expirará en 1 hora.</p>
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

const sendPasswordResetEmail = async ({ email, name, resetLink }) => {
  const emailBody = createPasswordResetEmailBody({ name, resetLink });

  if (!emailConfig.auth.user || !emailConfig.auth.pass) {
    return {
      mocked: true,
      recipients: [email],
      subject: 'Recuperación de contraseña',
      message: 'No hay credenciales SMTP configuradas. El correo de recuperación quedó en modo simulado.',
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
      to: email,
      subject: 'Recuperación de contraseña',
      text: emailBody.text,
      html: emailBody.html
    });

    return {
      mocked: false,
      recipients: [email],
      subject: 'Recuperación de contraseña',
      messageId: info.messageId
    };
  } catch (error) {
    return {
      mocked: true,
      recipients: [email],
      subject: 'Recuperación de contraseña',
      message: `El envío por correo falló por error SMTP: ${error.message}`,
      error: error.message,
      preview: emailBody.text
    };
  }
};

module.exports = {
  sendPayrollRequestEmail,
  sendPasswordResetEmail
};
