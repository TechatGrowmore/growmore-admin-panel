const mongoose = require('mongoose');

// HR and Accountant users are pre-seeded or created by super admin
const hrUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true }, // sha256 hashed
    role: { type: String, enum: ['hr', 'accountant'], required: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '', lowercase: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null },
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

module.exports = mongoose.model('HRUser', hrUserSchema);
