import fs from 'fs';

// 1. Update User.ts
let userModel = fs.readFileSync('apps/backend/src/models/User.ts', 'utf8');
if (!userModel.includes('sgpas: {')) {
  userModel = userModel.replace('interests: [{ type: String, trim: true }],', 'interests: [{ type: String, trim: true }],\n    sgpas: { type: Map, of: Number, default: {} },');
  fs.writeFileSync('apps/backend/src/models/User.ts', userModel);
}

// 2. Update userRoutes.ts
let userRoutes = fs.readFileSync('apps/backend/src/routes/userRoutes.ts', 'utf8');
if (!userRoutes.includes('sgpas: z.')) {
  userRoutes = userRoutes.replace('interests: z.array(z.string().max(50)).max(20).optional(),', 'interests: z.array(z.string().max(50)).max(20).optional(),\n        sgpas: z.record(z.string(), z.number()).optional(),');
  fs.writeFileSync('apps/backend/src/routes/userRoutes.ts', userRoutes);
}
