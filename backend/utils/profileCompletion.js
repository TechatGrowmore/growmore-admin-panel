// Profile completion: each tracked field carries a weight (percentage points).
// Weights of each profile type add up to 100.

const FULL_TIME_FIELDS = [
  { key: 'firstName', label: 'First Name', weight: 3 },
  { key: 'lastName', label: 'Last Name', weight: 3 },
  { key: 'phone', label: 'Mobile Number', weight: 4 },
  { key: 'email', label: 'Email', weight: 2 },
  { key: 'dob', label: 'Date of Birth', weight: 3 },
  { key: 'gender', label: 'Gender', weight: 2 },
  { key: 'bloodGroup', label: 'Blood Group', weight: 2 },
  { key: 'designation', label: 'Designation', weight: 2 },
  { key: 'venue', label: 'Venue', weight: 3 },
  { key: 'addressLine1', label: 'Current Address', weight: 3 },
  { key: 'city', label: 'Current City', weight: 2 },
  { key: 'state', label: 'Current State', weight: 2 },
  { key: 'pincode', label: 'Current Pincode', weight: 2 },
  { key: 'aadharAddressLine1', label: 'Aadhar Address', weight: 3 },
  { key: 'aadharCity', label: 'Aadhar City', weight: 2 },
  { key: 'aadharState', label: 'Aadhar State', weight: 2 },
  { key: 'aadharPincode', label: 'Aadhar Pincode', weight: 2 },
  { key: 'aadharNumber', label: 'Aadhar Number', weight: 4 },
  { key: 'aadharDocUrl', label: 'Aadhar Document', weight: 5 },
  { key: 'panNumber', label: 'PAN Number', weight: 3 },
  { key: 'panDocUrl', label: 'PAN Document', weight: 4 },
  { key: 'photoUrl', label: 'Photograph', weight: 4 },
  { key: 'licenseDocUrl', label: 'Driving License', weight: 5 },
  { key: 'emergencyContactName', label: 'Emergency Contact Name', weight: 1 },
  { key: 'emergencyContactPhone', label: 'Emergency Contact Phone', weight: 1 },
  { key: 'bankName', label: 'Bank Name', weight: 3 },
  { key: 'bankAccountNumber', label: 'Account Number', weight: 4 },
  { key: 'bankIfsc', label: 'IFSC Code', weight: 3 },
  { key: 'bankAccountHolderName', label: 'Account Holder Name', weight: 3 },
  { key: 'bankBranchName', label: 'Branch Name', weight: 2 },
  { key: 'passbookDocUrl', label: 'Passbook Photo', weight: 4 },
  { key: 'pfNumber', label: 'PF Number', weight: 6 },
  { key: 'esicNumber', label: 'ESIC Number', weight: 6 },
];

const PART_TIME_FIELDS = [
  { key: 'firstName', label: 'First Name', weight: 6 },
  { key: 'lastName', label: 'Last Name', weight: 6 },
  { key: 'phone', label: 'Mobile Number', weight: 7 },
  { key: 'email', label: 'Email', weight: 3 },
  { key: 'address', label: 'Address', weight: 6 },
  { key: 'photoUrl', label: 'Photograph', weight: 9 },
  { key: 'aadharNumber', label: 'Aadhar Number', weight: 8 },
  { key: 'aadharDocUrl', label: 'Aadhar Document', weight: 11 },
  { key: 'licenseDocUrl', label: 'Driving License', weight: 11 },
  { key: 'bankName', label: 'Bank Name', weight: 5 },
  { key: 'bankAccountNumber', label: 'Account Number', weight: 7 },
  { key: 'bankIfsc', label: 'IFSC Code', weight: 5 },
  { key: 'bankAccountHolderName', label: 'Account Holder Name', weight: 6 },
  { key: 'bankBranchName', label: 'Branch Name', weight: 4 },
  { key: 'passbookDocUrl', label: 'Passbook Photo', weight: 6 },
];

function isFilled(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  return true;
}

// Uploaded documents. Each one is reviewed (approved / rejected) by HR or the accountant.
const DOC_URL_FIELDS = {
  photo: 'photoUrl',
  aadhar: 'aadharDocUrl',
  pan: 'panDocUrl',
  license: 'licenseDocUrl',
  passbook: 'passbookDocUrl',
};
const DOC_LABELS = {
  photo: 'Photograph',
  aadhar: 'Aadhar Card',
  pan: 'PAN Card',
  license: 'Driving License',
  passbook: 'Bank Passbook',
};
const FULL_TIME_DOCS = ['photo', 'aadhar', 'pan', 'license', 'passbook'];
const PART_TIME_DOCS = ['photo', 'aadhar', 'license', 'passbook'];
const URL_TO_DOC = Object.fromEntries(Object.entries(DOC_URL_FIELDS).map(([k, v]) => [v, k]));

// 'missing' (nothing uploaded) | 'pending' (awaiting review) | 'approved' | 'rejected'
function docStatus(rec, key) {
  if (!isFilled(rec[DOC_URL_FIELDS[key]])) return 'missing';
  return rec.docReviews?.[key]?.status || 'pending';
}

function buildDocuments(rec, keys) {
  return keys.map(key => {
    const review = rec.docReviews?.[key] || {};
    return {
      key,
      label: DOC_LABELS[key],
      url: rec[DOC_URL_FIELDS[key]] || '',
      status: docStatus(rec, key),
      remarks: review.remarks || '',
      reviewedBy: review.reviewedBy || '',
      reviewedByRole: review.reviewedByRole || '',
      reviewedAt: review.reviewedAt || null,
    };
  });
}

const DOC_REASON = { missing: 'not uploaded', pending: 'awaiting approval', rejected: 'rejected' };

// Plain fields count once filled. Document fields count only once the document is approved.
function computeCompletion(rec, fields) {
  let percent = 0;
  const missing = [];
  fields.forEach(({ key, label, weight }) => {
    const docKey = URL_TO_DOC[key];
    if (docKey) {
      const status = docStatus(rec, docKey);
      if (status === 'approved') percent += weight;
      else missing.push({ key, label, weight, reason: DOC_REASON[status] });
    } else if (isFilled(rec[key])) {
      percent += weight;
    } else {
      missing.push({ key, label, weight, reason: 'not filled' });
    }
  });
  return { percent, missing };
}

module.exports = {
  FULL_TIME_FIELDS, PART_TIME_FIELDS, computeCompletion,
  DOC_URL_FIELDS, DOC_LABELS, FULL_TIME_DOCS, PART_TIME_DOCS, docStatus, buildDocuments,
};
