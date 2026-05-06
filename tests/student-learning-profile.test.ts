import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

test("active reviewed profile appears in the tutor prompt", () => {
  const promptSource = readFileSync(join(repoRoot, "lib/prompts.ts"), "utf8");
  const chatRouteSource = readFileSync(join(repoRoot, "app/api/chat/route.ts"), "utf8");
  const profileSource = readFileSync(join(repoRoot, "lib/student-learning-profiles-server.ts"), "utf8");

  assert.match(promptSource, /Private student learning profile/);
  assert.match(chatRouteSource, /getActiveStudentLearningProfileDigest/);
  assert.match(chatRouteSource, /studentLearningProfileDigest/);
  assert.match(profileSource, /if \(!profileDocument\?\.active \|\| !profileDocument\.teacherReviewed \|\| !profileDocument\.activeProfile\)/);
  assert.match(profileSource, /return buildStudentLearningProfileDigest\(profileDocument\)/);
});

test("unreviewed draft profile does not appear in the tutor prompt", () => {
  const profileSource = readFileSync(join(repoRoot, "lib/student-learning-profiles-server.ts"), "utf8");

  assert.match(profileSource, /draftProfile/);
  assert.match(profileSource, /!profileDocument\.teacherReviewed/);
  assert.match(profileSource, /return ""/);
});

test("profile prompt says profile is private and subordinate to teacher policy", () => {
  const promptSource = readFileSync(join(repoRoot, "lib/prompts.ts"), "utf8");

  assert.match(promptSource, /profile is private/);
  assert.match(promptSource, /Do not reveal, quote, summarize, or mention it to the student/);
  assert.match(promptSource, /subordinate to teacher policy, academic integrity rules, source-use rules, safety boundaries/);
  assert.match(promptSource, /Do not use the profile for grading, discipline, placement, diagnosis/);
});

test("weekly updater skips content update and updates pending counts when below thresholds", () => {
  const source = readFileSync(join(repoRoot, "lib/student-learning-profiles-server.ts"), "utf8");

  assert.match(source, /if \(!force && !thresholdMet\)/);
  assert.match(source, /pendingConversationCount: counts\.pendingConversationCount/);
  assert.match(source, /pendingStudentMessageCount: counts\.pendingStudentMessageCount/);
  assert.match(source, /draftProfile/);
});

test("updater runs when conversation or message threshold is met", () => {
  const source = readFileSync(join(repoRoot, "lib/student-learning-profiles-server.ts"), "utf8");

  assert.match(source, /counts\.pendingConversationCount >= minimumConversationsForUpdate\s*\|\|/);
  assert.match(source, /counts\.pendingStudentMessageCount >= minimumStudentMessagesForUpdate/);
  assert.match(source, /defaultMinimumConversationsForUpdate = 3/);
  assert.match(source, /defaultMinimumStudentMessagesForUpdate = 8/);
});

test("unsafe fields and oversized model output are removed or truncated", () => {
  const source = readFileSync(join(repoRoot, "lib/student-learning-profiles-server.ts"), "utf8");

  assert.match(source, /const maxSummaryLength = 800/);
  assert.match(source, /const maxArrayItems = 8/);
  assert.match(source, /const maxArrayItemLength = 240/);
  assert.match(source, /const maxEvidenceItems = 20/);
  assert.match(source, /const maxTriedStrategies = 12/);
  assert.match(source, /profileChangeNotes: sanitizeProfileTextArray\(source\.profileChangeNotes\)/);
  assert.match(source, /unsafeStudentLabels/);
  assert.match(source, /return ""/);
  assert.match(source, /text\.length > maxLength \? text\.slice\(0, maxLength\)\.trimEnd\(\) : text/);
});

test("strategy statuses are validated", () => {
  const source = readFileSync(join(repoRoot, "lib/student-learning-profiles-server.ts"), "utf8");

  assert.match(source, /"currently_testing"/);
  assert.match(source, /"appears_unhelpful"/);
  assert.match(source, /"retired"/);
  assert.match(source, /export function isStudentLearningStrategyStatus/);
  assert.match(source, /status = isStudentLearningStrategyStatus\(rawStatus\) \? rawStatus : "inconclusive"/);
});

test("model can provide profile change notes for teacher review", () => {
  const profileSource = readFileSync(join(repoRoot, "lib/student-learning-profiles-server.ts"), "utf8");
  const teacherSource = readFileSync(join(repoRoot, "components/TeacherClassManager.tsx"), "utf8");

  assert.match(profileSource, /In profileChangeNotes, briefly explain meaningful changes/);
  assert.match(profileSource, /profileChangeNotes/);
  assert.match(teacherSource, /Model change notes/);
  assert.match(teacherSource, /Changes in new draft/);
});

test("teacher-only learning profile routes enforce authorization", () => {
  const routeSource = readFileSync(
    join(repoRoot, "app/api/classes/[classId]/students/[studentId]/learning-profile/route.ts"),
    "utf8"
  );
  const rules = readFileSync(join(repoRoot, "firestore.rules"), "utf8");

  assert.match(routeSource, /authorizeClassTeacher\(request, classId\)/);
  assert.match(routeSource, /updateOneStudentLearningProfile/);
  assert.match(routeSource, /approveStudentLearningProfile/);
  assert.match(rules, /match \/studentLearningProfiles\/\{profileId\}/);
  assert.match(rules, /allow read: if isTargetClassTeacher\(classId\)/);
  assert.match(rules, /allow write: if false/);
});
