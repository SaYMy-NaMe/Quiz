import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType } from 'mongoose';

/**
 * Instructor account. Sessions are stateless JWTs signed with JWT_SECRET, so no session
 * collection exists (the SQLite `sessions` table had no document-model equivalent worth keeping).
 */
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);

export type UserSchema = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocumentFromSchema<typeof userSchema>;
export const UserModel = model('User', userSchema);
