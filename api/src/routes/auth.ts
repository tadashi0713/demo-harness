import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/async-handler';
import { unauthorized } from '../lib/http-error';
import { currentUser, requireAuth, signToken } from '../middleware/auth';
import { authenticate, getUserById, registerUser } from '../services/users';

const registerSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(8, 'パスワードは 8 文字以上にしてください'),
  fullName: z.string().min(1, '氏名を入力してください').max(80),
});

const loginSchema = z.object({
  email: z.string().email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードを入力してください'),
});

export const authRouter = Router();

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const user = await registerUser(input);
    res.status(201).json({ token: signToken({ id: user.id, email: user.email }), user });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await authenticate(input.email, input.password);
    res.json({ token: signToken({ id: user.id, email: user.email }), user });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await getUserById(currentUser(req).id);
    if (!user) throw unauthorized('ユーザーが見つかりません');
    res.json({ user });
  }),
);
