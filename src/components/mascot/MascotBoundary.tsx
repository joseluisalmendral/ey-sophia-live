"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * MascotBoundary — error isolation for Broqui.
 *
 * The mascot is pure delight; the tally, the podium and the vote CTA are the
 * product. Any render/lifecycle error inside the wrapped mascot tree is caught
 * here: the mascot renders nothing for the rest of the session and the error
 * is logged ONCE (per boundary), so a Broqui bug can never unmount the
 * projector chart or the voter's vote button.
 *
 * Error boundaries must be class components (React has no hook equivalent).
 * Errors thrown from timers/intervals are not render errors and never reach
 * a boundary; they do not unmount the tree either.
 */

interface Props {
  /** Short label for the log line ("projector", "phone", "lab"…). */
  name: string;
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class MascotBoundary extends Component<Props, State> {
  state: State = { failed: false };
  private logged = false;

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (this.logged) return;
    this.logged = true;
    console.error(
      `[mascot:${this.props.name}] disabled after an error; the show continues.`,
      error,
      info.componentStack,
    );
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

export default MascotBoundary;
