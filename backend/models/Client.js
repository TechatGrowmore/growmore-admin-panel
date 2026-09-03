const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    apiUrl: {
      type: String,
      required: true,
      trim: true,
      set: (v) => v.replace(/\/$/, ''), // strip trailing slash
    },
    apiKey: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
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

module.exports = mongoose.model('Client', clientSchema);
