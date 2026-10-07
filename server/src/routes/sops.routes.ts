import { Router } from 'express';
import { z } from 'zod';
import { queryOne, withTransaction } from '../db';
import { ForbiddenError, NotFoundError } from '../lib/errors';
import { mapVersion, type SopVersionRow } from '../lib/mappers';
import { booleanParam, parse } from '../lib/validate';
import { actorFrom, requireAuth, requireRole } from '../middleware/auth';
import {
  assertCanEdit,
  createSop,
  getSopDetail,
  getSopScope,
  listSops,
  updateSop,
} from '../services/sop.service';
import {
  createDraftVersion,
  submitVersionForApproval,
  updateDraftVersion,
} from '../services/version.service';

export const sopsRouter = Router();
sopsRouter.use(requireAuth);

const uuid = z.uuid();
const sopIdParams = z.object({ sopId: uuid });
const versionParams = z.object({ sopId: uuid, versionId: uuid });

/* ------------------------------- listing ------------------------------- */

const listQuerySchema = z.object({
  department: uuid.optional(),
  includeDrafts: booleanParam,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

sopsRouter.get('/', async (req, res) => {
  const queryParams = parse(listQuerySchema, req.query);
  res.json(
    await listSops({
      actor: actorFrom(req),
      departmentId: queryParams.department,
      includeDrafts: queryParams.includeDrafts,
      limit: queryParams.limit,
      offset: queryParams.offset,
    }),
  );
});

/* ------------------------------- create -------------------------------- */

const createSopSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200),
  departmentId: uuid,
  bodyContent: z.string().max(50_000).nullish(),
  diagramData: z.unknown().nullish(),
  annotationText: z.string().max(20_000).nullish(),
  changeSummary: z.string().trim().max(500).optional(),
});

sopsRouter.post('/', requireRole('author', 'approver'), async (req, res) => {
  const body = parse(createSopSchema, req.body);
  const actor = actorFrom(req);

  if (actor.role !== 'admin' && actor.departmentId !== body.departmentId) {
    throw new ForbiddenError('You can only create SOPs for your own department');
  }

  const result = await createSop(actor, {
    title: body.title,
    departmentId: body.departmentId,
    bodyContent: body.bodyContent ?? null,
    diagramData: body.diagramData ?? null,
    annotationText: body.annotationText ?? null,
    changeSummary: body.changeSummary,
  });
  res.status(201).json(result);
});

/* ------------------------------ detail/edit ----------------------------- */

sopsRouter.get('/:sopId', async (req, res) => {
  const { sopId } = parse(sopIdParams, req.params);
  res.json(await getSopDetail(actorFrom(req), sopId));
});

const updateSopSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    departmentId: uuid.optional(),
  })
  .refine((value) => value.title !== undefined || value.departmentId !== undefined, {
    message: 'Provide at least one field to update',
  });

sopsRouter.patch('/:sopId', requireRole('author', 'approver'), async (req, res) => {
  const { sopId } = parse(sopIdParams, req.params);
  const body = parse(updateSopSchema, req.body);
  const actor = actorFrom(req);
  assertCanEdit(actor, await getSopScope(sopId));
  res.json(await updateSop(sopId, body));
});

/* ------------------------------- versions ------------------------------- */

const createVersionSchema = z.object({
  changeSummary: z.string().trim().min(3, 'Describe what changed').max(500),
  /** Optional: create the draft from a specific version (e.g. a rejected one). */
  sourceVersionId: uuid.optional(),
});

/** FR-VER-01: editing a published SOP creates a new draft; the original stays live. */
sopsRouter.post('/:sopId/versions', requireRole('author', 'approver'), async (req, res) => {
  const { sopId } = parse(sopIdParams, req.params);
  const body = parse(createVersionSchema, req.body);
  const actor = actorFrom(req);
  assertCanEdit(actor, await getSopScope(sopId));

  const version = await withTransaction((client) =>
    createDraftVersion(client, {
      sopId,
      actorId: actor.id,
      changeSummary: body.changeSummary,
      sourceVersionId: body.sourceVersionId ?? null,
    }),
  );
  res.status(201).json(mapVersion(version));
});

sopsRouter.get('/:sopId/versions', async (req, res) => {
  const { sopId } = parse(sopIdParams, req.params);
  const detail = await getSopDetail(actorFrom(req), sopId);
  res.json({
    versions: detail.versions,
    changeLog: detail.changeLog,
    approvals: detail.approvals,
  });
});

sopsRouter.get('/:sopId/versions/:versionId', async (req, res) => {
  const { sopId, versionId } = parse(versionParams, req.params);
  const detail = await getSopDetail(actorFrom(req), sopId);
  const version = detail.versions.find((candidate) => candidate.id === versionId);
  if (!version) throw new NotFoundError('Version');
  res.json(version);
});

const updateVersionSchema = z
  .object({
    bodyContent: z.string().max(50_000).nullish(),
    diagramData: z.unknown().nullish(),
    diagramFileUrl: z.string().max(500).nullish(),
    annotationText: z.string().max(20_000).nullish(),
    changeSummary: z.string().trim().max(500).optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'Provide at least one field to update',
  });

/** Only drafts are editable, and only by their author (or an admin). */
sopsRouter.patch(
  '/:sopId/versions/:versionId',
  requireRole('author', 'approver'),
  async (req, res) => {
    const { sopId, versionId } = parse(versionParams, req.params);
    const body = parse(updateVersionSchema, req.body);
    const actor = actorFrom(req);
    assertCanEdit(actor, await getSopScope(sopId));

    const existing = await queryOne<SopVersionRow>(
      'SELECT * FROM sop_versions WHERE id = $1',
      [versionId],
    );
    if (!existing || existing.sop_id !== sopId) throw new NotFoundError('Version');
    if (actor.role !== 'admin' && existing.created_by !== actor.id) {
      throw new ForbiddenError('You can only edit your own draft');
    }

    const updated = await withTransaction((client) =>
      updateDraftVersion(client, {
        versionId,
        actorId: actor.id,
        bodyContent: body.bodyContent ?? null,
        diagramData: body.diagramData,
        diagramFileUrl: body.diagramFileUrl ?? null,
        annotationText: body.annotationText ?? null,
        changeSummary: body.changeSummary,
      }),
    );
    res.json(mapVersion(updated));
  },
);

/* -------------------------------- submit -------------------------------- */

/** FR-APR-01 + FR-SOP-05: submit a draft once it passes validation. */
sopsRouter.post(
  '/:sopId/versions/:versionId/submit',
  requireRole('author', 'approver'),
  async (req, res) => {
    const { sopId, versionId } = parse(versionParams, req.params);
    const actor = actorFrom(req);
    assertCanEdit(actor, await getSopScope(sopId));

    const version = await withTransaction((client) =>
      submitVersionForApproval(client, versionId, actor.id, sopId),
    );
    res.json(mapVersion(version));
  },
);
