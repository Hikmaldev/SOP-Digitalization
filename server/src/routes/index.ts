import { Router } from 'express';
import { approvalsRouter } from './approvals.routes';
import { authRouter } from './auth.routes';
import { departmentsRouter } from './departments.routes';
import { historyRouter } from './history.routes';
import { searchRouter } from './search.routes';
import { sopsRouter } from './sops.routes';
import { uploadsRouter } from './uploads.routes';
import { usersRouter } from './users.routes';

/** All API routes live under /api (see app.ts). */
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/departments', departmentsRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/sops', sopsRouter);
apiRouter.use('/approvals', approvalsRouter);
apiRouter.use('/history', historyRouter);
apiRouter.use('/search', searchRouter);
apiRouter.use('/uploads', uploadsRouter);
