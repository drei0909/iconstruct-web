// src/utils/biddingSchedule.js
// Authoritative helper for project bidding schedules, deadlines, status, and policy compliance.

import { toDate, formatDateTime, formatDate, formatTime } from "./dateTime";

export const BIDDING_CLOSED_STATUSES = new Set([
  "closed",
  "cancelled",
  "canceled",
  "completed",
  "rejected",
  "deleted",
  "offer_accepted",
]);

/**
 * Exhaustively resolves the quotation submission deadline from all possible database fields.
 * Returns null if no deadline is specified (older projects), without any hardcoded dates.
 */
export function resolveProjectDeadline(project) {
  if (!project || typeof project !== "object") return null;

  const candidates = [
    project.biddingDeadline,
    project.bidding_deadline,
    project.quotationDeadline,
    project.quotation_deadline,
    project.quoteDeadline,
    project.quote_deadline,
    project.deadline,
    project.biddingEndDate,
    project.bidding_end_date,
    project.biddingEnd,
    project.bidding_end,
    project.biddingClosesAt,
    project.bidding_closes_at,
    project.closesAt,
    project.closes_at,
    project.closeDate,
    project.close_date,
    project.closingDate,
    project.closing_date,
    project.deadlineDate,
    project.deadline_date,
    project.endDate,
    project.end_date,
    project.dueDate,
    project.due_date,
    project.targetDate,
    project.target_date,
    project.expiresAt,
    project.expires_at,
    project.expiryDate,
    project.expiry_date,
    project.submissionDeadline,
    project.submission_deadline,
    project.newDeadline,
    project.new_deadline,
  ];

  for (const cand of candidates) {
    if (cand != null && cand !== "") {
      const d = toDate(cand);
      if (d) return d;
    }
  }

  // Combined date and time
  const dateParts = [
    project.deadlineDate, project.deadline_date,
    project.closingDate, project.closing_date,
    project.newDeadlineDate, project.new_deadline_date,
    project.closeDate, project.close_date,
  ];
  const timeParts = [
    project.deadlineTime, project.deadline_time,
    project.closingTime, project.closing_time,
    project.newDeadlineTime, project.new_deadline_time,
    project.closeTime, project.close_time,
  ];
  for (const dp of dateParts) {
    if (!dp) continue;
    for (const tp of timeParts) {
      if (!tp) continue;
      const combined = toDate(`${dp} ${tp}`);
      if (combined) return combined;
    }
    const solo = toDate(dp);
    if (solo) return solo;
  }

  // Nested candidate objects
  const parents = [
    project.deadlineChange, project.deadline_change,
    project.bidding, project.schedule, project.biddingSchedule,
    project.meta, project.siteDetails,
  ];
  for (const p of parents) {
    if (p && typeof p === "object") {
      const nested = resolveProjectDeadline(p);
      if (nested) return nested;
    }
  }

  // Check deadline history
  const history = Array.isArray(project.deadlineHistory)
    ? project.deadlineHistory
    : Array.isArray(project.deadlineChanges)
    ? project.deadlineChanges
    : [];
  if (history.length > 0) {
    const latest = history[history.length - 1];
    const fromHist = resolveProjectDeadline(latest);
    if (fromHist) return fromHist;
  }

  // Regex scan over all keys
  for (const key of Object.keys(project)) {
    if (/(deadline|closing|closes|quote_end|bidding_end)/i.test(key)) {
      const val = project[key];
      if (val && typeof val !== "object") {
        const d = toDate(val);
        if (d) return d;
      }
    }
  }

  return null;
}

/**
 * Parses and computes the authoritative bidding schedule for a project.
 *
 * @param {object} project - Firestore projectPost document data
 * @param {number} [nowMs] - Current time in ms (defaults to Date.now())
 * @returns {object} Bidding schedule details
 */
export function getBiddingSchedule(project = {}, nowMs = Date.now()) {
  if (!project) {
    return {
      status: "closed",
      isOpen: false,
      isScheduled: false,
      isClosed: true,
      opensAt: null,
      closesAt: null,
      openFormatted: "—",
      closeFormatted: "—",
      timeRemainingMs: 0,
      remainingFormatted: "Bidding closed",
      statusLabel: "Bidding Closed",
      tone: "slate",
      deadlineChange: null,
      explanation: "Project information unavailable.",
    };
  }

  // 1. Opening Date & Time
  const opensAt =
    toDate(project.biddingStartDate) ||
    toDate(project.bidding_start_date) ||
    toDate(project.biddingOpensAt) ||
    toDate(project.bidding_opens_at) ||
    toDate(project.biddingStart) ||
    toDate(project.quotationStartDate) ||
    toDate(project.quoteStartDate) ||
    toDate(project.opensAt) ||
    toDate(project.startDate) ||
    toDate(project.postedAt) ||
    toDate(project.createdAt) ||
    null;

  // 2. Closing Date & Time (Submission Deadline)
  // Strictly fetched from the project database record. No hardcoded fallback.
  const closesAt = resolveProjectDeadline(project);

  const projectStatus = String(project.status || "open").toLowerCase();
  const explicitBiddingStatus = String(project.biddingStatus || "").toLowerCase();

  const isCompletedProject =
    project.isCompleted === true ||
    projectStatus === "completed" ||
    projectStatus === "offer_accepted" ||
    projectStatus === "awarded" ||
    explicitBiddingStatus === "completed" ||
    Boolean(project.completedAt);

  // 3. Determine status: "completed" | "closed" | "scheduled" | "open"
  let status = "open";
  let explanation = "";

  if (isCompletedProject) {
    status = "completed";
    explanation = "The builder has accepted a quotation. This project is marked as completed.";
  } else if (BIDDING_CLOSED_STATUSES.has(projectStatus) || explicitBiddingStatus === "closed") {
    status = "closed";
    explanation =
      projectStatus === "offer_accepted"
        ? "The homeowner has accepted a quotation for this project."
        : "Bidding is officially closed for this project.";
  } else if (closesAt && nowMs >= closesAt.getTime()) {
    status = "closed";
    explanation = "The quotation deadline for this project has passed. Late quotations are rejected.";
  } else if (
    explicitBiddingStatus === "scheduled" ||
    (opensAt && nowMs < opensAt.getTime())
  ) {
    status = "scheduled";
    explanation = opensAt
      ? `Bidding opens on ${formatDateTime(opensAt)}. You can prepare your quotation in advance.`
      : "Bidding has not opened yet. Quotation submission will open according to schedule.";
  } else {
    status = "open";
    explanation = closesAt
      ? `Bidding is open. Quotations must be submitted before ${formatDateTime(closesAt)}.`
      : "Bidding is currently open for quotations.";
  }

  const isCompleted = status === "completed";
  const isOpen = status === "open";
  const isScheduled = status === "scheduled";
  const isClosed = status === "closed" || status === "completed";

  // 4. Calculate Time Remaining / Countdown
  let timeRemainingMs = 0;
  let remainingFormatted = "";

  if (isOpen) {
    if (closesAt) {
      timeRemainingMs = Math.max(0, closesAt.getTime() - nowMs);
      remainingFormatted = formatCountdown(timeRemainingMs);
    } else {
      remainingFormatted = "";
    }
  } else if (isScheduled) {
    if (opensAt) {
      timeRemainingMs = Math.max(0, opensAt.getTime() - nowMs);
      remainingFormatted = `Opens in ${formatCountdown(timeRemainingMs)}`;
    } else {
      remainingFormatted = "Scheduled";
    }
  } else if (isCompleted) {
    remainingFormatted = "Completed";
  } else {
    remainingFormatted = "Bidding closed";
  }

  // 5. Check for Deadline Changes / Homeowner updates
  // Can be stored as project.deadlineChange or in project.deadlineHistory
  let deadlineChange = null;
  const history = Array.isArray(project.deadlineHistory)
    ? project.deadlineHistory
    : Array.isArray(project.deadlineChanges)
    ? project.deadlineChanges
    : [];

  const rawChange =
    project.deadlineChange ||
    (history.length > 0 ? history[history.length - 1] : null);

  if (rawChange) {
    const prevDate = toDate(rawChange.previousDeadline || rawChange.previousDate);
    const newDate = toDate(rawChange.newDeadline || rawChange.newDate || closesAt);
    const changedAtDate = toDate(rawChange.changedAt || rawChange.timestamp);
    const isExtension = prevDate && newDate ? newDate.getTime() > prevDate.getTime() : true;

    deadlineChange = {
      hasChanged: true,
      previousDeadline: prevDate,
      previousFormatted: prevDate ? formatDateTime(prevDate) : rawChange.previousDeadline || "Earlier deadline",
      newDeadline: newDate,
      newFormatted: newDate ? formatDateTime(newDate) : rawChange.newDeadline || (closesAt ? formatDateTime(closesAt) : "—"),
      reason: String(rawChange.reason || "Project timeline adjusted").trim(),
      details: String(rawChange.details || rawChange.additionalDetails || rawChange.notes || "").trim(),
      changedAt: changedAtDate,
      changedAtFormatted: changedAtDate ? formatDateTime(changedAtDate) : null,
      isExtension,
    };
  }

  const statusTone = isCompleted ? "green" : isOpen ? "green" : isScheduled ? "amber" : "slate";
  const statusLabel = isCompleted ? "Completed" : isOpen ? "Bidding Open" : isScheduled ? "Bidding Scheduled" : "Bidding Closed";

  return {
    status,
    isCompleted,
    isOpen,
    isScheduled,
    isClosed,
    opensAt,
    closesAt,
    openFormatted: opensAt ? formatDateTime(opensAt) : "When posted",
    closeFormatted: closesAt ? formatDateTime(closesAt) : "N/A",
    openDateOnly: opensAt ? formatDate(opensAt) : "—",
    openTimeOnly: opensAt ? formatTime(opensAt) : "—",
    closeDateOnly: closesAt ? formatDate(closesAt) : "N/A",
    closeTimeOnly: closesAt ? formatTime(closesAt) : "",
    timeRemainingMs,
    remainingFormatted,
    statusTone,
    statusLabel,
    explanation,
    deadlineChange,
  };
}

/**
 * Format remaining ms into a human-readable countdown string.
 * Never rounds up so as not to promise time that isn't available.
 */
export function formatCountdown(ms) {
  if (ms <= 0) return "0 minutes";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "less than a minute";
  if (mins < 60) return `${mins}m left`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) {
    return `${hours}h ${remMins}m left`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `${days}d ${remHours}h left`;
}

/**
 * Determines whether a quotation can be submitted, and gives the proper button label/state.
 *
 * @param {object} project - The project post
 * @param {string|null} existingQuoteState - "won" | "pending" | "rejected" | null
 * @param {boolean} quotaBlocked - Whether monthly quotation limit is reached
 * @param {number} [nowMs] - Current time in ms
 * @returns {object} Button configuration
 */
export function evaluateQuotationAction(project, existingQuoteState, quotaBlocked = false, nowMs = Date.now()) {
  const schedule = getBiddingSchedule(project, nowMs);
  const { status, isOpen, isScheduled, isClosed, opensAt, closesAt, openFormatted, closeFormatted } = schedule;

  // Case 0: Project is completed (builder accepted a quotation / project finished)
  if (schedule.isCompleted) {
    if (existingQuoteState === "won") {
      return {
        canSubmit: false,
        isActionable: true,
        buttonLabel: "Quote accepted",
        buttonTitle: "The builder accepted your quote! Project completed.",
        badgeTone: "green",
        schedule,
        allowView: true,
        explanation: "The builder accepted your quotation for this project.",
      };
    }
    return {
      canSubmit: false,
      isActionable: true,
      buttonLabel: existingQuoteState ? "Project completed" : "Completed",
      buttonTitle: "The builder accepted a quotation and this project is completed.",
      badgeTone: "slate",
      schedule,
      allowView: true,
      explanation: "This project has been completed. Bidding is concluded.",
    };
  }

  // Case 1: The shop's quote was already accepted
  if (existingQuoteState === "won") {
    return {
      canSubmit: false,
      isActionable: true,
      buttonLabel: "Quote accepted",
      buttonTitle: "The builder accepted your quote. Manage it from your Quotations tab.",
      badgeTone: "green",
      schedule,
      allowView: true,
      explanation: "Your quote was accepted by the builder.",
    };
  }

  // Case 2: Bidding is scheduled (not open yet)
  if (isScheduled) {
    return {
      canSubmit: false,
      isActionable: false,
      buttonLabel: "Bidding not open",
      buttonTitle: `Bidding opens on ${openFormatted}. You can review project specs and prepare materials in advance.`,
      badgeTone: "amber",
      schedule,
      allowView: false,
      explanation: `Quotation submissions open on ${openFormatted}. Review requirements now to prepare your bid.`,
    };
  }

  // Case 3: Bidding is closed
  if (isClosed) {
    // If shop already submitted a quote while bidding was open, preserve and allow viewing
    if (existingQuoteState === "pending") {
      return {
        canSubmit: false,
        isActionable: true,
        buttonLabel: "View submitted quote",
        buttonTitle: "Bidding is closed. Your submitted quotation is preserved and undergoing homeowner review.",
        badgeTone: "slate",
        schedule,
        allowView: true,
        explanation: `Quotation deadline closed on ${closeFormatted}. Your submitted quote remains valid for review.`,
      };
    }

    return {
      canSubmit: false,
      isActionable: false,
      buttonLabel: "Bidding closed",
      buttonTitle: `Bidding closed on ${closeFormatted}. Late quotations are automatically rejected by iConstruct policy.`,
      badgeTone: "slate",
      schedule,
      allowView: false,
      explanation: `Bidding closed on ${closeFormatted}. New quotation submissions are no longer accepted.`,
    };
  }

  // Case 4: Bidding is open!
  if (isOpen) {
    if (existingQuoteState === "pending") {
      return {
        canSubmit: true,
        isActionable: true,
        buttonLabel: "Update my quote",
        buttonTitle: `Update your pending quote before bidding closes on ${closeFormatted}.`,
        badgeTone: "green",
        schedule,
        allowView: true,
        explanation: `Bidding is open (${schedule.remainingFormatted}). You can revise your quote before the deadline.`,
      };
    }

    if (quotaBlocked) {
      return {
        canSubmit: false,
        isActionable: false,
        buttonLabel: "Quota reached",
        buttonTitle: "Monthly quotation quota reached. Upgrade to Pro for unlimited bidding.",
        badgeTone: "amber",
        schedule,
        allowView: false,
        explanation: "You have reached your Basic plan monthly quotation quota.",
      };
    }

    if (existingQuoteState === "rejected") {
      return {
        canSubmit: true,
        isActionable: true,
        buttonLabel: "Quote again",
        buttonTitle: `Submit a revised quotation before bidding closes on ${closeFormatted}.`,
        badgeTone: "green",
        schedule,
        allowView: true,
        explanation: `Bidding is open (${schedule.remainingFormatted}). You can submit a new offer.`,
      };
    }

    return {
      canSubmit: true,
      isActionable: true,
      buttonLabel: "Submit quote",
      buttonTitle: closesAt ? `Submit quotation before ${closeFormatted} (${schedule.remainingFormatted}).` : "Submit quotation for this project.",
      badgeTone: "green",
      schedule,
      allowView: false,
      explanation: closesAt ? `Bidding is open (${schedule.remainingFormatted}). Submit your quotation before ${closeFormatted}.` : "Bidding is currently open for quotations.",
    };
  }

  return {
    canSubmit: false,
    isActionable: false,
    buttonLabel: "Unavailable",
    buttonTitle: "Cannot quote on this project.",
    badgeTone: "slate",
    schedule,
    allowView: false,
    explanation: "This project is not currently accepting quotations.",
  };
}
