const mongoose = require('mongoose');

const partTimePunchSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'PartTimeDriver', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    punchInTime: { type: Date },
    punchOutTime: { type: Date },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String, default: '' },
    },
    token: { type: String }, // The shared token used for this punch
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

partTimePunchSchema.index({ driver: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('PartTimePunch', partTimePunchSchema);
