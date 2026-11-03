import { api } from './api.js';
import { initLayout } from './layout.js';
import { esc, showLoading, showError, emptyHtml, fmtDate, fmtDay, fmtDateTime, fmtTime, fmtMoney, fmtPct } from './ui.js';

const content = document.getElementById('content');
const ACTION_TEXT = { login: 'logged in', password_changed: 'changed their password' };

const stat = (label, value, note = '') =>
  `<div class="col-6 col-lg"><div class="stat"><div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}</div>${note ? `<div class="stat-note">${esc(note)}</div>` : ''}</div></div>`;

const panel = (title, body, { flush = false, aside = '' } = {}) =>
  `<section class="panel h-100"><div class="panel-head"><h2>${esc(title)}</h2>${aside}</div><div class="panel-body${flush ? ' flush' : ''}">${body}</div></section>`;

const meter = (pct) => {
  const cls = pct === null ? '' : pct < 75 ? 'low' : pct < 85 ? 'mid' : '';
  return `<div class="meter ${cls}" role="img" aria-label="Attendance ${pct ?? 0} percent"><span style="width:${Math.min(pct ?? 0, 100)}%"></span></div>`;
};

const noticesPanel = (notices) =>
  panel('Notices', notices.length
    ? `<ul class="list-plain">${notices.map((n) => `<li><div class="fw-semibold">${esc(n.title)}</div><div class="muted small">${fmtDate(n.publish_date)}</div></li>`).join('')}</ul>`
    : emptyHtml('No notices', 'New notices from the school will appear here.', 'fa-bell'), { flush: notices.length > 0 });

const eventsPanel = (events = []) =>
  panel('Upcoming events', events.length
    ? `<ul class="list-plain">${events.map((e) => `<li><div class="fw-semibold">${esc(e.title)}</div><div class="muted small">${fmtDate(e.startDate)}${e.endDate && e.endDate !== e.startDate ? ` to ${fmtDate(e.endDate)}` : ''}</div></li>`).join('')}</ul>`
    : emptyHtml('No upcoming events', 'The school calendar will show here.', 'fa-calendar-days'), { flush: events.length > 0 });

const yearBanner = (d) => (d.hasAcademicYear ? '' :
  `<div class="alert alert-warning" role="status">No current academic year is set, so class, exam and fee figures are empty until one is created.</div>`);

const head = (title, sub) => `<div class="page-head mb-4"><h1>${esc(title)}</h1>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;

const examsTable = (rows, withClass) =>
  rows.length
    ? `<div class="table-responsive"><table class="table"><thead><tr><th>Date</th>${withClass ? '<th>Class</th>' : ''}<th>Exam</th><th>Subject</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${fmtDay(r.exam_date)}</td>${withClass ? `<td>${esc(r.class_name)}</td>` : ''}<td>${esc(r.exam)}</td><td>${esc(r.subject)}</td></tr>`).join('')}</tbody></table></div>`
    : emptyHtml('No upcoming exams', 'Scheduled exams will show up here.', 'fa-file-pen');

function renderAdmin(d) {
  const t = d.stats.todayAttendance;
  const attendanceValue = t.studentsMarked ? fmtPct(t.pct) : '-';
  const attendanceNote = t.studentsMarked ? `${t.present} present, ${t.absent} absent` : 'Not marked yet today';
  content.innerHTML = `
    ${head('School overview', d.academicYear ? `Academic year ${d.academicYear}` : '')}
    ${yearBanner(d)}
    <div class="row g-3 mb-4">
      ${stat('Students', d.stats.students)}
      ${stat('Teachers', d.stats.teachers)}
      ${stat('Classes', d.stats.classes)}
      ${stat("Today's attendance", attendanceValue, attendanceNote)}
      ${stat('Pending fees', fmtMoney(d.stats.pendingFees))}
    </div>
    <div class="row g-3 mb-4">
      <div class="col-lg-6">${panel('Attendance, last 7 days', d.charts.attendanceTrend.length ? '<div class="chart-box"><canvas id="chart-attendance"></canvas></div>' : emptyHtml('No attendance yet', 'Teachers\' attendance entries will chart here.', 'fa-chart-line'))}</div>
      <div class="col-lg-6">${panel('Enrollment by class', d.charts.enrollment.length ? '<div class="chart-box"><canvas id="chart-enrollment"></canvas></div>' : emptyHtml('No classes yet', 'Enrollment appears once classes and students are added.', 'fa-chart-column'))}</div>
    </div>
    <div class="row g-3 mb-4">
      <div class="col-lg-6">${panel('Fees collected, last 6 months', d.charts.feeCollection.some((m) => m.amount > 0) ? '<div class="chart-box"><canvas id="chart-fees"></canvas></div>' : emptyHtml('No payments yet', 'Recorded payments will chart here.', 'fa-indian-rupee-sign'))}</div>
      <div class="col-lg-6">${panel('Average score by exam', d.charts.performance.length ? '<div class="chart-box"><canvas id="chart-performance"></canvas></div>' : emptyHtml('No marks yet', 'Averages appear once teachers enter marks.', 'fa-square-poll-vertical'))}</div>
    </div>
    <div class="row g-3">
      <div class="col-lg-7">${panel('Upcoming exams', examsTable(d.upcomingExams, true), { flush: d.upcomingExams.length > 0 })}</div>
      <div class="col-lg-5">${panel('Recent activity', d.recentActivities.length
        ? `<ul class="list-plain">${d.recentActivities.map((a) => `<li><span class="fw-semibold">${esc(a.user_name || 'Someone')}</span> ${esc(ACTION_TEXT[a.action] || a.action.replace(/_/g, ' '))}<div class="muted small">${fmtDateTime(a.created_at)}</div></li>`).join('')}</ul>`
        : emptyHtml('No activity yet', '', 'fa-clock-rotate-left'), { flush: d.recentActivities.length > 0 })}</div>
    </div>
    <div class="row g-3 mt-1"><div class="col-lg-6">${eventsPanel(d.events)}</div></div>`;

  const font = { family: "'Source Sans 3', sans-serif" };
  if (d.charts.attendanceTrend.length) {
    new Chart(document.getElementById('chart-attendance'), {
      type: 'line',
      data: {
        labels: d.charts.attendanceTrend.map((r) => fmtDay(r.day)),
        datasets: [{ label: 'Attendance %', data: d.charts.attendanceTrend.map((r) => r.pct), borderColor: '#1d3a34', backgroundColor: '#1d3a34', tension: 0.25 }],
      },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { font } }, x: { ticks: { font } } } },
    });
  }
  if (d.charts.feeCollection.some((m) => m.amount > 0)) {
    new Chart(document.getElementById('chart-fees'), {
      type: 'bar',
      data: { labels: d.charts.feeCollection.map((m) => m.label), datasets: [{ label: 'Collected (Rs.)', data: d.charts.feeCollection.map((m) => m.amount), backgroundColor: '#1d3a34' }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { font } }, x: { ticks: { font } } } },
    });
  }
  if (d.charts.performance.length) {
    new Chart(document.getElementById('chart-performance'), {
      type: 'bar',
      data: { labels: d.charts.performance.map((p) => p.label), datasets: [{ label: 'Average %', data: d.charts.performance.map((p) => p.percentage), backgroundColor: '#b9780f' }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100, ticks: { font } }, x: { ticks: { font } } } },
    });
  }
  if (d.charts.enrollment.length) {
    new Chart(document.getElementById('chart-enrollment'), {
      type: 'bar',
      data: { labels: d.charts.enrollment.map((r) => r.label), datasets: [{ label: 'Students', data: d.charts.enrollment.map((r) => r.value), backgroundColor: '#b9780f' }] },
      options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0, font } }, x: { ticks: { font } } } },
    });
  }
}

function renderTeacher(d, user) {
  content.innerHTML = `
    ${head(`Welcome, ${user.name}`, d.academicYear ? `Academic year ${d.academicYear}` : '')}
    ${yearBanner(d)}
    <p class="mb-3"><a class="btn btn-primary btn-sm" href="/pages/attendance.html"><i class="fa-solid fa-clipboard-user me-1"></i>Mark attendance</a></p>
    <div class="row g-3 mb-4">
      ${stat('Sections', d.stats.sections)}
      ${stat('Subjects you teach', d.stats.subjectsTaught)}
      ${stat('Students', d.stats.studentsReached)}
      ${stat('Periods today', d.stats.periodsToday)}
    </div>
    <div class="row g-3">
      <div class="col-lg-7">${panel("Today's schedule", d.todaySchedule.length
        ? `<div class="table-responsive"><table class="table"><thead><tr><th>Period</th><th>Time</th><th>Class</th><th>Subject</th><th>Room</th></tr></thead><tbody>${d.todaySchedule.map((r) => `<tr><td>${r.period_no}</td><td>${fmtTime(r.start_time)} - ${fmtTime(r.end_time)}</td><td>${esc(r.class_name)} ${esc(r.section_name)}</td><td>${esc(r.subject)}</td><td>${esc(r.room || '-')}</td></tr>`).join('')}</tbody></table></div>`
        : emptyHtml('No periods today', 'Your timetable slots for today will appear here.', 'fa-calendar-day'), { flush: d.todaySchedule.length > 0 })}
      </div>
      <div class="col-lg-5"><div class="mb-3">${noticesPanel(d.notices)}</div>${eventsPanel(d.events)}</div>
      <div class="col-12">${panel('Your classes', d.assigned.length
        ? `<div class="table-responsive"><table class="table"><thead><tr><th>Class</th><th>Section</th><th>Subject</th><th class="text-end">Students</th></tr></thead><tbody>${d.assigned.map((a) => `<tr><td>${esc(a.class_name)}</td><td>${esc(a.section_name)}</td><td>${esc(a.subject)}</td><td class="text-end">${a.students}</td></tr>`).join('')}</tbody></table></div>`
        : emptyHtml('No classes assigned', 'The school office assigns subjects to you. They will list here.', 'fa-chalkboard-user'), { flush: d.assigned.length > 0 })}
      </div>
    </div>`;
}

function studentBlock(s) {
  const placement = s.className ? `${s.className} ${s.sectionName}${s.rollNo ? `, roll ${s.rollNo}` : ''}` : 'Not enrolled in the current year';
  return `
    <div class="row g-3 mb-4">
      ${stat('Class', s.className ? `${s.className} ${s.sectionName}` : '-', s.rollNo ? `Roll no. ${s.rollNo}` : placement)}
      <div class="col-6 col-lg"><div class="stat"><div class="stat-label">Attendance</div><div class="stat-value">${fmtPct(s.attendancePercent)}</div><div class="mt-2">${meter(s.attendancePercent)}</div></div></div>
      ${stat('Fee due', fmtMoney(s.fees.remaining), `${fmtMoney(s.fees.paid)} paid of ${fmtMoney(s.fees.total)}`)}
    </div>
    ${panel('Upcoming exams', examsTable(s.upcomingExams, false), { flush: s.upcomingExams.length > 0 })}
    ${s.performance && s.performance.length ? `<div class="mt-3">${panel('Score in each exam', `<div class="chart-box"><canvas id="chart-perf-${s.id}"></canvas></div>`)}</div>` : ''}`;
}

function drawPerformance(s) {
  const el = document.getElementById(`chart-perf-${s.id}`);
  if (!el || !s.performance || !s.performance.length) return;
  new Chart(el, {
    type: 'line',
    data: { labels: s.performance.map((p) => p.name), datasets: [{ label: 'Score %', data: s.performance.map((p) => p.percentage), borderColor: '#b9780f', backgroundColor: '#b9780f', tension: 0.25 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 100 } } },
  });
}

function renderStudent(d) {
  content.innerHTML = `
    ${head(`Welcome, ${d.student.name}`, `Admission no. ${d.student.admissionNo}${d.academicYear ? ` - ${d.academicYear}` : ''}`)}
    <p class="mb-3"><a href="/pages/student.html?id=${d.student.id}">View my profile</a></p>
    ${yearBanner(d)}
    <div class="row g-3"><div class="col-lg-8">${studentBlock(d.student)}</div><div class="col-lg-4"><div class="mb-3">${noticesPanel(d.notices)}</div>${eventsPanel(d.events)}</div></div>`;
  drawPerformance(d.student);
}

function renderParent(d) {
  content.innerHTML = `
    ${head('Your children', d.academicYear ? `Academic year ${d.academicYear}` : '')}
    ${yearBanner(d)}
    <div class="row g-3">
      <div class="col-lg-8">
        ${d.children.length
          ? d.children.map((c) => `<div class="mb-4"><h2 class="h5 mb-3"><a class="text-decoration-none" href="/pages/student.html?id=${c.id}">${esc(c.name)}</a> <span class="muted fs-6">(${esc(c.relation)})</span></h2>${studentBlock(c)}</div>`).join('')
          : panel('Children', emptyHtml('No children linked yet', 'The school office links your account to your child. Contact them if this looks wrong.', 'fa-children'))}
      </div>
      <div class="col-lg-4"><div class="mb-3">${noticesPanel(d.notices)}</div>${eventsPanel(d.events)}</div>
    </div>`;
  d.children.forEach(drawPerformance);
}

async function load(user) {
  showLoading(content, 'Loading your dashboard...');
  try {
    const d = await api.get('/api/reports/dashboard');
    ({ admin: renderAdmin, teacher: renderTeacher, student: renderStudent, parent: renderParent })[d.role](d, user);
  } catch (err) {
    showError(content, err.message, () => load(user));
  }
}

initLayout('dashboard', 'Dashboard').then(load).catch((err) => showError(content, err.message));
