const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    reason: { type: String, trim: true, default: '' },
    // pending = applied, approved = accountant approved, rejected = rejected, absent = auto-marked absent
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'absent'],
      default: 'pending',
    },
    accountantRemarks: { type: String, default: '' },
    reviewedBy: { type: String, default: '' },
    reviewedAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

leaveSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Leave', leaveSchema);
