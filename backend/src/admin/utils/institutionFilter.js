export function itemInstitutionFilter(req) {
  if (req.isMasterAdmin) return {};
  if (!req.localUser || !req.localUser.adminInstitutions || req.localUser.adminInstitutions.length === 0) {
    return { _id: null };
  }
  return { institution: { $in: req.localUser.adminInstitutions } };
}

export function userInstitutionFilter(req) {
  if (req.isMasterAdmin) return {};
  if (!req.localUser || !req.localUser.adminInstitutions || req.localUser.adminInstitutions.length === 0) {
    return { _id: null };
  }
  return {
    $or: [
      { institutions: { $in: req.localUser.adminInstitutions } },
      { adminInstitutions: { $in: req.localUser.adminInstitutions } },
    ],
  };
}

export function adminInstitutionIds(req) {
  if (req.isMasterAdmin) return null;
  if (!req.localUser || !req.localUser.adminInstitutions || req.localUser.adminInstitutions.length === 0) {
    return [];
  }
  return req.localUser.adminInstitutions;
}
