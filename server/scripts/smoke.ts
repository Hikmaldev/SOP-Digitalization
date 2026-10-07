/**
 * End-to-end smoke test against a running API (npm run dev in another shell).
 * Verifies the golden path from the PRD: login → create → submit → approve,
 * plus RBAC and the "one published version per SOP" invariant.
 *
 * Usage: npx tsx scripts/smoke.ts
 */

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:4000';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, extra?: unknown): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${name}`, extra ?? '');
  }
}

async function api(path: string, options: RequestInit = {}, token?: string) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body: any = await response.json().catch(() => null);
  return { status: response.status, body };
}

async function login(email: string, password = 'Soply123!'): Promise<string> {
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return (result.body?.token as string) ?? '';
}

async function main(): Promise<void> {
  console.log(`SOPly API smoke test against ${BASE}\n`);

  const health = await api('/api/health');
  check('health endpoint responds ok', health.status === 200 && health.body?.status === 'ok', health);

  const badLogin = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'monica.chen@soply.test', password: 'wrong-password' }),
  });
  check('wrong password is rejected (401)', badLogin.status === 401);

  const approverToken = await login('monica.chen@soply.test');
  const authorToken = await login('alex.rivera@soply.test');
  const viewerToken = await login('viewer@soply.test');
  check('approver, author, and viewer can log in', Boolean(approverToken && authorToken && viewerToken));

  const queue = await api('/api/approvals', {}, approverToken);
  check('approver sees their department queue', queue.status === 200 && Array.isArray(queue.body));

  const search = await api('/api/search?q=invoice', {}, viewerToken);
  check('viewer search returns published results', search.status === 200 && Array.isArray(search.body) && search.body.length > 0);
  check('search results are published-only', Array.isArray(search.body) && (search.body as any[]).every((row) => row.status === 'published'));

  const departments = await api('/api/departments', {}, authorToken);
  const finance = (departments.body as any[]).find((entry) => entry.name === 'Finance');
  if (!finance) throw new Error('Finance department not found — did you seed the database?');

  const viewerCreate = await api(
    '/api/sops',
    { method: 'POST', body: JSON.stringify({ title: 'Viewer attempt', departmentId: finance.id }) },
    viewerToken,
  );
  check('viewer cannot create a SOP (403)', viewerCreate.status === 403, viewerCreate.body);

  const created = await api(
    '/api/sops',
    {
      method: 'POST',
      body: JSON.stringify({
        title: 'Smoke test procedure',
        departmentId: finance.id,
        bodyContent: 'Steps\n1. Do the smoke test.',
        changeSummary: 'Smoke test draft',
      }),
    },
    authorToken,
  );
  check('author creates a SOP draft (201)', created.status === 201, created.body);
  const sopId = created.body?.sop?.id as string;
  const draftId = created.body?.draft?.id as string;
  check('draft starts in "draft" status', created.body?.draft?.status === 'draft');

  const submit = await api(`/api/sops/${sopId}/versions/${draftId}/submit`, { method: 'POST' }, authorToken);
  check('author submits the draft for approval', submit.status === 200 && submit.body?.status === 'pending_approval', submit.body);

  const rejectNoComment = await api(
    `/api/approvals/${draftId}/decision`,
    { method: 'POST', body: JSON.stringify({ decision: 'rejected' }) },
    approverToken,
  );
  check('rejection without a comment is refused (400)', rejectNoComment.status === 400, rejectNoComment.body);

  const approve = await api(
    `/api/approvals/${draftId}/decision`,
    { method: 'POST', body: JSON.stringify({ decision: 'approved' }) },
    approverToken,
  );
  check('approver approves and publishes', approve.status === 200 && approve.body?.version?.status === 'published', approve.body);

  const decideAgain = await api(
    `/api/approvals/${draftId}/decision`,
    { method: 'POST', body: JSON.stringify({ decision: 'approved' }) },
    approverToken,
  );
  check('a second decision is refused (invalid transition, 409)', decideAgain.status === 409, decideAgain.body);

  const detail = await api(`/api/sops/${sopId}`, {}, authorToken);
  const publishedVersions = ((detail.body?.versions ?? []) as any[]).filter((v) => v.status === 'published');
  check('exactly one published version exists', publishedVersions.length === 1);
  check('SOP record points at the published version', detail.body?.sop?.currentPublishedVersionId === draftId);

  const queueAfter = await api('/api/approvals', {}, approverToken);
  check('decided draft left the queue', !((queueAfter.body ?? []) as any[]).some((entry) => entry.versionId === draftId));

  const decided = await api('/api/approvals/decided', {}, approverToken);
  check(
    'recently-decided list contains the decision',
    decided.status === 200 && ((decided.body ?? []) as any[]).some((entry) => entry.versionId === draftId),
  );

  const history = await api('/api/history?limit=5', {}, authorToken);
  check('version history feed returns entries', history.status === 200 && Array.isArray(history.body) && history.body.length > 0);

  const resetRequest = await api('/api/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email: 'alex.rivera@soply.test' }),
  });
  check('password reset request issues a dev token', resetRequest.status === 200 && Boolean(resetRequest.body?.resetToken));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
