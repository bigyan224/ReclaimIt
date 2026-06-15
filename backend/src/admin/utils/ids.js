import mongoose from "mongoose";

export function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}
