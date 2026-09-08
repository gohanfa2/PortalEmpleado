const { requestPasswordReset, resetPassword } = require('../services/authService');

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    const result = await requestPasswordReset(email);

    return res.status(200).json({
      message: result.message,
      email: result.emailResult
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || 'No se pudo procesar la solicitud de recuperación.'
    });
  }
};

const resetPasswordHandler = async (req, res) => {
  try {
    const { token, password } = req.body || {};
    const result = await resetPassword(token, password);

    return res.status(200).json({
      message: result.message
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || 'No se pudo restablecer la contraseña.'
    });
  }
};

module.exports = {
  forgotPassword,
  resetPassword: resetPasswordHandler
};
