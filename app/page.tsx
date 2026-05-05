import Link from "next/link";
import { AuthNav } from "@/components/AuthNav";
import { courses } from "@/lib/sample-data";

export default function HomePage() {
  const course = courses[0];

  return (
    <main className="shell">
      <nav className="topbar">
        <Link className="brand" href="/">
          Chandra
        </Link>
        <AuthNav />
      </nav>

      <section className="workspace two-column">
        <div className="intro-panel">
          <p className="eyebrow">{course.name} / {course.section}</p>
          <h1>Teacher-guided AI tutoring that keeps students doing the thinking.</h1>
          <p>
            Chandra lets teachers set the tutoring behavior, ground answers in course material,
            and review where students are getting stuck.
          </p>
          <div className="button-row">
            <Link className="primary-button" href="/student">
              Open Student Chat
            </Link>
            <Link className="secondary-button" href="/teacher">
              Open Teacher Dashboard
            </Link>
            <Link className="secondary-button" href="/auth">
              Create Account
            </Link>
          </div>
        </div>

        <div className="snapshot-grid" aria-label="Current classroom snapshot">
          <div className="metric-card">
            <span>Active policy</span>
            <strong>Socratic coach</strong>
          </div>
          <div className="metric-card">
            <span>Sources ready</span>
            <strong>2</strong>
          </div>
          <div className="metric-card">
            <span>Student conversations</span>
            <strong>1</strong>
          </div>
          <div className="metric-card">
            <span>Common topic</span>
            <strong>Factoring</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
