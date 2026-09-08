const crypto = require('crypto');
const User = require('../data/User');
const { hashPassword } = require('../util');
const { sendPasswordResetEmail } = require('./emailService');

const validatePasswordStrength = password => {
  if (typeof password !== 'string') {
    return false;
  }

  return (
    password.length >= 6 &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

const generateResetToken = () => crypto.randomBytes(32).toString('hex');

const requestPasswordReset = async (email, frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000') => {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error('El correo electrónico es obligatorio.');
  }

  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new Error('No existe una cuenta registrada con ese correo.');
  }

  const resetToken = generateResetToken();
  const resetPasswordExpires = Date.now() + 60 * 60 * 1000;

  await User.updateOne(
    { _id: user._id },
    {
      resetPasswordToken: resetToken,
      resetPasswordExpires: resetPasswordExpires
    }
  );

  const resetLink = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`;
  const emailResult = await sendPasswordResetEmail({
    email: user.email,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    resetLink
  });

  return {
    message:
      'Si el correo existe en nuestro sistema, hemos enviado un enlace para recuperar tu contraseña.',
    emailResult
  };
};

const resetPassword = async (token, newPassword) => {
  const resetToken = String(token || '').trim();

  if (!resetToken) {
    throw new Error('El token de recuperación es obligatorio.');
  }

  if (!validatePasswordStrength(newPassword)) {
    throw new Error(
      'La contraseña debe tener mínimo 6 caracteres, incluir una mayúscula, un número y un símbolo.'
    );
  }

  const user = await User.findOne({
    resetPasswordToken: resetToken,
    resetPasswordExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw new Error('El enlace de recuperación es inválido o ha expirado.');
  }

  user.password = await hashPassword(newPassword);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  return {
    message: 'Tu contraseña ha sido actualizada correctamente.'
  };
};

module.exports = {
  requestPasswordReset,
  resetPassword,
  validatePasswordStrength
};
