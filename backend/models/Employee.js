const mongoose = require('mongoose');
const { FULL_TIME_FIELDS, FULL_TIME_DOCS, computeCompletion, buildDocuments } = require('../utils/profileCompletion');

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

    // Address as per Aadhar card
    aadharAddressLine1: { type: String, trim: true, default: '' },
    aadharAddressLine2: { type: String, trim: true, default: '' },
    aadharCity: { type: String, trim: true, default: '' },
    aadharState: { type: String, trim: true, default: '' },
    aadharPincode: { type: String, trim: true, default: '' },

    // Documents
    aadharNumber: { type: String, trim: true, default: '' },
    aadharDocUrl: { type: String, default: '' }, // Cloudinary URL
    panNumber: { type: String, trim: true, default: '' },
    panDocUrl: { type: String, default: '' }, // Cloudinary URL
    photoUrl: { type: String, default: '' }, // Profile photo
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

    // Emergency contact
    emergencyContactName: { type: String, trim: true, default: '' },
    emergencyContactPhone: { type: String, trim: true, default: '' },

    // Statutory (optional at registration)
    pfNumber: { type: String, trim: true, default: '' },
    esicNumber: { type: String, trim: true, default: '' },

    // Employment Details
    designation: { type: String, default: 'Driver' },
    venue: { type: String, trim: true, default: '' },
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

// Virtual: profile completion { percent, missing: [{ key, label, weight }] }
employeeSchema.virtual('profileCompletion').get(function () {
  return computeCompletion(this, FULL_TIME_FIELDS);
});

employeeSchema.virtual('documents').get(function () {
  return buildDocuments(this, FULL_TIME_DOCS);
});

// Virtual: full name
employeeSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('Employee', employeeSchema);
