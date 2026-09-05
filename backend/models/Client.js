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
    // Credentials for the client's backend admin user.
    // Used by the proxy to obtain a JWT when forwarding admin operations.
    adminPhone: {
      type: String,
      default: null,
    },
    adminPassword: {
      type: String,
      default: null,
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
