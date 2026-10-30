const mongoose = require('mongoose');

const punchInSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD format
    punchInTime: { type: Date },
    punchOutTime: { type: Date },
    photoUrl: { type: String, default: '' }, // Cloudinary URL
    cloudinaryPublicId: { type: String, default: '' },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'leave'],
      default: 'present',
    },
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

// Compound index: one punch record per employee per day
punchInSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('PunchIn', punchInSchema);
