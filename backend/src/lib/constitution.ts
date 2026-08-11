import type { ChamaType, VotingModel } from '../db/schema.js';

const TYPE_LABEL: Record<ChamaType, string> = {
  investment_group: 'investment group',
  sacco: 'SACCO-style savings society',
  hybrid: 'hybrid investment & savings society',
};

const VOTING_LABEL: Record<VotingModel, string> = {
  one_member_one_vote: 'one member, one vote',
  shareholding_weighted: 'voting weighted by each member\'s shareholding',
};

export interface DefaultConstitutionInput {
  chamaName: string;
  county?: string | null;
  chamaType: ChamaType;
  votingModel: VotingModel;
  minimumContribution: string;
  contributionDueDay?: number | null;
  penaltyRule?: { type: 'flat'; amount: number } | { type: 'percent_per_day'; rate: number } | null;
  lendingEnabled: boolean;
}

/**
 * Generate a sane default constitution the founder can edit inline before
 * accepting. Content is stored as versioned markdown; amendments create new
 * versions — never overwrite.
 */
export function generateDefaultConstitution(input: DefaultConstitutionInput): string {
  const {
    chamaName,
    county,
    chamaType,
    votingModel,
    minimumContribution,
    contributionDueDay,
    penaltyRule,
    lendingEnabled,
  } = input;

  const dueLine = contributionDueDay
    ? `Contributions are due on the **${ordinal(contributionDueDay)}** day of every month.`
    : `The monthly contribution due date is set by the committee and communicated to all members.`;

  const penaltyLine = penaltyRule
    ? penaltyRule.type === 'flat'
      ? `Members who contribute late are subject to a flat penalty of **KES ${penaltyRule.amount}** per late contribution.`
      : `Members who contribute late are subject to a penalty of **${(penaltyRule.rate * 100).toFixed(2)}% of the contribution per day** until paid.`
    : `The penalty rule for late contributions is decided by the committee and documented in the amendments log.`;

  const lendingLine = lendingEnabled
    ? 'The chama may operate a lending module, with lending terms governed by a separate lending policy approved by members.'
    : 'The chama does not operate a lending module at this time.';

  return `# Constitution of ${chamaName}${county ? ` (${county})` : ''}

*Version 1 — adopted on formation of the chama.*

## Article 1 — Name and Purpose
1.1 This society shall be known as **${chamaName}**${county ? `, operating in ${county}` : ''}.
1.2 It is established as a ${TYPE_LABEL[chamaType]} under the shared-governance rules of the Mraru platform.
1.3 The purpose of the chama is to pool member contributions for collective investment and savings, and to manage those funds for the benefit of all members.

## Article 2 — Membership
2.1 Membership is open to any person whose application is approved by the committee in line with Mraru's onboarding process.
2.2 Every member must provide their verified national identity details, contact information, and a next of kin.
2.3 Membership is personal and may not be transferred.

## Article 3 — Governance and Voting
3.1 The chama shall be governed by a committee comprising at least a Chairperson, a Treasurer, and a Secretary.
3.2 The Chairperson presides over meetings and represents the chama; the Treasurer is custodian of chama funds; the Secretary maintains records and correspondence.
3.3 Voting on matters put to the membership shall follow the principle of **${VOTING_LABEL[votingModel]}**.
3.4 The chama may adopt amendments to this constitution by a resolution passed by a majority of active members. Amendments are recorded as new versions of this constitution and never overwrite earlier versions.

## Article 4 — Contributions
4.1 Every member shall contribute a minimum of **KES ${minimumContribution}** monthly.
4.2 ${dueLine}
4.3 ${penaltyLine}

## Article 5 — Funds and Records
5.1 All chama funds shall be held in accounts controlled by the Treasurer and reported transparently to members.
5.2 The Secretary shall maintain accurate minutes and registers, including the membership register and the audit log of key decisions.

## Article 6 — Lending
6.1 ${lendingLine}

## Article 7 — Withdrawal and Exit
7.1 A member who wishes to exit shall notify the committee in writing. Outstanding obligations must be settled before exit.
7.2 In the event of a member's death, the member's next of kin shall be supported to claim any benefits due, per the chama's rules.

## Article 8 — Amendments
8.1 This constitution may be amended by resolution as set out in Article 3.4. Each amendment is appended as a new version and requires members to accept the new version.

*Adopted by the founding members of ${chamaName} on the date of the chama's formation.*
`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
