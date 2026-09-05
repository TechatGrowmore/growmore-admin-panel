const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    // User who performed the action
    user: {
      id: { type: String, default: null },
      name: { type: String, required: true },
      username: { type: String, required: true },
      role: { type: String, required: true }, // 'manager' | 'superadmin'
    },
    // Action category / code
    action: {
      type: String,
      required: true, // e.g. 'CREATE_BOOKING', 'DELETE_BOOKING', 'UPDATE_PAYMENT', 'ADD_DRIVER', 'UPDATE_DRIVER', 'DELETE_DRIVER', etc.
    },
    // Entity type
    entity: {
      type: String,
      required: true, // 'Booking', 'Driver', 'Supervisor', 'Venue', 'Payment'
    },
    // Client site context
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },
    clientName: {
      type: String,
      default: 'Unknown Site',
    },
    // Clear human-readable description for dashboard display
    // e.g. "Deleted booking BK-1029", "Added driver Rahul Sharma", "Updated venue Grand Ballroom"
    description: {
      type: String,
      required: true,
    },
    // Detailed payload or params
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
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

// Indexes for fast searching and filtering in the logs dashboard
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ 'user.username': 1 });
activityLogSchema.index({ clientId: 1 });
activityLogSchema.index({ entity: 1 });
activityLogSchema.index({ action: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
