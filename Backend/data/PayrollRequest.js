const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const payrollRequestModel = new Schema({
  user: { type: mongoose.Types.ObjectId, required: true, ref: 'user' },
  email: { type: String, required: true },
  employeeName: { type: String, required: true },
  firstName: { type: String },
  lastName: { type: String },
  requestType: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  days: { type: Number, required: true },
  description: { type: String, required: true },
  recipients: [{ type: String }],
  status: { type: String, default: 'enviada' },
  emailResult: { type: Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('payroll-request', payrollRequestModel);