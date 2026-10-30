const mongoose = require('mongoose');

const partTimeDriverSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    aadharDocUrl: { type: String, default: '' }, // Cloudinary URL
    aadharNumber: { type: String, trim: true, default: '' },
    address: { type: String, trim: true, default: '' },
    photoUrl: { type: String, default: '' }, // Cloudinary URL (registration photo)
    registrationDate: { type: Date, default: Date.now },

    // HR approval status
    // pending = submitted, approved = HR approved, rejected = HR rejected
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionRemarks: { type: String, default: '' },

    submittedViaPublicForm: { type: Boolean, default: false },
    publicFormToken: { type: String, default: '' },

    // Token for punch-in link (generated on approval)
    punchToken: { type: String, default: '' },
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

partTimeDriverSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('PartTimeDriver', partTimeDriverSchema);
