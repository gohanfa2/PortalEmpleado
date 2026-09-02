const parseRecipients = () => {
  const rawRecipients = process.env.MAIL_RECIPIENTS || 'jfariza.colsin@gmail.com, nomina@colsin.com';

  return rawRecipients
    .split(',')
    .map(email => email.trim())
    .filter(Boolean);
};

const emailConfig = {
  service: process.env.MAIL_SERVICE || 'gmail',
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.MAIL_PORT || 587),
  secure: process.env.MAIL_SECURE === 'true',
  auth: {
    user: process.env.MAIL_USER || 'jfariza.colsin@gmail.com',
    pass: process.env.MAIL_PASS || 'tprdnrrvbzyqmzuf'
  },
  from: process.env.MAIL_FROM || process.env.MAIL_USER || 'jfariza.colsin@gmail.com',
  recipients: parseRecipients()
};

module.exports = {
  emailConfig,
  getEmailRecipients: () => parseRecipients()
};
