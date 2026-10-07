import {
  departments as mockDepartments,
  sops as mockSops,
  users as mockUsers,
} from '../../src/data/mock';
import { pool, withTransaction } from '../src/db';
import { hashPassword } from '../src/lib/password';

/**
 * Seeds the development database with the same dataset the React frontend
 * uses as mock data, so the API and the UI tell the same story.
 * This truncates the SOPly tables first — development only.
 */

const DEMO_PASSWORD = 'Soply123!';

const EMAILS: Record<string, string> = {
  'u-ar': 'alex.rivera@soply.test',
  'u-mc': 'monica.chen@soply.test',
  'u-sl': 'sarah.lee@soply.test',
  'u-dp': 'dev.patel@soply.test',
  'u-ms': 'maya.singh@soply.test',
  'u-jm': 'jordan.miller@soply.test',
};

interface SeedUser {
  mockId: string;
  email: string;
  fullName: string;
  role: string;
  departmentMockId: string | null;
}

const EXTRA_USERS: SeedUser[] = [
  {
    mockId: 'u-admin',
    email: 'admin@soply.test',
    fullName: 'Rina Wijaya',
    role: 'admin',
    departmentMockId: 'dept-fin',
  },
  {
    mockId: 'u-viewer',
    email: 'viewer@soply.test',
    fullName: 'Tom Becker',
    role: 'viewer',
    departmentMockId: 'dept-ops',
  },
];

function parseDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

async function main(): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `TRUNCATE version_change_log, approvals, password_reset_tokens, sop_versions, sops, users, departments
       RESTART IDENTITY CASCADE`,
    );

    /* Departments ------------------------------------------------------- */
    const departmentIdByMockId = new Map<string, string>();
    for (const department of mockDepartments) {
      const { rows } = await client.query<{ id: string }>(
        'INSERT INTO departments (name) VALUES ($1) RETURNING id',
        [department.name],
      );
      departmentIdByMockId.set(department.id, rows[0].id);
    }

    /* Users -------------------------------------------------------------- */
    const userIdByMockId = new Map<string, string>();
    const insertUser = async (user: SeedUser): Promise<void> => {
      const passwordHash = await hashPassword(DEMO_PASSWORD);
      const departmentId = user.departmentMockId
        ? (departmentIdByMockId.get(user.departmentMockId) ?? null)
        : null;
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, full_name, role, department_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [user.email, passwordHash, user.fullName, user.role, departmentId],
      );
      userIdByMockId.set(user.mockId, rows[0].id);
    };

    for (const user of mockUsers) {
      await insertUser({
        mockId: user.id,
        email: EMAILS[user.id],
        fullName: user.name,
        role: user.role,
        departmentMockId: user.departmentId,
      });
    }
    for (const user of EXTRA_USERS) {
      await insertUser(user);
    }

    /* SOPs, versions, change log, approvals ------------------------------ */
    let versionCount = 0;
    let changeLogCount = 0;
    let approvalCount = 0;

    for (const sop of mockSops) {
      const departmentId = departmentIdByMockId.get(sop.departmentId);
      const ownerId = userIdByMockId.get(sop.ownerId);
      if (!departmentId || !ownerId) throw new Error(`Missing mapping for SOP ${sop.id}`);

      const ordered = [...sop.versions].reverse(); // oldest first
      const sopCreatedAt = parseDate(ordered[0]?.createdAt ?? '01 Jan 2026');

      const { rows: sopRows } = await client.query<{ id: string }>(
        `INSERT INTO sops (department_id, title, created_by, created_at)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [departmentId, sop.title, ownerId, sopCreatedAt],
      );
      const sopId = sopRows[0].id;

      let publishedVersionId: string | null = null;

      for (let index = 0; index < ordered.length; index += 1) {
        const version = ordered[index];
        const versionNumber = index + 1; // integer versions, oldest = 1
        const versionCreatedAt = parseDate(version.createdAt);
        const createdBy = userIdByMockId.get(version.createdBy);
        if (!createdBy) throw new Error(`Unknown user ${version.createdBy} on ${sop.id}`);

        const { rows: versionRows } = await client.query<{ id: string }>(
          `INSERT INTO sop_versions
             (sop_id, version_number, status, body_content, diagram_data, change_summary,
              created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $8)
           RETURNING id`,
          [
            sopId,
            versionNumber,
            version.status,
            version.bodyContent.join('\n'),
            JSON.stringify(version.diagram),
            version.changeSummary,
            createdBy,
            versionCreatedAt,
          ],
        );
        const versionId = versionRows[0].id;
        versionCount += 1;

        await client.query(
          `INSERT INTO version_change_log (sop_version_id, changed_by, change_summary, created_at)
           VALUES ($1, $2, $3, $4)`,
          [versionId, createdBy, version.changeSummary, versionCreatedAt],
        );
        changeLogCount += 1;

        if (version.status === 'published') {
          publishedVersionId = versionId;
          if (version.approvedBy) {
            const approverId = userIdByMockId.get(version.approvedBy);
            if (approverId) {
              await client.query(
                `INSERT INTO approvals (sop_version_id, approver_id, decision, comment, decided_at)
                 VALUES ($1, $2, 'approved', $3, $4)`,
                [versionId, approverId, 'Approved and published.', versionCreatedAt],
              );
              approvalCount += 1;
            }
          }
        }

        if (version.status === 'rejected') {
          const approverId = userIdByMockId.get('u-mc');
          await client.query(
            `INSERT INTO approvals (sop_version_id, approver_id, decision, comment, decided_at)
             VALUES ($1, $2, 'rejected', $3, $4)`,
            [versionId, approverId, version.changeSummary, versionCreatedAt],
          );
          approvalCount += 1;
        }
      }

      if (publishedVersionId) {
        await client.query('UPDATE sops SET current_published_version_id = $2 WHERE id = $1', [
          sopId,
          publishedVersionId,
        ]);
      }
    }

    console.log(
      `Seeded ${mockDepartments.length} departments, ${userIdByMockId.size} users, ` +
        `${mockSops.length} SOPs, ${versionCount} versions, ${changeLogCount} change-log entries, ` +
        `${approvalCount} approval records.`,
    );
  });

  console.log(`Demo password for every seeded user: ${DEMO_PASSWORD}`);
  await pool.end();
}

main().catch(async (error) => {
  console.error('Seed failed:', error);
  await pool.end();
  process.exit(1);
});
