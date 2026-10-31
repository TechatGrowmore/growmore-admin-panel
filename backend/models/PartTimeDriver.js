const mongoose = require('mongoose');
const { PART_TIME_FIELDS, PART_TIME_DOCS, computeCompletion, buildDocuments } = require('../utils/profileCompletion');

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
    licenseDocUrl: { type: String, default: '' }, // Cloudinary URL
    // Per-document review: { [docKey]: { status, remarks, reviewedBy, reviewedByRole, reviewedAt } }
    docReviews: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Bank details
    bankName: { type: String, trim: true, default: '' },
    bankAccountNumber: { type: String, trim: true, default: '' },
    bankIfsc: { type: String, trim: true, uppercase: true, default: '' },
    bankAccountHolderName: { type: String, trim: true, default: '' },
    bankBranchName: { type: String, trim: true, default: '' },
    passbookDocUrl: { type: String, default: '' }, // Cloudinary URL

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

    // Token for punch-in link (kept for backward-compat but portal login is primary)
    punchToken: { type: String, default: '' },

    // Login credentials (set on HR approval)
    // username = phone, password = sha256(firstName.toLowerCase())
    password: { type: String, default: '' },
    isLoginEnabled: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password; // never expose
        return ret;
      },
    },
  }
);

partTimeDriverSchema.virtual('profileCompletion').get(function () {
  return computeCompletion(this, PART_TIME_FIELDS);
});

partTimeDriverSchema.virtual('documents').get(function () {
  return buildDocuments(this, PART_TIME_DOCS);
});

partTimeDriverSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('PartTimeDriver', partTimeDriverSchema);
