const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema(
  {
    // Personal Info
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, unique: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    dob: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], default: 'Male' },
    bloodGroup: { type: String, default: '' },

    // Address
    addressLine1: { type: String, trim: true, default: '' },
    addressLine2: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    pincode: { type: String, trim: true, default: '' },

    // Documents
    aadharNumber: { type: String, trim: true, default: '' },
    aadharDocUrl: { type: String, default: '' }, // Cloudinary URL
    panNumber: { type: String, trim: true, default: '' },
    panDocUrl: { type: String, default: '' }, // Cloudinary URL
    photoUrl: { type: String, default: '' }, // Profile photo

    // Employment Details
    designation: { type: String, default: 'Driver' },
    department: { type: String, default: 'Operations' },
    joiningDate: { type: Date },
    salary: { type: Number, default: 0 },

    // Declaration
    declarationAccepted: { type: Boolean, default: false },
    declarationDate: { type: Date },

    // Status
    // pending = submitted by applicant, hr_approved = HR submitted to accountant
    // verified = approved by accountant, rejected = rejected by accountant
    status: {
      type: String,
      enum: ['pending', 'hr_approved', 'verified', 'rejected'],
      default: 'pending',
    },
    rejectionRemarks: { type: String, default: '' },
    verifiedBy: { type: String, default: '' }, // accountant name
    verifiedAt: { type: Date },

    // Submission source
    submittedViaPublicForm: { type: Boolean, default: false },
    publicFormToken: { type: String, default: '' },

    // Login credentials (set after verification)
    password: { type: String, default: '' }, // sha256 of firstName.toLowerCase()
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
        delete ret.password;
        return ret;
      },
    },
  }
);

// Virtual: full name
employeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('Employee', employeeSchema);
