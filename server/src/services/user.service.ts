import { query, queryOne } from '../db';
import { NotFoundError } from '../lib/errors';
import { mapUser, type UserRow } from '../lib/mappers';
import type { UserRole } from '../types';

export interface UserWithDepartment {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  departmentName: string | null;
  createdAt: string;
}

/** FR-AUTH-03: admin lists users with their roles and departments. */
export async function listUsers(): Promise<UserWithDepartment[]> {
  const rows = await query<UserRow & { department_name: string | null }>(
    `SELECT u.*, d.name AS department_name
     FROM users u
     LEFT JOIN departments d ON d.id = u.department_id
     ORDER BY u.full_name ASC`,
  );
  return rows.map((row) => ({
    ...mapUser(row),
    departmentName: row.department_name,
  }));
}

export interface UpdateUserParams {
  role?: UserRole;
  departmentId?: string;
}

/** FR-AUTH-03: admin assigns a user's role and department. */
export async function updateUser(id: string, params: UpdateUserParams): Promise<UserWithDepartment> {
  const row = await queryOne<UserRow & { department_name: string | null }>(
    `UPDATE users SET
       role = COALESCE($2, role),
       department_id = COALESCE($3::uuid, department_id)
     WHERE id = $1
     RETURNING *, (SELECT name FROM departments d WHERE d.id = department_id) AS department_name`,
    [id, params.role ?? null, params.departmentId ?? null],
  );
  if (!row) throw new NotFoundError('User');

  return {
    ...mapUser(row),
    departmentName: row.department_name,
  };
}
