const mongoose = require('mongoose');

const operationalManagerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    role: {
      type: String,
      default: 'manager',
    },
    // If true, manager has access to all current and future client sites
    allSites: {
      type: Boolean,
      default: false,
    },
    // Specific client sites assigned to this manager (used if allSites is false)
    assignedClients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
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
        delete ret.password; // Never expose password in responses
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('OperationalManager', operationalManagerSchema);
