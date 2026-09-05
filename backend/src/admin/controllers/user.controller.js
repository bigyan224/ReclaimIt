export const getAdminUser = async (req, res) => {
  try {
    const localUser = req.localUser;
    res.status(200).json({
      success: true,
      user: {
        id: localUser?._id || null,
        email: localUser?.email || "",
        name: localUser?.name || "",
        isMasterAdmin: req.isMasterAdmin,
        isInstitutionAdmin: !!(localUser && localUser.adminInstitutions && localUser.adminInstitutions.length > 0),
        institutionIds: localUser?.adminInstitutions || [],
      },
    });
  } catch (error) {
    log.error("Admin get user error:", error);
    res.status(500).json({ success: false, message: "Failed to load user info" });
  }
};
