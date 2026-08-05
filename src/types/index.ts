export type UserRole = 'ADMIN' | 'VOTER';

export interface UserVoter {
  id: string;
  nim: string;
  name: string;
  role: UserRole;
  hasVoted: boolean;
  votedAt?: Date | null;
}

export interface Candidate {
  id: number;
  candidateNumber: number;
  name: string;
  photoUrl?: string | null;
  vision?: string | null;
  mission?: string | null;
}

export interface VoteRecord {
  id: string;
  candidateId?: number | null;
  isValid: boolean;
  createdAt: Date;
}

export interface QuickCountSummary {
  totalVoters: number;
  totalVotesCast: number;
  turnoutPercentage: number;
  invalidVotes: number;
  candidateResults: {
    candidateId: number;
    candidateNumber: number;
    name: string;
    voteCount: number;
    percentage: number;
  }[];
}
