-- CreateTable
CREATE TABLE "instructors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructor_id" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "owner_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "access_mode" TEXT NOT NULL DEFAULT 'public',
    "share_token" TEXT,
    "duration_seconds" INTEGER NOT NULL DEFAULT 600,
    "reveal_answers" BOOLEAN NOT NULL DEFAULT false,
    "reveal_scores" BOOLEAN NOT NULL DEFAULT true,
    "examinee_fields" TEXT NOT NULL DEFAULT '[]',
    "questions" TEXT NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "quizzes_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "instructors" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quiz_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invites_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quiz_id" TEXT NOT NULL,
    "examinee" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "started_at" DATETIME NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "violations" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "attempts_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quiz_id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "examinee" TEXT NOT NULL,
    "answers" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "max_score" REAL NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "started_at" DATETIME NOT NULL,
    "submitted_at" DATETIME NOT NULL,
    "violations" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL DEFAULT 'manual',
    CONSTRAINT "submissions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "submissions_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "violation_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attempt_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "occurred_at" DATETIME NOT NULL,
    CONSTRAINT "violation_events_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "instructors_email_key" ON "instructors"("email");

-- CreateIndex
CREATE INDEX "sessions_instructor_id_idx" ON "sessions"("instructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_share_token_key" ON "quizzes"("share_token");

-- CreateIndex
CREATE INDEX "quizzes_owner_id_idx" ON "quizzes"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invites_quiz_id_email_key" ON "invites"("quiz_id", "email");

-- CreateIndex
CREATE INDEX "attempts_quiz_id_idx" ON "attempts"("quiz_id");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_attempt_id_key" ON "submissions"("attempt_id");

-- CreateIndex
CREATE INDEX "submissions_quiz_id_idx" ON "submissions"("quiz_id");

-- CreateIndex
CREATE INDEX "submissions_quiz_id_score_duration_seconds_submitted_at_idx" ON "submissions"("quiz_id", "score", "duration_seconds", "submitted_at");

-- CreateIndex
CREATE INDEX "violation_events_attempt_id_idx" ON "violation_events"("attempt_id");
