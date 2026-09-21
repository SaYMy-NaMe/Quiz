import type { ExamineeRecord } from './schema-field';

export interface LeaderboardEntry {
  rank: number;
  submissionId: string;
  displayName: string;
  examinee: ExamineeRecord;
  score: number;
  maxScore: number;
  durationSeconds: number;
  submittedAt: string;
}

export interface Leaderboard {
  quizId: string;
  title: string;
  generatedAt: string;
  entries: LeaderboardEntry[];
}
