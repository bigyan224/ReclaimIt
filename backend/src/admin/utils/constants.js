export const ITEM_STATUSES = ["ACTIVE", "MATCHED", "CLOSED", "FLAGGED", "ARCHIVED", "CLAIMED"];
export const USER_ROLES = ["USER", "ADMIN"];
export const USER_STATUSES = ["ACTIVE", "FLAGGED", "BANNED"];
export const INSTITUTION_STATUSES = ["ACTIVE", "INACTIVE"];
export const ITEM_VISIBILITIES = ["PUBLIC", "INSTITUTION"];

export const DEFAULT_MATCHING_CONFIG = {
  minimumScore: 70,
  weights: {
    location: 45,
    title: 30,
    brand: 15,
    color: 10,
  },
};
