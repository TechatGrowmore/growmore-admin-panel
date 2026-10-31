const mongoose = require('mongoose');

const dayScheduleSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true }, // YYYY-MM-DD
    fullTimeDrivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    // Kept in sync with partTimeAssignments (just the driver ids)
    partTimeDrivers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PartTimeDriver' }],
    // Per-day venue + pay for each part-time driver
    partTimeAssignments: [
      {
        _id: false,
        driver: { type: mongoose.Schema.Types.ObjectId, ref: 'PartTimeDriver', required: true },
        venue: { type: mongoose.Schema.Types.ObjectId, ref: 'Venue', required: true },
        venueName: { type: String, default: '' }, // snapshot so history survives renames
        amount: { type: Number, required: true, min: 0 },
      },
    ],
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
