/**
 * Mock dataset kept as the seed source for the backend
 * (server/scripts/seed.ts imports this file). The app itself no longer reads
 * it — frontend pages fetch everything from the API.
 */

type MockUserRole = 'author' | 'approver' | 'viewer' | 'admin';
type MockAvatarColor = 'navy' | 'teal' | 'orange' | 'pink' | 'purple';
type MockVersionStatus = 'draft' | 'pending_approval' | 'published' | 'superseded' | 'rejected';

interface MockDepartment {
  id: string;
  name: string;
}

interface MockUser {
  id: string;
  name: string;
  initials: string;
  role: MockUserRole;
  departmentId: string;
  color: MockAvatarColor;
}

interface MockDiagramNode {
  id: string;
  kind: 'start' | 'task' | 'decision' | 'end';
  label: string;
  slot: 'start' | 'task-one' | 'decision' | 'task-two' | 'task-three' | 'end';
}

interface MockSopVersion {
  id: string;
  sopId: string;
  versionNumber: number;
  status: MockVersionStatus;
  bodyContent: string[];
  diagram: MockDiagramNode[];
  changeSummary: string;
  createdBy: string;
  approvedBy?: string;
  createdAt: string;
}

interface MockSop {
  id: string;
  title: string;
  departmentId: string;
  ownerId: string;
  updatedAt: string;
  versions: MockSopVersion[];
}

interface MockApprovalTask {
  id: string;
  sopId: string;
  submittedBy: string;
  submittedAt: string;
  priority: 'standard' | 'high';
}

/* ------------------------------------------------------------------ */
/* Mock data used by the prototype. In the real app this comes from   */
/* the Neon Postgres backend via the API layer.                        */
/* ------------------------------------------------------------------ */

export const departments: MockDepartment[] = [
  { id: 'dept-fin', name: 'Finance' },
  { id: 'dept-ops', name: 'Operations' },
  { id: 'dept-hr', name: 'People & Culture' },
  { id: 'dept-it', name: 'IT Operations' },
  { id: 'dept-cs', name: 'Customer Success' },
  { id: 'dept-proc', name: 'Procurement' },
  { id: 'dept-legal', name: 'Legal' },
  { id: 'dept-rd', name: 'R&D' },
];

export const users: MockUser[] = [
  { id: 'u-ar', name: 'Alex Rivera', initials: 'AR', role: 'author', departmentId: 'dept-fin', color: 'navy' },
  { id: 'u-mc', name: 'Monica Chen', initials: 'MC', role: 'approver', departmentId: 'dept-fin', color: 'teal' },
  { id: 'u-sl', name: 'Sarah Lee', initials: 'SL', role: 'author', departmentId: 'dept-hr', color: 'pink' },
  { id: 'u-dp', name: 'Dev Patel', initials: 'DP', role: 'author', departmentId: 'dept-it', color: 'teal' },
  { id: 'u-ms', name: 'Maya Singh', initials: 'MS', role: 'author', departmentId: 'dept-cs', color: 'orange' },
  { id: 'u-jm', name: 'Jordan Miller', initials: 'JM', role: 'author', departmentId: 'dept-fin', color: 'orange' },
];

/* ----------------------------- Diagrams ----------------------------- */

const diagramFull: MockDiagramNode[] = [
  { id: 'n1', kind: 'start', label: 'Start', slot: 'start' },
  { id: 'n2', kind: 'task', label: 'Submit PO', slot: 'task-one' },
  { id: 'n3', kind: 'decision', label: 'Budget?', slot: 'decision' },
  { id: 'n4', kind: 'task', label: 'Finance review', slot: 'task-two' },
  { id: 'n5', kind: 'task', label: 'Return to owner', slot: 'task-three' },
  { id: 'n6', kind: 'end', label: 'End', slot: 'end' },
];

const diagramFive: MockDiagramNode[] = [
  { id: 'n1', kind: 'start', label: 'Start', slot: 'start' },
  { id: 'n2', kind: 'task', label: 'Submit', slot: 'task-one' },
  { id: 'n3', kind: 'decision', label: 'OK?', slot: 'decision' },
  { id: 'n4', kind: 'task', label: 'Review', slot: 'task-two' },
  { id: 'n5', kind: 'end', label: 'End', slot: 'end' },
];

/* ------------------------------ SOPs -------------------------------- */

export const sops: MockSop[] = [
  {
    id: 'sop-po',
    title: 'Purchase order approval',
    departmentId: 'dept-fin',
    ownerId: 'u-ar',
    updatedAt: '24 min ago',
    versions: [
      {
        id: 'sop-po-v3-2', sopId: 'sop-po', versionNumber: 3.2, status: 'published',
        bodyContent: [
          'This procedure explains how purchase orders are reviewed and approved before a supplier invoice is paid.',
          '',
          'Steps',
          '1. Requester creates a purchase order with the supplier, cost centre, and total amount.',
          '2. The budget owner checks the request against the department budget.',
          '3. Finance verifies the supplier details, supporting documents, and tax treatment.',
          '4. Once approved, the purchase order is sent to the supplier and attached to the invoice.',
          '',
          'Important notes',
          'Do not approve an invoice without a matching purchase order. Questions about exceptions should be directed to the Finance Operations team.',
        ],
        diagram: diagramFive,
        changeSummary: 'Updated invoice exception rule',
        createdBy: 'u-ar', approvedBy: 'u-mc', createdAt: '02 Oct 2026',
      },
      {
        id: 'sop-po-v3-1', sopId: 'sop-po', versionNumber: 3.1, status: 'superseded',
        bodyContent: ['Added Finance review step to the flow.'],
        diagram: diagramFive,
        changeSummary: 'Added Finance review step',
        createdBy: 'u-mc', createdAt: '18 Sep 2026',
      },
      {
        id: 'sop-po-v3-0', sopId: 'sop-po', versionNumber: 3, status: 'superseded',
        bodyContent: ['Process owner changed from Procurement to Finance.'],
        diagram: diagramFive,
        changeSummary: 'Process owner changed',
        createdBy: 'u-ar', createdAt: '06 Aug 2026',
      },
    ],
  },
  {
    id: 'sop-onboarding',
    title: 'New employee onboarding',
    departmentId: 'dept-hr',
    ownerId: 'u-sl',
    updatedAt: 'Yesterday',
    versions: [
      {
        id: 'sop-onboarding-v2', sopId: 'sop-onboarding', versionNumber: 2, status: 'pending_approval',
        bodyContent: [
          'Steps',
          '1. HR schedules the first-day induction with the manager.',
          '2. IT provisions accounts and equipment before day one.',
          '3. The buddy programme pairs the new hire with a colleague for the first month.',
          '4. HR follows up at 30 days with a check-in.',
        ],
        diagram: diagramFive,
        changeSummary: 'Added equipment handover steps',
        createdBy: 'u-sl', createdAt: '29 Sep 2026',
      },
      {
        id: 'sop-onboarding-v1', sopId: 'sop-onboarding', versionNumber: 1, status: 'published',
        bodyContent: ['Initial onboarding checklist for all departments.'],
        diagram: diagramFive,
        changeSummary: 'Initial publication',
        createdBy: 'u-sl', approvedBy: 'u-mc', createdAt: '12 Mar 2026',
      },
    ],
  },
  {
    id: 'sop-complaint',
    title: 'Customer complaint handling',
    departmentId: 'dept-cs',
    ownerId: 'u-ms',
    updatedAt: '2 days ago',
    versions: [
      {
        id: 'sop-complaint-v1-4', sopId: 'sop-complaint', versionNumber: 1.4, status: 'published',
        bodyContent: [
          'Steps',
          '1. Log the complaint in the CRM within one hour.',
          '2. Assign an owner and set the SLA target.',
          '3. Investigate and respond to the customer.',
          '4. Escalate to the team lead if not resolved within 5 business days.',
        ],
        diagram: diagramFive,
        changeSummary: 'Clarified escalation path',
        createdBy: 'u-ms', approvedBy: 'u-mc', createdAt: '28 Aug 2026',
      },
      {
        id: 'sop-complaint-v1-3', sopId: 'sop-complaint', versionNumber: 1.3, status: 'superseded',
        bodyContent: ['Added SLA targets per severity level.'],
        diagram: diagramFive,
        changeSummary: 'Added SLA targets',
        createdBy: 'u-ms', createdAt: '15 Jun 2026',
      },
      {
        id: 'sop-complaint-v1-2', sopId: 'sop-complaint', versionNumber: 1.2, status: 'rejected',
        bodyContent: ['Reworded escalation steps.'],
        diagram: diagramFive,
        changeSummary: 'Wording unclear — rejected by approver',
        createdBy: 'u-ms', createdAt: '20 May 2026',
      },
      {
        id: 'sop-complaint-v1-1', sopId: 'sop-complaint', versionNumber: 1.1, status: 'superseded',
        bodyContent: ['Renamed and reordered steps.'],
        diagram: diagramFive,
        changeSummary: 'Renamed steps',
        createdBy: 'u-ms', createdAt: '02 Apr 2026',
      },
    ],
  },
  {
    id: 'sop-close',
    title: 'Monthly financial close',
    departmentId: 'dept-fin',
    ownerId: 'u-ar',
    updatedAt: '4 days ago',
    versions: [
      {
        id: 'sop-close-v4', sopId: 'sop-close', versionNumber: 4, status: 'draft',
        bodyContent: [
          'Steps',
          '1. Reconcile all bank accounts.',
          '2. Review open purchase orders and outstanding invoice approvals.',
          '3. Post accruals and depreciation.',
          '4. Publish the monthly close report to leadership.',
        ],
        diagram: diagramFull,
        changeSummary: 'Drafted new reconciliation flow',
        createdBy: 'u-ar', createdAt: '27 Sep 2026',
      },
      {
        id: 'sop-close-v3-1', sopId: 'sop-close', versionNumber: 3.1, status: 'published',
        bodyContent: ['Updated the close checklist and deadlines.'],
        diagram: diagramFive,
        changeSummary: 'Updated close checklist',
        createdBy: 'u-mc', approvedBy: 'u-mc', createdAt: '01 Sep 2026',
      },
      {
        id: 'sop-close-v3', sopId: 'sop-close', versionNumber: 3, status: 'superseded',
        bodyContent: ['Split the close into two phases.'],
        diagram: diagramFive,
        changeSummary: 'Split into two phases',
        createdBy: 'u-ar', createdAt: '14 Jul 2026',
      },
    ],
  },
  {
    id: 'sop-invoice',
    title: 'Supplier invoice processing',
    departmentId: 'dept-fin',
    ownerId: 'u-ar',
    updatedAt: '5 days ago',
    versions: [
      {
        id: 'sop-invoice-v2-1', sopId: 'sop-invoice', versionNumber: 2.1, status: 'published',
        bodyContent: [
          'Steps',
          '1. Receive the invoice and check the purchase order number.',
          '2. Route the invoice for approval in the finance system.',
          '3. Match the invoice to the delivery note.',
          '4. Schedule the payment within the agreed terms.',
        ],
        diagram: diagramFive,
        changeSummary: 'Added invoice exception rule',
        createdBy: 'u-jm', approvedBy: 'u-mc', createdAt: '26 Sep 2026',
      },
      {
        id: 'sop-invoice-v2', sopId: 'sop-invoice', versionNumber: 2, status: 'superseded',
        bodyContent: ['Digitized the intake form.'],
        diagram: diagramFive,
        changeSummary: 'Digitized intake form',
        createdBy: 'u-jm', createdAt: '08 Aug 2026',
      },
    ],
  },
  {
    id: 'sop-vendor',
    title: 'New vendor onboarding',
    departmentId: 'dept-proc',
    ownerId: 'u-ar',
    updatedAt: '1 week ago',
    versions: [
      {
        id: 'sop-vendor-v1-8', sopId: 'sop-vendor', versionNumber: 1.8, status: 'published',
        bodyContent: [
          'Steps',
          '1. Capture the vendor record with banking details.',
          '2. Run the due diligence checks.',
          '3. Submit the first invoice for approval before activation.',
        ],
        diagram: diagramFive,
        changeSummary: 'Updated due diligence steps',
        createdBy: 'u-ar', approvedBy: 'u-mc', createdAt: '21 Sep 2026',
      },
      {
        id: 'sop-vendor-v1-7', sopId: 'sop-vendor', versionNumber: 1.7, status: 'superseded',
        bodyContent: ['Added tax form requirement.'],
        diagram: diagramFive,
        changeSummary: 'Added tax form requirement',
        createdBy: 'u-ar', createdAt: '02 Jul 2026',
      },
    ],
  },
  {
    id: 'sop-expense',
    title: 'Expense reimbursement',
    departmentId: 'dept-fin',
    ownerId: 'u-jm',
    updatedAt: '2 hours ago',
    versions: [
      {
        id: 'sop-expense-v2', sopId: 'sop-expense', versionNumber: 2, status: 'pending_approval',
        bodyContent: [
          'Steps',
          '1. Employees submit receipts within 30 days of the expense.',
          '2. The manager reviews and approves the claim.',
          '3. Finance processes approved claims within 5 business days.',
        ],
        diagram: diagramFive,
        changeSummary: 'Reduced Finance processing time from 10 to 5 business days',
        createdBy: 'u-jm', createdAt: '02 Oct 2026',
      },
      {
        id: 'sop-expense-v1', sopId: 'sop-expense', versionNumber: 1, status: 'published',
        bodyContent: [
          'Steps',
          '1. Employees submit receipts within 30 days of the expense.',
          '2. The manager reviews and approves the claim.',
          '3. Finance processes approved claims within 10 business days.',
        ],
        diagram: diagramFive,
        changeSummary: 'Initial publication',
        createdBy: 'u-mc', approvedBy: 'u-mc', createdAt: '05 May 2026',
      },
    ],
  },
  {
    id: 'sop-remote',
    title: 'Remote work request',
    departmentId: 'dept-hr',
    ownerId: 'u-sl',
    updatedAt: '5 hours ago',
    versions: [
      {
        id: 'sop-remote-v3-1', sopId: 'sop-remote', versionNumber: 3.1, status: 'pending_approval',
        bodyContent: [
          'Steps',
          '1. Employee submits the remote work request form.',
          '2. Manager approves the request and the schedule.',
          '3. HR confirms equipment and onboarding requirements.',
        ],
        diagram: diagramFive,
        changeSummary: 'Updated approval limits',
        createdBy: 'u-sl', createdAt: '02 Oct 2026',
      },
      {
        id: 'sop-remote-v3', sopId: 'sop-remote', versionNumber: 3, status: 'published',
        bodyContent: ['Added the equipment policy appendix.'],
        diagram: diagramFive,
        changeSummary: 'Added equipment policy',
        createdBy: 'u-sl', approvedBy: 'u-mc', createdAt: '08 Aug 2026',
      },
      {
        id: 'sop-remote-v2', sopId: 'sop-remote', versionNumber: 2, status: 'rejected',
        bodyContent: ['Missing compliance section.'],
        diagram: diagramFive,
        changeSummary: 'Rejected — missing compliance section',
        createdBy: 'u-sl', createdAt: '30 Jun 2026',
      },
    ],
  },
  {
    id: 'sop-it',
    title: 'IT access provisioning',
    departmentId: 'dept-it',
    ownerId: 'u-dp',
    updatedAt: 'Yesterday',
    versions: [
      {
        id: 'sop-it-v1-2', sopId: 'sop-it', versionNumber: 1.2, status: 'pending_approval',
        bodyContent: [
          'Steps',
          '1. Requester submits the access form.',
          '2. Manager approves the level of access.',
          '3. IT provisions the accounts within two business days.',
          '4. Access is revoked automatically at offboarding.',
        ],
        diagram: diagramFive,
        changeSummary: 'Added offboarding step',
        createdBy: 'u-dp', createdAt: '01 Oct 2026',
      },
      {
        id: 'sop-it-v1-1', sopId: 'sop-it', versionNumber: 1.1, status: 'published',
        bodyContent: ['Streamlined the request form.'],
        diagram: diagramFive,
        changeSummary: 'Streamlined request form',
        createdBy: 'u-dp', approvedBy: 'u-mc', createdAt: '18 Aug 2026',
      },
    ],
  },
  {
    id: 'sop-leave',
    title: 'Leave request',
    departmentId: 'dept-hr',
    ownerId: 'u-sl',
    updatedAt: '3 days ago',
    versions: [
      {
        id: 'sop-leave-v2-2', sopId: 'sop-leave', versionNumber: 2.2, status: 'published',
        bodyContent: [
          'Steps',
          '1. Employee submits the leave request at least 2 weeks ahead.',
          '2. Manager approves or declines.',
          '3. HR records the days against the balance.',
        ],
        diagram: diagramFive,
        changeSummary: 'Updated manager approval rule',
        createdBy: 'u-sl', approvedBy: 'u-mc', createdAt: '22 Sep 2026',
      },
      {
        id: 'sop-leave-v2-1', sopId: 'sop-leave', versionNumber: 2.1, status: 'superseded',
        bodyContent: ['Clarified handover expectations.'],
        diagram: diagramFive,
        changeSummary: 'Clarified handover expectations',
        createdBy: 'u-sl', createdAt: '11 Jul 2026',
      },
    ],
  },
  {
    id: 'sop-warehouse',
    title: 'Warehouse receiving',
    departmentId: 'dept-ops',
    ownerId: 'u-ar',
    updatedAt: '2 weeks ago',
    versions: [
      {
        id: 'sop-warehouse-v1', sopId: 'sop-warehouse', versionNumber: 1, status: 'published',
        bodyContent: ['Steps', '1. Unload and verify the packing list.', '2. Check for damage.', '3. Put stock away in the assigned location.'],
        diagram: diagramFive,
        changeSummary: 'Initial publication',
        createdBy: 'u-ar', approvedBy: 'u-mc', createdAt: '04 Jun 2026',
      },
    ],
  },
  {
    id: 'sop-travel',
    title: 'Travel & expense policy',
    departmentId: 'dept-fin',
    ownerId: 'u-ar',
    updatedAt: '1 month ago',
    versions: [
      {
        id: 'sop-travel-v1-3', sopId: 'sop-travel', versionNumber: 1.3, status: 'published',
        bodyContent: ['Policy limits and booking rules for business travel.'],
        diagram: diagramFive,
        changeSummary: 'Raised accommodation limits',
        createdBy: 'u-ar', approvedBy: 'u-mc', createdAt: '01 Sep 2026',
      },
    ],
  },
  {
    id: 'sop-petty',
    title: 'Petty cash handling',
    departmentId: 'dept-fin',
    ownerId: 'u-jm',
    updatedAt: '1 month ago',
    versions: [
      {
        id: 'sop-petty-v1', sopId: 'sop-petty', versionNumber: 1, status: 'published',
        bodyContent: ['Rules for the petty cash float, receipts, and monthly count.'],
        diagram: diagramFive,
        changeSummary: 'Initial publication',
        createdBy: 'u-jm', approvedBy: 'u-mc', createdAt: '12 Aug 2026',
      },
    ],
  },
  {
    id: 'sop-inventory',
    title: 'Inventory count',
    departmentId: 'dept-ops',
    ownerId: 'u-ar',
    updatedAt: '2 months ago',
    versions: [
      {
        id: 'sop-inventory-v1', sopId: 'sop-inventory', versionNumber: 1, status: 'published',
        bodyContent: ['How the quarterly cycle count is run and reconciled.'],
        diagram: diagramFive,
        changeSummary: 'Initial publication',
        createdBy: 'u-ar', approvedBy: 'u-mc', createdAt: '10 Jul 2026',
      },
    ],
  },
  {
    id: 'sop-performance',
    title: 'Performance review cycle',
    departmentId: 'dept-hr',
    ownerId: 'u-sl',
    updatedAt: '2 months ago',
    versions: [
      {
        id: 'sop-performance-v1-2', sopId: 'sop-performance', versionNumber: 1.2, status: 'published',
        bodyContent: ['Timeline and templates for the half-year review cycle.'],
        diagram: diagramFive,
        changeSummary: 'Updated rating scale',
        createdBy: 'u-sl', approvedBy: 'u-mc', createdAt: '20 Aug 2026',
      },
    ],
  },
  {
    id: 'sop-email',
    title: 'Email & account access',
    departmentId: 'dept-it',
    ownerId: 'u-dp',
    updatedAt: '2 months ago',
    versions: [
      {
        id: 'sop-email-v1-1', sopId: 'sop-email', versionNumber: 1.1, status: 'published',
        bodyContent: ['Password policy and account recovery steps.'],
        diagram: diagramFive,
        changeSummary: 'Added MFA requirement',
        createdBy: 'u-dp', approvedBy: 'u-mc', createdAt: '05 Aug 2026',
      },
    ],
  },
  {
    id: 'sop-incident',
    title: 'Incident reporting',
    departmentId: 'dept-it',
    ownerId: 'u-dp',
    updatedAt: '3 months ago',
    versions: [
      {
        id: 'sop-incident-v1', sopId: 'sop-incident', versionNumber: 1, status: 'published',
        bodyContent: ['How IT incidents are reported, triaged, and escalated.'],
        diagram: diagramFive,
        changeSummary: 'Initial publication',
        createdBy: 'u-dp', approvedBy: 'u-mc', createdAt: '14 Jun 2026',
      },
    ],
  },
  {
    id: 'sop-kickoff',
    title: 'Client kickoff',
    departmentId: 'dept-cs',
    ownerId: 'u-ms',
    updatedAt: '3 months ago',
    versions: [
      {
        id: 'sop-kickoff-v1', sopId: 'sop-kickoff', versionNumber: 1, status: 'published',
        bodyContent: ['Kickoff call agenda and handover checklist.'],
        diagram: diagramFive,
        changeSummary: 'Initial publication',
        createdBy: 'u-ms', approvedBy: 'u-mc', createdAt: '30 May 2026',
      },
    ],
  },
];

/* --------------------------- Approval queue -------------------------- */

export const approvalTasks: MockApprovalTask[] = [
  { id: 'ap-1', sopId: 'sop-expense', submittedBy: 'u-jm', submittedAt: '2 hours ago', priority: 'high' },
  { id: 'ap-2', sopId: 'sop-remote', submittedBy: 'u-sl', submittedAt: '5 hours ago', priority: 'standard' },
  { id: 'ap-3', sopId: 'sop-it', submittedBy: 'u-dp', submittedAt: 'Yesterday', priority: 'standard' },
  { id: 'ap-4', sopId: 'sop-onboarding', submittedBy: 'u-sl', submittedAt: 'Yesterday', priority: 'standard' },
];

/** Diagram used when a new SOP is created and has been drafted already. */
export const defaultDraftDiagram: MockDiagramNode[] = diagramFull;