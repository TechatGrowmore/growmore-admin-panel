const mongoose = require('mongoose');

const dayScheduleSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    fullTimeDrivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    partTimeDrivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PartTimeDriver' }],
    notes: { type: String, default: '' },
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

module.exports = mongoose.model('DaySchedule', dayScheduleSchema);
